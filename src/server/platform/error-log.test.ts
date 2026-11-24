import { afterEach, describe, expect, it, vi } from "vitest";

import { buildRequestErrorLog, logRequestError } from "./error-log";

// Cubre: RNF-PLT-05, CA-PLT-05.

const request = { method: "POST" };
const context = { routePath: "/invite/[token]", routeType: "action" };

function makeError(): Error {
  const error = new Error("Unique constraint failed on email ana@example.com") as Error & {
    code: string;
    digest: string;
  };
  error.code = "P2002";
  error.digest = "1234567890";
  error.stack = [
    "Error: Unique constraint failed on email ana@example.com",
    "    at inviteUser (/app/.next/server/chunks/1.js:10:5)",
    "    at async acceptInvitationAction (/app/.next/server/chunks/2.js:20:7)",
  ].join("\n");
  return error;
}

describe("buildRequestErrorLog", () => {
  it("records the route template, error type, code, digest and stack frames", () => {
    const entry = buildRequestErrorLog(makeError(), request, context, new Date("2026-11-24T10:00:00Z"));

    expect(entry).toEqual({
      level: "error",
      event: "request_error",
      time: "2026-11-24T10:00:00.000Z",
      method: "POST",
      route: "/invite/[token]",
      routeType: "action",
      name: "Error",
      code: "P2002",
      digest: "1234567890",
      stack: [
        "at inviteUser (/app/.next/server/chunks/1.js:10:5)",
        "at async acceptInvitationAction (/app/.next/server/chunks/2.js:20:7)",
      ],
    });
  });

  it("never includes the error message or personal data", () => {
    const json = JSON.stringify(buildRequestErrorLog(makeError(), request, context));

    expect(json).not.toContain("Unique constraint");
    expect(json).not.toContain("ana@example.com");
    expect(json).not.toContain("abc123");
  });

  it("keeps the render source when Next.js provides it", () => {
    const entry = buildRequestErrorLog(new Error("x"), { method: "GET" }, {
      routePath: "/admin/forms/[id]",
      routeType: "render",
      renderSource: "react-server-components",
    });

    expect(entry.renderSource).toBe("react-server-components");
  });

  it("handles thrown values that are not Error instances", () => {
    const entry = buildRequestErrorLog("boom", request, context);

    expect(entry.name).toBe("NonError");
    expect(entry.stack).toBeUndefined();
    expect(entry.code).toBeUndefined();
    expect(entry.digest).toBeUndefined();
    expect(JSON.stringify(entry)).not.toContain("boom");
  });
});

describe("logRequestError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes a single JSON line to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logRequestError(makeError(), request, context);

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]?.[0] as string;
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toMatchObject({ event: "request_error", route: "/invite/[token]" });
  });

  it("never throws, even if writing fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("stderr closed");
    });

    expect(() => logRequestError(makeError(), request, context)).not.toThrow();
  });
});
