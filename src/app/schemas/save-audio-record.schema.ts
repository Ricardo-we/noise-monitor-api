/**
 * Esquema de validación (y contrato) del endpoint `POST /api/save-audio-record`.
 * Es la única fuente de verdad: de aquí salen también los tipos del controlador.
 */
import { z } from "zod";

/**
 * Rango tolerado por los sensores: cubre tanto dB SPL (0..~140) como dBFS
 * negativo, según la librería que use el frontend. Solo sirve para descartar
 * valores claramente corruptos.
 */
const DECIBELS = { min: -160, max: 150 } as const;

/** Una medición de audio de 5 minutos como máximo. */
const MAX_RECORDING_DURATION_MS = 300_000;

export const saveAudioRecordSchema = z.strictObject({
  timestamp: z.iso.datetime({ offset: true, message: "timestamp debe ser una fecha ISO 8601" }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  student_id: z.string().trim().min(1).max(50),
  auth_hash: z.string().trim().min(1).max(64),
  domain_data: z.strictObject({
    metric: z.enum(["min", "max", "avg"]),
    value_db: z.number().min(DECIBELS.min).max(DECIBELS.max),
    noise_min_db: z.number().min(DECIBELS.min).max(DECIBELS.max),
    noise_max_db: z.number().min(DECIBELS.min).max(DECIBELS.max),
    noise_avg_db: z.number().min(DECIBELS.min).max(DECIBELS.max),
    recording_duration_ms: z.number().int().positive().max(MAX_RECORDING_DURATION_MS),
    device_model: z.string().trim().min(1).max(120),
    app_version: z.string().trim().min(1).max(40),
  }),
});

export type SaveAudioRecordBody = z.infer<typeof saveAudioRecordSchema>;
