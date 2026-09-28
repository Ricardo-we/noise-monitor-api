/**
 * Variables de entorno validadas y tipadas.
 * Falla el arranque si falta `DB_URL` o si algún valor es inválido.
 */
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DB_URL: z.string().min(1, "DB_URL es obligatoria (cadena de conexión de Neon)"),
  CORS_ORIGIN: z.string().default("*"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("\n");

  console.error(`[env] Configuración inválida:\n${details}`);
  console.error("[env] Copia .env.example a .env y completa los valores.");
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  /** Orígenes permitidos; `["*"]` significa "cualquiera". */
  corsOrigins: parsed.data.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
