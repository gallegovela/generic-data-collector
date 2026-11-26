import QRCode from "qrcode";

export type QrFormat = "png" | "svg";

/**
 * PNG: Buffer de 512 px, margen de 2 módulos, corrección "M".
 * SVG: string que empieza por "<svg".
 *
 * Cubre: RF-PUB-05, CA-PUB-02
 */
export function renderQr(url: string, format: "png"): Promise<Buffer>;
export function renderQr(url: string, format: "svg"): Promise<string>;
export function renderQr(url: string, format: QrFormat): Promise<Buffer | string> {
  const options = { errorCorrectionLevel: "M" as const, margin: 2 };
  if (format === "png") return QRCode.toBuffer(url, { ...options, type: "png", width: 512 });
  return QRCode.toString(url, { ...options, type: "svg" });
}
