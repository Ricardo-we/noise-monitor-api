# noise_recopiler_api

API REST mínima que recibe las lecturas de ruido del app móvil y las guarda en **Neon (PostgreSQL)** mediante **Prisma**.
El frontend ya no habla con la base de datos: solo consume esta API.

- Node.js + TypeScript + Express 5
- Prisma 7 con driver adapter `@prisma/adapter-pg`
- Validación de entrada con Zod
- Logger en formato JSON, sin dependencias extra

---

## 1. Puesta en marcha

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
```

Edita `.env` y pega la cadena de conexión de Neon **con usuario y contraseña**:

```env
DB_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

> En Neon usa el host con `-pooler` para la API (connection pooler) y el host **sin** `-pooler` para migraciones.
> `?sslmode=require` es obligatorio en Neon.

Genera el cliente de Prisma y arranca:

```bash
npm run prisma:generate
npm run dev
```

El servidor verifica la conexión con la base de datos al arrancar; si `DB_URL` falla, la API no levanta y lo indica en el log.

| Script                 | Descripción                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Desarrollo con recarga (`tsx watch`)           |
| `npm run build`        | Compila TypeScript a `dist/`                   |
| `npm start`            | Ejecuta la build (`node dist/src/index.js`)    |
| `npm run typecheck`    | Revisa tipos sin emitir archivos               |
| `npm run prisma:generate` | Regenera el cliente de Prisma               |
| `npm run prisma:studio`   | Abre Prisma Studio contra la BD              |

---

## 2. Estructura del proyecto

```
.
├── prisma.config.ts            # Configuración del CLI de Prisma (lee DB_URL)
├── prisma/schema.prisma        # Modelo de la tabla noise_readings
├── src/
│   ├── index.ts                # Arranque, verificación de BD y apagado ordenado
│   ├── app/
│   │   ├── app.ts              # Construcción de la app Express (middlewares)
│   │   ├── routes/             # Rutas HTTP agrupadas bajo /api
│   │   ├── controllers/        # Lógica de cada endpoint
│   │   ├── schemas/            # Esquemas Zod (validación + tipos)
│   │   └── middlewares/        # validate, request-logger, not-found, error-handler
│   ├── lib/                    # env, prisma (conexión), logger, http-error
│   ├── repositories/           # Acceso a datos (única capa que usa Prisma)
│   └── types/                  # Tipos de dominio compartidos con el frontend
└── .env                        # Variables de entorno (no se versiona)
```

Flujo de una petición: `route → middleware validate (Zod) → controller → repository → Prisma → Neon`.

---

## 3. Endpoint disponible

### `POST /api/save-audio-record`

