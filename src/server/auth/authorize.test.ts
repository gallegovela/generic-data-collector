import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InactiveUserError, RateLimitError, UnauthorizedError } from "@/lib/errors";
import { RateLimitedSignin } from "@/lib/auth/login-errors";

// next-auth no se resuelve bajo Vitest (node): se sustituye por una clase equivalente.
vi.mock("@/lib/auth/login-errors", () => ({
  RateLimitedSignin: class RateLimitedSignin extends Error {
    code = "rate_limited";
  },
}));

vi.mock("./auth.service", () => ({
  verifyPassword: vi.fn(),
  verifyMagicLink: vi.fn(),
}));

import { authorizeMagicLink, authorizePassword } from "./authorize";
import { verifyMagicLink, verifyPassword } from "./auth.service";

const EMAIL = "persona.privada@test.formia.local";
const PASSWORD = "Contraseña-Secreta-1";

const user = {
  id: "u1",
  organizationId: "o1",
  email: EMAIL,
  name: "Persona",
  role: "collector" as const,
};

describe("authorize", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lines(): Array<Record<string, string>> {
    return warn.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])));
  }

  // Cubre: RF-AUT-01
  it("login correcto devuelve el usuario y no escribe log", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(user);

    await expect(authorizePassword({ email: EMAIL, password: PASSWORD })).resolves.toEqual(user);
    expect(warn).not.toHaveBeenCalled();
  });

  // Cubre: RNF-AUT-05, CA-AUT-10
  it.each([
    ["invalid_credentials", new UnauthorizedError("x")],
    ["inactive_user", new InactiveUserError()],
    ["internal_error", new Error(`fallo con ${EMAIL}`)],
  ])("%s: devuelve null y registra una línea sin datos personales", async (reason, error) => {
    vi.mocked(verifyPassword).mockRejectedValue(error);

    await expect(authorizePassword({ email: EMAIL, password: PASSWORD })).resolves.toBeNull();

    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatchObject({ event: "auth.login_failed", provider: "password", reason });
    const output = warn.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
    expect(output).not.toContain(EMAIL);
    expect(output).not.toContain(PASSWORD);
  });

  // Cubre: CA-AUT-08, CA-AUT-10
  it("rate_limited lanza RateLimitedSignin y lo registra", async () => {
    vi.mocked(verifyPassword).mockRejectedValue(new RateLimitError());

    await expect(authorizePassword({ email: EMAIL, password: PASSWORD })).rejects.toBeInstanceOf(
      RateLimitedSignin,
    );
    expect(lines()[0]).toMatchObject({ reason: "rate_limited" });
  });

  // Cubre: CA-AUT-10
  it("credenciales con formato inválido registran invalid_credentials", async () => {
    await expect(authorizePassword({ email: "no-es-email", password: "" })).resolves.toBeNull();
    expect(lines()[0]).toMatchObject({ provider: "password", reason: "invalid_credentials" });
  });

  // Cubre: CA-AUT-10
  it("enlace mágico: token inválido y token ausente registran invalid_token", async () => {
    vi.mocked(verifyMagicLink).mockRejectedValue(new UnauthorizedError("x"));

    await expect(authorizeMagicLink({ token: "tok-secreto" })).resolves.toBeNull();
    await expect(authorizeMagicLink({})).resolves.toBeNull();

    expect(lines().map((line) => line.reason)).toEqual(["invalid_token", "invalid_token"]);
    expect(warn.mock.calls.map((call: unknown[]) => String(call[0])).join("")).not.toContain("tok-secreto");
  });

  // Cubre: RF-AUT-02
  it("enlace mágico válido devuelve el usuario", async () => {
    vi.mocked(verifyMagicLink).mockResolvedValue(user);

    await expect(authorizeMagicLink({ token: "t" })).resolves.toEqual(user);
  });
});
