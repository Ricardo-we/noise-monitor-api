/**
 * Autenticación por API key.
 * Compara el header `x-api-key` contra `API_KEY` (.env) en tiempo constante.
 * Si `API_KEY` no está definida, no se exige (útil en desarrollo/tests).
 */
import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../../lib/env";
import { UnauthorizedError } from "../../lib/http-error";

const HEADER = "x-api-key";

export const requireApiKey: RequestHandler = (req, _res, next) => {
  if (!env.API_KEY) {
    next();
    return;
  }

  const provided = req.header(HEADER);

  if (!provided || !safeEqual(provided, env.API_KEY)) {
    next(new UnauthorizedError("API key inválida o ausente"));
    return;
  }

  next();
};

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
