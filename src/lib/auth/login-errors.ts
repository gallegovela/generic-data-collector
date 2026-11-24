import { CredentialsSignin } from "next-auth";

import { RATE_LIMITED_CODE } from "./login-error-codes";

export { RATE_LIMITED_CODE };

/**
 * Error de Auth.js cuyo `code` llega al cliente como `result.code` en
 * `signIn(..., { redirect: false })`. Seguro: el bloqueo depende solo del
 * texto del email, exista o no la cuenta.
 *
 * Cubre: CA-AUT-08.
 */
export class RateLimitedSignin extends CredentialsSignin {
  code = RATE_LIMITED_CODE;
}
