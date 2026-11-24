import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { describe, expect, it } from "vitest";

import { authConfig } from "./auth.config";

// Cubre: RF-AUT-06 (el panel necesita id, organizationId y role en la sesión).

type SessionParams = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>["session"]>>[0];
type JwtParams = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>["jwt"]>>[0];

const callbacks = authConfig.callbacks!;

describe("authConfig callbacks", () => {
  it("jwt copies organizationId and role from the user at sign-in", async () => {
    const user = { id: "u1", email: "a@b.c", organizationId: "org1", role: "admin" } as User;
    const token = await callbacks.jwt!({ token: { sub: "u1" }, user } as JwtParams);

    expect(token).toMatchObject({ sub: "u1", organizationId: "org1", role: "admin" });
  });

  it("session exposes the user id, organizationId and role from the token", async () => {
    const token: JWT = { sub: "u1", email: "a@b.c", organizationId: "org1", role: "admin" };
    const session = {
      user: { name: "Admin", email: "a@b.c" },
      expires: "2099-01-01T00:00:00.000Z",
    } as Session;

    const result = (await callbacks.session!({ session, token } as SessionParams)) as Session;

    expect(result.user).toMatchObject({ id: "u1", organizationId: "org1", role: "admin" });
  });
});
