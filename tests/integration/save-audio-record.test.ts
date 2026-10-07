import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import type { Server } from "node:http";
import { Pool } from "pg";
import { validReading } from "../fixtures";
import { auditNoiseReadings } from "../../scripts/lib/data-quality";

// Esta suite crea y vacía una tabla: solo se permite una BD local de pruebas.
const testUrl = process.env.TEST_DB_URL;
if (!testUrl) throw new Error("Define TEST_DB_URL con la base local noise_monitor_test (ver README)");
const url = new URL(testUrl);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/noise_monitor_test") {
  throw new Error("Las pruebas solo pueden modificar una BD local llamada noise_monitor_test");
}
process.env.DB_URL = testUrl;
process.env.NODE_ENV = "test";
process.env.MEASUREMENT_TIME_ZONE = "America/Guatemala";
const pool = new Pool({ connectionString: testUrl });
let server: Server;
let apiUrl: string;
let disconnect: () => Promise<void>;

before(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS noise_readings (
    reading_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), timestamp TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
    student_id VARCHAR(50) NOT NULL, auth_hash VARCHAR(64) NOT NULL,
    domain_data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const { createApp } = await import("../../src/app/app.js");
  disconnect = (await import("../../src/lib/prisma.js")).disconnectPrisma;
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  assert(address && typeof address !== "string");
  apiUrl = `http://127.0.0.1:${address.port}/api/save-audio-record`;
});

beforeEach(async () => { await pool.query("TRUNCATE noise_readings"); });
after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (disconnect) await disconnect();
  await pool.end();
});

function post(body: unknown) {
  return fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function atDistance(meters: number) {
  return { ...validReading, latitude: 0, longitude: meters / 6371008.8 * 180 / Math.PI };
}

test("201: guarda y devuelve el contrato existente", async () => {
  const response = await post(validReading);
  assert.equal(response.status, 201);
  const body = await response.json() as { data: { student_id: string; value_db: number } };
  assert.deepEqual(Object.keys(body.data).sort(), ["created_at", "metric", "reading_id", "student_id", "value_db"]);
  assert.equal(body.data.student_id, validReading.student_id);
  assert.equal(body.data.value_db, 62.4);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM noise_readings")).rows[0].n, 1);
});

for (const meters of [0, 49.99, 50, 50.01]) {
  test(`${meters} m: ${meters <= 50 ? "409 sin insertar" : "201"}`, async () => {
    assert.equal((await post(atDistance(0))).status, 201);
    const response = await post({ ...atDistance(meters), student_id: "another-student" });
    assert.equal(response.status, meters <= 50 ? 409 : 201);
    if (meters <= 50) {
      assert.deepEqual(await response.json(), { error: { code: "NEARBY_READING_EXISTS", message: "Ya existe una medición a 50 metros o menos en el mismo día" } });
    }
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM noise_readings")).rows[0].n, meters <= 50 ? 1 : 2);
  });
}

test("misma ubicación otro día: permite guardar", async () => {
  assert.equal((await post(validReading)).status, 201);
  assert.equal((await post({ ...validReading, timestamp: "2026-10-06T18:00:00Z" })).status, 201);
});

test("regreso a un punto anterior del día: rechaza aunque el último registro esté lejos", async () => {
  assert.equal((await post(atDistance(0))).status, 201);
  assert.equal((await post(atDistance(100))).status, 201);
  assert.equal((await post(atDistance(0))).status, 409);
});

test("medianoche de Guatemala permite un nuevo día aunque sea la misma fecha UTC", async () => {
  assert.equal((await post({ ...validReading, timestamp: "2026-10-06T05:59:59.999Z" })).status, 201);
  assert.equal((await post({ ...validReading, timestamp: "2026-10-06T06:00:00Z" })).status, 201);
});

test("dos fechas UTC del mismo día local y offsets equivalentes: 409", async () => {
  assert.equal((await post({ ...validReading, timestamp: "2026-10-05T18:00:00-06:00" })).status, 201);
  assert.equal((await post({ ...validReading, timestamp: "2026-10-05T23:00:00Z" })).status, 409);
});

test("cruce del antimeridiano: detecta cercanía", async () => {
  assert.equal((await post({ ...validReading, latitude: 0, longitude: 179.9999 })).status, 201);
  assert.equal((await post({ ...validReading, latitude: 0, longitude: -179.9999 })).status, 409);
});

test("cerca del polo: detecta cercanía aunque la longitud cambie mucho", async () => {
  assert.equal((await post({ ...validReading, latitude: 89.9999, longitude: 0 })).status, 201);
  assert.equal((await post({ ...validReading, latitude: 89.9999, longitude: 180 })).status, 409);
});

test("solicitudes simultáneas: exactamente un 201 y cinco 409", async () => {
  const responses = await Promise.all(Array.from({ length: 6 }, (_, i) => post({ ...validReading, student_id: `concurrent-${i}` })));
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409, 409, 409, 409, 409]);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM noise_readings")).rows[0].n, 1);
});

