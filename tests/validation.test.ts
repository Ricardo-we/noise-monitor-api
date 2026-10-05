import assert from "node:assert/strict";
import { test } from "node:test";
import { saveAudioRecordSchema } from "../src/app/schemas/save-audio-record.schema";
import { validReading } from "./fixtures";

test("acepta una medición válida con offset horario", () => {
  assert.equal(saveAudioRecordSchema.safeParse({ ...validReading, timestamp: "2026-10-05T12:00:00-06:00" }).success, true);
});

for (const [field, value] of [["latitude", 91], ["longitude", -181], ["timestamp", "2026-10-05"], ["student_id", " "]] as const) {
  test(`rechaza ${field} inválido`, () => {
    assert.equal(saveAudioRecordSchema.safeParse({ ...validReading, [field]: value }).success, false);
  });
}

test("rechaza datos incompletos, claves desconocidas y dB fuera de rango", () => {
  assert.equal(saveAudioRecordSchema.safeParse({ timestamp: validReading.timestamp }).success, false);
  assert.equal(saveAudioRecordSchema.safeParse({ ...validReading, unknown: true }).success, false);
  assert.equal(saveAudioRecordSchema.safeParse({ ...validReading, domain_data: { ...validReading.domain_data, value_db: 151 } }).success, false);
});
