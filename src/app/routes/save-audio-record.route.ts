/**
 * POST /api/save-audio-record
 * Body: NoiseReadingPayload (ver src/app/schemas/save-audio-record.schema.ts)
 * 201  -> { data: SaveAudioRecordResult }
 * 400  -> { error: { code: "VALIDATION_ERROR", message, details } }
 */
import { Router } from "express";
import { saveAudioRecord } from "../controllers/save-audio-record.controller";
import { validateBody } from "../middlewares/validate";
import { saveAudioRecordSchema } from "../schemas/save-audio-record.schema";

export const saveAudioRecordRouter = Router();

saveAudioRecordRouter.post("/", validateBody(saveAudioRecordSchema), saveAudioRecord);
