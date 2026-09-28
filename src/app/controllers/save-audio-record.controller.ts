/** Controlador de `POST /api/save-audio-record`. */
import type { Response } from "express";
import { logger } from "../../lib/logger";
import { noiseReadingRepository } from "../../repositories/noise-reading.repository";
import type { SaveAudioRecordResult } from "../../types/noise-reading";
import type { RequestWithBody } from "../middlewares/validate";
import type { SaveAudioRecordBody } from "../schemas/save-audio-record.schema";

export async function saveAudioRecord(req: RequestWithBody<SaveAudioRecordBody>, res: Response): Promise<void> {
  const body = req.body;

  const row = await noiseReadingRepository.create({
    timestamp: new Date(body.timestamp),
    latitude: body.latitude,
    longitude: body.longitude,
    studentId: body.student_id,
    authHash: body.auth_hash,
    domainData: body.domain_data,
  });

  const metric = body.domain_data.metric;
  const result: SaveAudioRecordResult = {
    reading_id: row.readingId,
    student_id: row.studentId,
    metric,
    value_db: body.domain_data.value_db,
    created_at: row.createdAt.toISOString(),
  };

  logger.info("audio record saved", { reading_id: result.reading_id, metric });

  res.status(201).json({ data: result });
}
