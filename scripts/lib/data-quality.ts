import type { PoolClient } from "pg";

const dbFields = ["value_db", "noise_min_db", "noise_max_db", "noise_avg_db"];
const numberFields = [...dbFields, "recording_duration_ms"];
const normalizedFields = numberFields.map((key) =>
  `CASE WHEN jsonb_typeof(domain_data->'${key}') = 'number' THEN (domain_data->>'${key}')::numeric END AS ${key}`
).join(", ");

/** HU-18: solo lectura, una misma instantánea para estructura y conteos. */
export async function auditNoiseReadings(client: PoolClient, timeZone: string) {
  new Intl.DateTimeFormat("en", { timeZone });
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '60s'");
    const database = (await client.query("SELECT current_database() AS name")).rows[0].name as string;
    const columns = (await client.query(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'noise_readings'
      ORDER BY ordinal_position
    `)).rows;
    if (columns.length === 0) throw new Error("TABLE_NOT_FOUND");
    const constraints = (await client.query(`
      SELECT c.conname AS name, c.contype AS type, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'noise_readings'
      ORDER BY c.conname
    `)).rows;
    const indexes = (await client.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'noise_readings' ORDER BY indexname
    `)).rows;
    const summary = (await client.query(`
      WITH normalized AS (
        SELECT *, ${normalizedFields} FROM public.noise_readings
      )
      SELECT
        count(*)::int AS total_readings,
        count(*) FILTER (WHERE reading_id IS NULL OR timestamp IS NULL OR latitude IS NULL
          OR longitude IS NULL OR student_id IS NULL OR auth_hash IS NULL
          OR domain_data IS NULL OR created_at IS NULL)::int AS null_required_fields,
        count(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL
          OR NOT latitude BETWEEN -90 AND 90 OR NOT longitude BETWEEN -180 AND 180)::int AS invalid_coordinates,
        count(*) FILTER (WHERE student_id IS NULL OR length(trim(student_id)) NOT BETWEEN 1 AND 50)::int AS invalid_student_ids,
        count(*) FILTER (WHERE auth_hash IS NULL OR auth_hash !~ '^[0-9a-fA-F]{64}$')::int AS non_sha256_hash_format,
        count(*) FILTER (WHERE jsonb_typeof(domain_data) IS DISTINCT FROM 'object'
          OR value_db IS NULL OR noise_min_db IS NULL OR noise_max_db IS NULL OR noise_avg_db IS NULL
          OR recording_duration_ms IS NULL
          OR jsonb_typeof(domain_data->'metric') IS DISTINCT FROM 'string'
          OR (domain_data->>'metric') NOT IN ('min', 'max', 'avg')
          OR jsonb_typeof(domain_data->'device_model') IS DISTINCT FROM 'string'
          OR length(trim(domain_data->>'device_model')) NOT BETWEEN 1 AND 120
          OR jsonb_typeof(domain_data->'app_version') IS DISTINCT FROM 'string'
          OR length(trim(domain_data->>'app_version')) NOT BETWEEN 1 AND 40)::int AS malformed_domain_data,
        count(*) FILTER (WHERE ${dbFields.map((key) => `${key} IS NOT NULL AND ${key} NOT BETWEEN -160 AND 150`).join(" OR ")})::int AS db_out_of_range,
        count(*) FILTER (WHERE noise_min_db > noise_avg_db OR noise_avg_db > noise_max_db)::int AS inconsistent_min_avg_max,
        count(*) FILTER (WHERE abs(value_db - CASE domain_data->>'metric'
          WHEN 'min' THEN noise_min_db WHEN 'max' THEN noise_max_db WHEN 'avg' THEN noise_avg_db END) > 0.000001)::int AS value_metric_mismatch,
        count(*) FILTER (WHERE recording_duration_ms IS NOT NULL
          AND (recording_duration_ms NOT BETWEEN 1 AND 300000 OR recording_duration_ms <> trunc(recording_duration_ms)))::int AS invalid_duration,
        min(timestamp) AS first_measurement, max(timestamp) AS last_measurement
      FROM normalized
    `)).rows[0];
    const duplicates = (await client.query(`
      WITH valid AS (
        SELECT reading_id, latitude, longitude, (timestamp AT TIME ZONE $1)::date AS local_day
        FROM public.noise_readings
        WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND timestamp IS NOT NULL
      )
      SELECT count(*)::int AS nearby_same_day_pairs FROM valid a JOIN valid b
        ON a.reading_id < b.reading_id AND a.local_day = b.local_day
      WHERE 2 * 6371008.8 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
        POWER(SIN(RADIANS(a.latitude - b.latitude) / 2), 2)
        + COS(RADIANS(a.latitude)) * COS(RADIANS(b.latitude))
          * POWER(SIN(RADIANS(a.longitude - b.longitude) / 2), 2)
      )))) <= 50.0
    `, [timeZone])).rows[0];
    await client.query("COMMIT");
    return {
      generated_at: new Date().toISOString(),
      database,
      table: "public.noise_readings",
      measurement_time_zone: timeZone,
      schema: { columns, constraints, indexes },
      quality: { ...summary, ...duplicates },
      criteria: {
        decibels_range: [-160, 150],
        nearby_radius_meters: 50,
        day_source: "timestamp de la medición, convertido a measurement_time_zone",
        metric_comparison_tolerance: 0.000001,
        hash_check: "Solo formato hexadecimal SHA-256; no verifica identidad ni dispositivo",
      },
      limitations: [
        "Los conteos de problemas pueden solaparse; no deben sumarse como registros distintos.",
        "Los pares cercanos no equivalen al número de registros duplicados.",
        "La API no almacena un historial de solicitudes rechazadas; ese criterio necesita evidencia de logs o una tarea adicional.",
        "El rango de dB procede del contrato actual; falta confirmar si la app reporta dBFS o dB SPL.",
      ],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
