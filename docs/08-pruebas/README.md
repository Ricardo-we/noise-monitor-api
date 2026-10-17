# 08 · Pruebas y verificación reproducible

[Índice](../README.md) · [Referencia HTTP](../04-api/README.md) · [Trazabilidad](../12-trazabilidad/README.md)

## Qué se verifica

| Verificación | Comando | Dependencias y efecto |
| --- | --- | --- |
| Generación del cliente | `npm run prisma:generate` | Usa el modelo Prisma; genera archivos, sin modificar BD. |
| Tipos | `npm run typecheck` | Revisa TypeScript sin emitir archivos. |
| Contratos y HTTP con repositorio sustituido | `npm test` | No necesita una BD real disponible. |
| Compilación | `npm run build` | Emite `dist/`, incluido `dist/src/index.js`. |
| HTTP + PostgreSQL real local | `npm run test:integration` | Crea una tabla y la vacía antes de cada caso en una base descartable. |
| Auditoría de una BD existente | `npm run data:quality` | Solo lectura; no es sustituto de las pruebas anteriores. |

El conteo verificado de esta entrega se registra en
[evidencia del 17 de octubre](../evidencia/DOCUMENTACION_API_2026-10-17.json).
Los resultados son de la versión y entorno probados; no certifican el despliegue.

## Recorrido A: comprobaciones sin tocar Neon

Desde la raíz, macOS/Linux/Git Bash:

```bash
npm ci
DB_URL='postgresql://noise_test:noise_test@127.0.0.1:55432/noise_monitor_test?sslmode=disable' npm run prisma:generate
npm run typecheck
npm test
npm run build
```

La URL de `prisma:generate` es sintética y apunta a localhost; no hace falta
conectarse a ella para generar. Los tests HTTP sustituyen métodos del repositorio
y configuran un entorno de prueba dentro de sus procesos.

En PowerShell, la asignación equivalente antes de un comando se hace así:

```powershell
$env:DB_URL = 'postgresql://noise_test:noise_test@127.0.0.1:55432/noise_monitor_test?sslmode=disable'
npm run prisma:generate
```

## Recorrido B: integración con PostgreSQL descartable

Las credenciales `noise_test` son exclusivas del contenedor de ejemplo. Iniciá
Docker Desktop antes de los comandos. El puerto 55432 debe estar disponible.

```bash
docker run --detach --rm --name noise-monitor-docs-test \
  -e POSTGRES_USER=noise_test \
  -e POSTGRES_PASSWORD=noise_test \
  -e POSTGRES_DB=noise_monitor_test \
  -p 127.0.0.1:55432:5432 postgres:17-alpine
```

Comprobá disponibilidad; si todavía está arrancando, repetí la comprobación
hasta recibir `accepting connections`:

```bash
docker exec noise-monitor-docs-test pg_isready -U noise_test -d noise_monitor_test
```

La suite de integración actual no envía API key. Para ejecutarla de forma
independiente de la clave que tengas en `.env`, utilizá un archivo dotenv vacío
temporal y eliminá `API_KEY` solo del proceso de prueba:

```bash
NOISE_EMPTY_ENV=$(mktemp)
env -u API_KEY DOTENV_CONFIG_PATH="$NOISE_EMPTY_ENV" \
  TEST_DB_URL='postgresql://noise_test:noise_test@127.0.0.1:55432/noise_monitor_test?sslmode=disable' \
  npm run test:integration
rm "$NOISE_EMPTY_ENV"
```

No se edita tu `.env` ni se desactiva la clave del servidor que tengas abierto.
El aislamiento es necesario porque la suite cambia `DB_URL` y zona, pero no
sobrescribe `API_KEY`; dotenv podría cargar la de tu entorno local. El archivo
temporal vacío evita esa herencia sin introducir una cadena `API_KEY=""`, que
el esquema rechazaría.

Equivalente para la invocación de integración en PowerShell:

```powershell
$savedApiKey = $env:API_KEY
$savedDotenvPath = $env:DOTENV_CONFIG_PATH
$savedTestDbUrl = $env:TEST_DB_URL
$noiseEmptyEnv = New-TemporaryFile
try {
  Remove-Item Env:API_KEY -ErrorAction SilentlyContinue
  $env:DOTENV_CONFIG_PATH = $noiseEmptyEnv.FullName
  $env:TEST_DB_URL = 'postgresql://noise_test:noise_test@127.0.0.1:55432/noise_monitor_test?sslmode=disable'
  npm run test:integration
} finally {
  $env:API_KEY = $savedApiKey
  $env:DOTENV_CONFIG_PATH = $savedDotenvPath
  $env:TEST_DB_URL = $savedTestDbUrl
  Remove-Item $noiseEmptyEnv.FullName
}
```

La sintaxis PowerShell se ofrece como equivalencia; la ejecución de esta entrega
se verificó en macOS. Al terminar, eliminá solo el contenedor descartable:

```bash
docker stop noise-monitor-docs-test
```

Por `--rm`, Docker elimina ese contenedor al detenerlo. No se usa un volumen
persistente ni se toca la BD de Neon.

## Barreras de la suite de integración

`TEST_DB_URL` es obligatoria. Solo se admiten `127.0.0.1`, `localhost` o `[::1]`
y una ruta de base exactamente `/noise_monitor_test`. La suite usa
`TRUNCATE noise_readings` antes de cada caso: la base debe ser exclusivamente
de pruebas, aun cuando pase las comprobaciones de nombre y host.

La suite crea su tabla de prueba si no existe. No es un migrador de producción.
No se debe sustituir la URL de ejemplo por la del equipo para «hacerla más real».

## Cobertura funcional existente

| Área | Casos principales |
| --- | --- |
| Esquema de guardado | Payload válido, offsets, coordenadas, fecha, carné y JSON inválidos. |
| Consulta | Parámetros inválidos antes de acceso a BD, error de conexión, vacíos, límites, varias páginas, empates y fechas ISO. |
| Proyección de registros | Exclusión de la columna auth_hash y conservación de JSON histórico incompleto o nulo. |
| HU-08 | 0/49.99/50/50.01 m, cambio de día, distintas fechas UTC, antimeridiano y polos. |
| Concurrencia y rollback | Seis guardados simultáneos con un solo 201, y liberación del bloqueo tras fallo de inserción. |
| HU-18 | Datos sintéticos corruptos, nulos y pares cercanos, sin modificación por el auditor. |
| Health-check | 200 con ping exitoso y 503 con fallo. |

Los tests actuales usan una clave sintética válida para consultar en la suite
HTTP, pero no constituyen una cobertura completa de todos los escenarios de
autenticación. En esta entrega documental se verifican además manualmente, por
HTTP local, clave ausente, incorrecta y correcta, y health-check público.

## Cómo interpretar un resultado

- Tipos y build aprobados: el código compila; no garantiza disponibilidad de Neon.
- Integración aprobada: comportamiento con PostgreSQL local y datos sintéticos; no acredita calidad de datos reales.
- Auditoría aprobada: pudo generar un reporte; no significa cero anomalías.
- `npm audit`: revisión de dependencias aparte; no debe resolverse con actualizaciones forzadas sin analizar compatibilidad.

Esta entrega añade documentación y ejemplos, sin alterar la lógica de la API
ni crear pruebas permanentes que dupliquen su implementación.
