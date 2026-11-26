/**
 * Clases de error de dominio reutilizables por todos los módulos. Cada
 * módulo las lanza desde su capa de servicio; los route handlers y
 * server actions las traducen a HTTP/mensaje (ver
 * specs/tenancy-auth/design.md#errores).
 *
 * Cubre: infraestructura de errores usada por RF-AUT-01 a 08.
 */

export class NotFoundError extends Error {
  constructor(message = "No se ha encontrado.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "No tienes permiso para hacer esto.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Inicia sesión para continuar.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class PayloadTooLargeError extends Error {
  constructor(message = "El archivo es demasiado grande.") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export class UnsupportedMediaTypeError extends Error {
  constructor(message = "Tipo de archivo no admitido.") {
    super(message);
    this.name = "UnsupportedMediaTypeError";
  }
}

export class RateLimitError extends Error {
  constructor(message = "Demasiados intentos. Inténtalo de nuevo en unos minutos.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Usuario `inactive` con contraseña correcta. Hereda de UnauthorizedError
 * (mismo mensaje hacia fuera) pero permite registrar el motivo real.
 */
export class InactiveUserError extends UnauthorizedError {
  constructor(message = "Email o contraseña incorrectos.") {
    super(message);
    this.name = "InactiveUserError";
  }
}
