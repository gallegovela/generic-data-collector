import { afterEach, describe, expect, it, vi } from "vitest";
import { InactiveUserError, RateLimitError, UnauthorizedError } from "@/lib/errors";
import { classifyLoginError, logLoginFailure } from "./login-failure";

describe("login-failure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Cubre: RNF-AUT-05
  it("classifyLoginError traduce cada clase de error", () => {
    expect(classifyLoginError(new RateLimitError(), "password")).toBe("rate_limited");
    expect(classifyLoginError(new InactiveUserError(), "password")).toBe("inactive_user");
    expect(classifyLoginError(new UnauthorizedError("x"), "password")).toBe("invalid_credentials");
    expect(classifyLoginError(new UnauthorizedError("x"), "magic-link")).toBe("invalid_token");
    expect(classifyLoginError(new Error("db down"), "password")).toBe("internal_error");
    expect(classifyLoginError("raro", "magic-link")).toBe("internal_error");
  });

  // Cubre: RNF-AUT-05, CA-AUT-10
  it("logLoginFailure escribe una línea JSON con event, provider y reason", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logLoginFailure("password", "rate_limited");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toEqual({
      event: "auth.login_failed",
      provider: "password",
      reason: "rate_limited",
    });
  });

  // Cubre: RNF-AUT-05, CA-AUT-10
  it("en internal_error incluye errorClass y no el mensaje", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logLoginFailure("password", "internal_error", new TypeError("secreto@test.local"));

    const line = String(warn.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toMatchObject({ reason: "internal_error", errorClass: "TypeError" });
    expect(line).not.toContain("secreto@test.local");
  });
});
