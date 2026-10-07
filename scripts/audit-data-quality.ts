import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { toPostgresConnectionString } from "../src/lib/db-url";
import { auditNoiseReadings } from "./lib/data-quality";

async function main() {
  const connectionString = process.env.DB_URL;
  if (!connectionString || connectionString.includes("USER:PASSWORD") || connectionString.includes("ep-xxx")) {
    throw new Error("DB_URL_MISSING");
  }
  const pool = new Pool({ connectionString: toPostgresConnectionString(connectionString), connectionTimeoutMillis: 10000 });
  try {
    const client = await pool.connect();
    try {
      const report = await auditNoiseReadings(client, process.env.MEASUREMENT_TIME_ZONE ?? "America/Guatemala");
      const outputDir = resolve("reports");
      await mkdir(outputDir, { recursive: true });
      const outputPath = resolve(outputDir, `data-quality-${report.generated_at.replace(/[:.]/g, "-")}.json`);
      await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
      console.log("Auditoría de solo lectura guardada en:", outputPath);
      console.log(JSON.stringify(report.quality, null, 2));
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const knownMessage = error instanceof Error && ["DB_URL_MISSING", "TABLE_NOT_FOUND"].includes(error.message) ? error.message : undefined;
  const code = knownMessage ?? (typeof error === "object" && error !== null && "code" in error ? String(error.code) : "AUDIT_FAILED");
  console.error(`No se completó la auditoría (${code}). Revisa el acceso a Neon y la existencia de public.noise_readings.`);
  process.exitCode = 1;
});
