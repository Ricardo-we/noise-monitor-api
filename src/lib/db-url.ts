/**
 * Normaliza la cadena de conexión de Neon para el driver `pg`:
 *  - `https://host/db` -> `postgresql://host/db` (Neon también lo muestra así)
 *  - añade `?sslmode=require` si no viene indicado (Neon siempre exige TLS)
 *
 * Se usa tanto en la API como en `prisma.config.ts`.
 */
export function toPostgresConnectionString(rawUrl: string): string {
  const withScheme = /^(https?):\/\//i.test(rawUrl) ? rawUrl.replace(/^https?:/i, "postgresql:") : rawUrl;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return rawUrl;
  }

  if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");

  return url.toString();
}
