/** Métrica de ruido que transporta la fila. */
export type NoiseMetric = "min" | "max" | "avg";

/**
 * Bloque `domain_data` que se persiste como JSONB.
 * Es un `type` (no una `interface`) para que sea asignable al tipo JSON de Prisma.
 */
export type NoiseDomainData = {
  /** Cuál de las tres lecturas transporta esta fila. */
  metric: NoiseMetric;
  /** El valor de `metric`, duplicado para que la fila sea auto descriptiva. */
  value_db: number;
  noise_min_db: number;
  noise_max_db: number;
  noise_avg_db: number;
  recording_duration_ms: number;
  device_model: string;
  app_version: string;
};

/** Cuerpo que envía el frontend a `POST /api/save-audio-record`. */
export interface NoiseReadingPayload {
  timestamp: string;
  latitude: number;
  longitude: number;
  student_id: string;
  auth_hash: string;
  domain_data: NoiseDomainData;
}

export interface AudioMetrics {
  minDb: number;
  maxDb: number;
  avgDb: number;
  durationMs: number;
}

/** Fila devuelta tras guardar correctamente una lectura. */
export interface SaveAudioRecordResult {
  reading_id: string;
  student_id: string;
  metric: NoiseMetric;
  value_db: number;
  created_at: string;
}
