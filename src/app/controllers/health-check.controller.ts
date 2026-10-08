/** Controlador de `GET /api/health-check`. */
import type { Request, Response } from "express";
import { logger } from "../../lib/logger";
import { noiseReadingRepository } from "../../repositories/noise-reading.repository";

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  try {
    await noiseReadingRepository.ping();
    res.status(200).json({ status: "ok", database: "ok" });
  } catch (error) {
    logger.error("health check failed", { error: error instanceof Error ? error.message : error });
    res.status(503).json({ status: "error", database: "unavailable" });
  }
}
