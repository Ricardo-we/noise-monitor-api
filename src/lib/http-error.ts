/**
 * Error de aplicación con código HTTP estable.
 * Cualquier error lanzado desde rutas/controladores llega al error handler
 * global y se traduce a la respuesta `{ error: { code, message, details } }`.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, "VALIDATION_ERROR", "El cuerpo de la petición no es válido", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(404, "NOT_FOUND", message);
  }
}
