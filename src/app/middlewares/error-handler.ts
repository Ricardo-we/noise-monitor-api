/**
 * Manejador global de errores. Define el formato de error de toda la API:
 * `{ error: { code, message, details? } }`.
 */
import type { ErrorRequestHandler, Request } from "express";
import { env } from "../../lib/env";
import { AppError } from "../../lib/http-error";
import { logger } from "../../lib/logger";

/** Errores de Prisma traducidos a códigos HTTP de la API. */
const PRISMA_ERROR_STATUS: Record<string, { status: number; code: string; message: string }> = {
  P2002: { status: 409, code: "DUPLICATE_RESOURCE", message: "Ya existe una lectura con esos datos" },
  P2003: { status: 400, code: "FOREIGN_KEY_ERROR", message: "Referencia inválida en la base de datos" },
  P2025: { status: 404, code: "NOT_FOUND", message: "El registro solicitado no existe" },
  P1001: { status: 503, code: "DB_UNAVAILABLE", message: "No se pudo conectar con la base de datos" },
  P1002: { status: 503, code: "DB_TIMEOUT", message: "La base de datos tardó demasiado en responder" },
};

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export const errorHandler: ErrorRequestHandler = (err, req: Request, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const { status, body } = normalizeError(err);
  const logMeta = { method: req.method, path: req.originalUrl, status, code: body.error.code };

  if (status >= 500) logger.error(err instanceof Error ? err.message : "Error desconocido", logMeta);
  else logger.warn(body.error.message, logMeta);

  res.status(status).json(body satisfies ErrorBody);
};

function normalizeError(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    };
  }

  // JSON mal formado: lo lanza `express.json()`.
  if (err instanceof SyntaxError && "body" in err) {
    return {
      status: 400,
      body: { error: { code: "INVALID_JSON", message: "El cuerpo no es JSON válido" } },
    };
  }

  const prismaCode = getPrismaErrorCode(err);
  if (prismaCode && PRISMA_ERROR_STATUS[prismaCode]) {
    const mapped = PRISMA_ERROR_STATUS[prismaCode]!;
    return { status: mapped.status, body: { error: { code: mapped.code, message: mapped.message } } };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno del servidor",
        ...(env.isProduction ? {} : { details: err instanceof Error ? err.message : String(err) }),
      },
    },
  };
}

function getPrismaErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const { code } = err as { code?: unknown };
    if (typeof code === "string" && code.startsWith("P")) return code;
  }
  return undefined;
}
