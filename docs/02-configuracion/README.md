# 02 · Configuración y variables de entorno

[Índice](../README.md) · [Anterior: instalación](../01-instalacion/README.md) · [Siguiente: arquitectura](../03-arquitectura/README.md)

La plantilla versionada es [`.env.example`](../../.env.example). El archivo local
`.env` contiene valores del entorno y está excluido de Git. `dotenv/config`
carga el archivo al iniciar la aplicación; las variables ya definidas en el
proceso tienen prioridad con la configuración actual de dotenv.

## Variables del servidor

| Variable | Predeterminado | Validación y efecto |
| --- | --- | --- |
| `DB_URL` | Ninguno; obligatoria. | Cadena no vacía. Se usa en Prisma y auditoría; una cadena no vacía pero incorrecta puede fallar al conectar. |
| `PORT` | `3000` | Se convierte a número; entero entre 1 y 65535. |
| `HOST` | `0.0.0.0` | Texto no vacío; dirección donde escucha HTTP. |
| `NODE_ENV` | `development` | Solo `development`, `production` o `test`. Controla detalles de errores y logs Prisma. |
| `API_KEY` | Ausente. | Texto de al menos un carácter, si se define. Protege POST de guardado y GET de registros. |
| `CORS_ORIGIN` | `*` | Texto con orígenes separados por coma. Se recortan espacios y se omiten entradas vacías. |
| `MEASUREMENT_TIME_ZONE` | `America/Guatemala` | Zona IANA válida. Define el día calendario de HU-08. |
| `LOG_LEVEL` | `info` | Leído directamente por el logger, fuera del esquema Zod. Usar `debug`, `info`, `warn` o `error`. Otros valores no se validan y su filtrado no es un contrato confiable. |

Si las variables validadas no cumplen el esquema, se imprime la lista de campos
inválidos y el proceso finaliza con código 1. Cambiar `.env` requiere reiniciar
el proceso; no hay recarga dinámica garantizada de secretos o configuración.

## Configuración de ejemplo

Todos los valores de conexión y clave siguientes son marcadores:

```dotenv
DB_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
PORT=3000
HOST=127.0.0.1
NODE_ENV=development
API_KEY="REEMPLAZAR_POR_LA_CLAVE_DEL_ENTORNO"
CORS_ORIGIN="http://localhost:5173"
MEASUREMENT_TIME_ZONE="America/Guatemala"
LOG_LEVEL=info
```

No reutilices los marcadores como claves de un despliegue. El repositorio no
crea, distribuye ni rota automáticamente las credenciales del equipo.

## API key: tres situaciones distintas

| Configuración | Resultado real |
| --- | --- |
| `API_KEY` definida y no vacía | Las dos rutas protegidas exigen `x-api-key` con el mismo valor. |
| Variable completamente ausente | El middleware permite continuar sin exigir clave. También ocurre en producción si se omite. |
| `API_KEY=""` | Falla la validación al arrancar; no desactiva la autenticación. |

El middleware comprueba existencia y coincidencia de bytes; no recorta espacios
ni exige una longitud criptográfica mínima. Una cadena de espacios podría
pasar la validación de entorno: el responsable debe establecer una clave adecuada.
El health-check permanece público en los tres escenarios válidos de ejecución.

## Conexión a PostgreSQL / Neon

La variable utilizada por este proyecto es **`DB_URL`**. Definir solamente
`DATABASE_URL` o `TEST_DB_URL` no configura el servidor de desarrollo.

La función `toPostgresConnectionString`:

1. Convierte un esquema inicial `http:` o `https:` en `postgresql:`.
2. Añade `sslmode=require` si no existe ese parámetro.
3. Conserva un `sslmode` ya proporcionado.
4. Devuelve la entrada original si no puede analizarla como URL; la conexión será quien rechace un valor inválido.

Para PostgreSQL local sin TLS, el ejemplo de pruebas especifica
`sslmode=disable` explícitamente. No se usa ese valor para Neon.
Si una contraseña contiene caracteres reservados de URL, debe estar codificada
correctamente en la cadena proporcionada por el administrador.

La API utiliza la conexión con `-pooler` para tráfico de aplicación. Las
operaciones administrativas como migraciones y respaldos necesitan revisar la
conexión directa y su autorización. No hay una segunda variable de conexión
directa implementada en este repositorio. Consultá [base de datos](../05-base-de-datos/README.md).

## CORS

```dotenv
CORS_ORIGIN="http://localhost:5173,https://frontend.example.org"
```

Los orígenes incluyen esquema, host y puerto cuando corresponda; no una ruta
como `/dashboard`. Con `*`, el middleware permite cualquier origen del navegador.
`credentials` está configurado en `false`; no se usa autenticación por cookie.
Los encabezados solicitados en preflight, incluido `x-api-key`, los maneja el
middleware CORS instalado. Se debe comprobar el origen efectivo del consumidor.

CORS es una política del navegador y no impide que un cliente HTTP externo
intente una petición. No sustituye la API key ni controla permisos por estudiante.

## Variables usadas únicamente en ejemplos y pruebas

| Variable | Consumidor | Aclaración |
| --- | --- | --- |
| `TEST_DB_URL` | Suite de integración. | Solo permite host local y base `noise_monitor_test`; reemplaza `DB_URL` dentro de esa suite. |
| `NOISE_API_KEY` | Ejemplos de `curl` y clientes. | No la lee el backend. Debe contener la clave configurada como `API_KEY` en el servidor. |

## Qué valores no se publican

El proyecto ignora `.env`, `.env.local`, `.env.*.local`, `reports/` y `requests/`.
El patrón no incluye automáticamente todo nombre imaginable de archivo secreto:
por ejemplo, no asumas que `.env.production` está ignorado sin comprobarlo.
Usá el mecanismo de secretos del entorno de despliegue o los nombres ya cubiertos.

Para comprobar exclusión sin mostrar el contenido:

```bash
git check-ignore .env
git status --short
```

Referencia de implementación: [env.ts](../../src/lib/env.ts),
[db-url.ts](../../src/lib/db-url.ts), [logger.ts](../../src/lib/logger.ts).
