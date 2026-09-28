/** Responde 404 cuando ninguna ruta coincide con la petición. */
import type { RequestHandler } from "express";
import { NotFoundError } from "../../lib/http-error";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No existe el endpoint ${req.method} ${req.originalUrl}`));
};
