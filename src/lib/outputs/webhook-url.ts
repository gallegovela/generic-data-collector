import { isIP } from "node:net";

export type WebhookUrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: "invalid" | "protocol" | "credentials" | "blocked_host" };

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isBlockedIpv4(octets: number[], allowLoopback: boolean): boolean {
  const [a, b, c] = octets;
  if (a === 127) return !allowLoopback;
  if (a === 0 || a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

/** Expande una IPv6 a ocho grupos de 16 bits; null si no es válida. */
function expandIpv6(ip: string): number[] | null {
  let text = ip.toLowerCase();
  const zone = text.indexOf("%");
  if (zone >= 0) text = text.slice(0, zone);
  // Cola IPv4 incrustada (::ffff:10.0.0.1).
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    text = `${text.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 0) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

/**
 * IPv4: 0/8, 10/8, 100.64/10, 169.254/16, 172.16/12, 192.0.0/24, 192.168/16,
 * 198.18/15, 224/4 y 240/4 siempre bloqueadas; 127/8 solo si !allowLoopback.
 * IPv6: `::`, fc00::/7, fe80::/10 siempre; `::1` solo si !allowLoopback;
 * `::ffff:a.b.c.d` se evalúa como IPv4. Entrada que no es IP -> false.
 *
 * Cubre: RF-OUT-15, CA-OUT-10
 */
export function isBlockedIp(ip: string, opts: { allowLoopback: boolean }): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const octets = parseIpv4(ip);
    return octets ? isBlockedIpv4(octets, opts.allowLoopback) : false;
  }
  if (kind === 6) {
    const g = expandIpv6(ip);
    if (!g) return false;
    const allZeroHigh = g.slice(0, 5).every((n) => n === 0);
    if (allZeroHigh && g[5] === 0xffff) {
      return isBlockedIpv4(
        [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff],
        opts.allowLoopback,
      );
    }
    if (g.slice(0, 7).every((n) => n === 0)) {
      if (g[7] === 0) return true; // ::
      if (g[7] === 1) return !opts.allowLoopback; // ::1
    }
    if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
    if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
    return false;
  }
  return false;
}

const LOCAL_SUFFIXES = [".localhost", ".local", ".internal"];

/**
 * Sin E/S. Solo http/https; rechaza credenciales; si el host es una IP
 * literal o un nombre local aplica `isBlockedIp`. Los demás nombres pasan
 * (se resuelven al enviar).
 *
 * Cubre: RF-OUT-15, CA-OUT-10
 */
export function checkWebhookUrl(raw: string, opts: { allowLoopback: boolean }): WebhookUrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "protocol" };
  }
  if (url.username || url.password) return { ok: false, reason: "credentials" };

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host)) {
    return isBlockedIp(host, opts) ? { ok: false, reason: "blocked_host" } : { ok: true, url };
  }
  const isLocalName =
    host === "localhost" || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (isLocalName) {
    const loopbackOk = opts.allowLoopback && (host === "localhost" || host.endsWith(".localhost"));
    return loopbackOk ? { ok: true, url } : { ok: false, reason: "blocked_host" };
  }
  return { ok: true, url };
}
