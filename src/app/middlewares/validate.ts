/**
 * Valida `req.body` con un esquema de Zod y lo reemplaza por el valor parseado
 * (con defaults y coerciones aplicadas). Los errores se lanzan como
 * `ValidationError` y los formatea el error handler global.
 */
import type { RequestHandler } from "express";
import type { ZodType, z } from "zod";
import { ValidationError } from "../../lib/http-error";

/** `Request` con el body ya validado según `TBody`. */
export type RequestWithBody<TBody> = Omit<import("express").Request, "body"> & { body: TBody };

export function validateBody<TSchema extends ZodType>(schema: TSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new ValidationError(formatIssues(result.error)));
      return;
    }

    req.body = result.data;
    next();
  };
}

/** Convierte los issues de Zod en una lista plana `{ path, message, code }`. */
function formatIssues(error: z.ZodError): Array<{ path: string; message: string; code: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}