test("una inserción fallida revierte la transacción y libera el bloqueo", async () => {
  const { noiseReadingRepository } = await import("../../src/repositories/noise-reading.repository.js");
  await assert.rejects(noiseReadingRepository.create({
    timestamp: new Date(validReading.timestamp), latitude: validReading.latitude,
    longitude: validReading.longitude, studentId: "x".repeat(51),
    authHash: validReading.auth_hash, domainData: validReading.domain_data,
  }));
  assert.equal((await post(validReading)).status, 201);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM noise_readings")).rows[0].n, 1);
});

test("400 para payload inválido sin insertar, 404 para ruta desconocida", async () => {
  const response = await post({ ...validReading, latitude: 91 });
  assert.equal(response.status, 400);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.equal((await fetch(apiUrl + "/missing")).status, 404);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM noise_readings")).rows[0].n, 0);
});

test("HU-18: auditoría detecta datos corruptos y pares cercanos sin modificar filas", async () => {
  const insert = (latitude: number, data: unknown) => pool.query(`
    INSERT INTO noise_readings(timestamp, latitude, longitude, student_id, auth_hash, domain_data)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [validReading.timestamp, latitude, validReading.longitude, validReading.student_id, validReading.auth_hash, JSON.stringify(data)]);
  await insert(validReading.latitude, validReading.domain_data);
  await insert(validReading.latitude, { ...validReading.domain_data, value_db: 200, noise_min_db: 70, noise_avg_db: 60, noise_max_db: 50, recording_duration_ms: 0 });
  await insert(91, { ...validReading.domain_data, value_db: "invalid" });
  const client = await pool.connect();
  try {
    const report = await auditNoiseReadings(client, "America/Guatemala");
    assert.equal(report.schema.columns.length, 8);
    assert.equal(report.quality.total_readings, 3);
    assert.equal(report.quality.invalid_coordinates, 1);
    assert.equal(report.quality.db_out_of_range, 1);
    assert.equal(report.quality.inconsistent_min_avg_max, 1);
    assert.equal(report.quality.value_metric_mismatch, 1);
    assert.equal(report.quality.malformed_domain_data, 1);
    assert.equal(report.quality.invalid_duration, 1);
    assert.equal(report.quality.nearby_same_day_pairs, 1);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM noise_readings")).rows[0].n, 3);
  } finally { client.release(); }
});

test("HU-18: maneja una tabla vacía y JSON nulo sin ocultar datos faltantes", async () => {
  const client = await pool.connect();
  try {
    const empty = await auditNoiseReadings(client, "America/Guatemala");
    assert.equal(empty.quality.total_readings, 0);
    assert.equal(empty.quality.first_measurement, null);
    await client.query(`INSERT INTO noise_readings(timestamp, latitude, longitude, student_id, auth_hash, domain_data)
      VALUES ($1, 0, 0, '', 'bad-hash', 'null'::jsonb)`, [validReading.timestamp]);
    const report = await auditNoiseReadings(client, "America/Guatemala");
    assert.equal(report.quality.total_readings, 1);
    assert.equal(report.quality.malformed_domain_data, 1);
    assert.equal(report.quality.invalid_student_ids, 1);
    assert.equal(report.quality.non_sha256_hash_format, 1);
  } finally { client.release(); }
});