Guarda una lectura de ruido. La tabla ya existe en Neon (ver [sección 4](#4-tabla-en-neon)).

**Request**

```http
POST /api/save-audio-record
Content-Type: application/json
```

```json
{
  "timestamp": "2026-09-27T14:32:10.512Z",
  "latitude": 19.4326,
  "longitude": -99.1332,
  "student_id": "student-001",
  "auth_hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "domain_data": {
    "metric": "avg",
    "value_db": 62.4,
    "noise_min_db": 48.1,
    "noise_max_db": 78.9,
    "noise_avg_db": 62.4,
    "recording_duration_ms": 3000,
    "device_model": "Pixel 8",
    "app_version": "1.0.0"
  }
}
```

**Response `201 Created`**

```json
{
  "data": {
    "reading_id": "0f1b0f0e-2a52-4b1e-9a2c-1f0f0c8b7a11",
    "student_id": "student-001",
    "metric": "avg",
    "value_db": 62.4,
    "created_at": "2026-09-27T14:32:10.780Z"
  }
}
```

#### Reglas de validación

| Campo                     | Regla                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| `timestamp`               | Fecha ISO 8601 con offset (`2026-09-27T14:32:10.512Z`)            |
| `latitude`                | `-90` a `90`                                                       |
| `longitude`               | `-180` a `180`                                                     |
| `student_id`              | Texto, 1 a 50 caracteres                                            |
| `auth_hash`               | Texto, 1 a 64 caracteres                                            |
| `domain_data.metric`      | `min` \| `max` \| `avg`                                             |
| `domain_data.*_db`        | Número entre `-160` y `150` dB (cubre dB SPL y dBFS)                |
| `domain_data.value_db`    | Convención del cliente: debe ser el valor de la métrica indicada (no se valida) |
| `recording_duration_ms`   | Entero `1` a `300000`                                               |
| `device_model`            | Texto, 1 a 120 caracteres                                            |
| `app_version`             | Texto, 1 a 40 caracteres                                             |

El objeto es **estricto**: cualquier clave desconocida (en la raíz o en `domain_data`) se rechaza con `400`.

#### Errores

Todos los errores usan la misma forma:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El cuerpo de la petición no es válido",
    "details": [
      { "path": "domain_data.metric", "message": "Invalid option: expected one of \"min\"|\"max\"|\"avg\"", "code": "invalid_value" }
    ]
  }
}
```

| Código HTTP | `error.code`        | Cuándo ocurre                                        |
| ----------- | ------------------- | ---------------------------------------------------- |
| `400`       | `VALIDATION_ERROR`  | El body no cumple el esquema                          |
| `400`       | `INVALID_JSON`      | El body no es JSON válido                            |
| `404`       | `NOT_FOUND`         | La ruta no existe                                     |
| `409`       | `DUPLICATE_RESOURCE`| Violación de clave única (Prisma `P2002`)             |
| `400`       | `FOREIGN_KEY_ERROR` | Clave foránea inválida (Prisma `P2003`)               |
| `500`       | `INTERNAL_ERROR`    | Error no previsto (en desarrollo incluye el detalle)  |
| `503`       | `DB_UNAVAILABLE`    | La base de datos no responde (Prisma `P1001`)          |

El mapeo completo de códigos de Prisma a códigos HTTP vive en `src/app/middlewares/error-handler.ts`.

---

## 4. Tabla en Neon

`prisma/schema.prisma` refleja exactamente el DDL ya creado en Neon:

```sql
CREATE TABLE noise_readings (
    reading_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    auth_hash VARCHAR(64) NOT NULL,
    domain_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Como la tabla **ya existe y la gestiona el frontend**, no se ejecutan migraciones automáticas al arrancar.
Si necesitas migrar el esquema con Prisma en el futuro:

```bash
npx prisma migrate dev --name descripcion_del_cambio
```

**Índices recomendados** cuando empiece a haber suficientes lecturas (no incluidos en el modelo para no generar drift):

```sql
CREATE INDEX IF NOT EXISTS noise_readings_student_timestamp_idx
    ON noise_readings (student_id, timestamp DESC);
```

---

## 5. Uso desde el frontend

```ts
const response = await fetch(`${API_URL}/api/save-audio-record`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    timestamp: new Date().toISOString(),
    latitude,
    longitude,
    student_id: studentId,
    auth_hash: hash,
    domain_data: {
      metric: "avg",
      value_db: metrics.avgDb,
      noise_min_db: metrics.minDb,
      noise_max_db: metrics.maxDb,
      noise_avg_db: metrics.avgDb,
      recording_duration_ms: metrics.durationMs,
      device_model: "Pixel 8",
      app_version: "1.0.0",
    },
  }),
});

if (response.status === 201) {
  const { data } = await response.json();
  console.log("guardado", data.reading_id);
}
```

`AudioMetrics` (camelCase del frontend) se convierte aquí a `domain_data` (snake_case para la BD).

### CORS

`CORS_ORIGIN` acepta `*` o una lista separada por comas:

```env
CORS_ORIGIN="https://mi-frontend.com,https://otro.com"
```

---

## 6. Notas sobre seguridad

- `auth_hash` llega sin verificar: la API solo lo persiste. Si más adelante quieres autenticación real,
  añade un middleware que valide `student_id` + `auth_hash` contra tu tabla de estudiantes.
- El pool de conexiones lo gestiona `@prisma/adapter-pg` a través del connection pooler de Neon;
  no es necesario añadir `pgbouncer` por tu cuenta.
