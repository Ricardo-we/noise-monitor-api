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
> `?sslmode=require` es obligatorio en Neon; la API lo añade solo si falta (ver `src/lib/db-url.ts`).

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
| `npm test`            | Pruebas del contrato de entrada                |
| `npm run test:integration` | Pruebas HTTP y PostgreSQL local (requiere `TEST_DB_URL`) |
| `npm run data:quality` | Auditoría de solo lectura de `noise_readings` (HU-18) |
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
| `409`       | `NEARBY_READING_EXISTS` | Hay otra medición a 50 m o menos en el mismo día local (HU-08) |
| `400`       | `FOREIGN_KEY_ERROR` | Clave foránea inválida (Prisma `P2003`)               |
| `500`       | `INTERNAL_ERROR`    | Error no previsto (en desarrollo incluye el detalle)  |
| `503`       | `DB_UNAVAILABLE`    | La base de datos no responde (Prisma `P1001`)          |

El mapeo completo de códigos de Prisma a códigos HTTP vive en `src/app/middlewares/error-handler.ts`.

### HU-08: radio de 50 metros

Antes de insertar, la API busca **cualquier medición** del mismo día calendario
a una distancia **menor o igual a 50 metros**. Usa `timestamp` de la captura,
no `created_at`, y la zona `MEASUREMENT_TIME_ZONE` (por defecto `America/Guatemala`).
Los timestamps conservan su instante y se almacenan como `TIMESTAMPTZ`.
La distancia se calcula con Haversine y radio terrestre medio de 6 371 008,8 m;
no hace falta instalar PostGIS.

| Caso | Respuesta |
| --- | --- |
| Primera medición en la zona y el día | `201` |
| Otra a 49,99 m o exactamente 50 m ese día | `409` |
| Otra a 50,01 m ese día | `201` |
| Misma ubicación en un día local distinto | `201` |
| Otro estudiante mide dentro del radio ese día | `409` |

```json
{
  "error": {
    "code": "NEARBY_READING_EXISTS",
    "message": "Ya existe una medición a 50 metros o menos en el mismo día"
  }
}
```

Esta interpretación sigue la prevención de duplicados de HU-08 en el plan.
El alcance global, el límite inclusivo y la zona horaria son decisiones de esta
implementación para revisión del PM. Una referencia anterior del equipo hablaba
del último registro del día; esa interpretación produciría resultados distintos.

La búsqueda y la inserción se ejecutan en una transacción con bloqueo por día
y aislamiento `ReadCommitted`. La búsqueda ocurre **después** de adquirir el
bloqueo, en otra consulta, para detectar una inserción concurrente ya confirmada.
Todos los escritores deben usar este flujo y la misma zona horaria: una escritura
directa desde otro cliente no participa del bloqueo.

El bloqueo serializa los guardados de un día. Es adecuado para este prototipo;
si aumenta mucho el volumen, habrá que medir tiempos y revisar la estrategia.
La búsqueda filtra por un intervalo de timestamp, por lo que un índice en ese
campo puede ayudar. No se modifica automáticamente la tabla existente.

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

## 7. Pruebas reproducibles

```bash
npm ci
DB_URL='postgresql://noise_test:noise_test@127.0.0.1:55432/noise_monitor_test?sslmode=disable' npm run prisma:generate
npm run typecheck
npm test
npm run build
```

Para las pruebas contra PostgreSQL real, inicia Docker Desktop y crea una base
local descartable. Las credenciales siguientes son únicamente de prueba:

```bash
docker run --detach --rm --name noise-monitor-hu08-test \
  -e POSTGRES_USER=noise_test -e POSTGRES_PASSWORD=noise_test \
  -e POSTGRES_DB=noise_monitor_test -p 127.0.0.1:55432:5432 postgres:17-alpine

# Espera a que responda con "accepting connections".
docker exec noise-monitor-hu08-test pg_isready -U noise_test -d noise_monitor_test

TEST_DB_URL='postgresql://noise_test:noise_test@127.0.0.1:55432/noise_monitor_test?sslmode=disable' npm run test:integration

# Elimina exclusivamente el contenedor descartable de esta prueba.
docker stop noise-monitor-hu08-test
```

La suite de integración **vacía `noise_readings` antes de cada caso**.
Solo acepta un host local y la base `noise_monitor_test`. No la apuntes a Neon.
Comprueba guardado, radio, días y offsets, casos geográficos, concurrencia,
errores de entrada y el detector de calidad con datos sintéticos corruptos.

## 8. HU-18: revisión de estructura y calidad de datos

Configura la conexión real del equipo en `.env`, que está excluido de Git.
No sustituyas esta conexión por la base de otro ejercicio. Luego ejecuta:

```bash
npm run data:quality
```

El informe JSON se guarda en `reports/`, también excluido de Git. Revisa columnas,
tipos, nulos permitidos, valores predeterminados, restricciones e índices, y cuenta:

- Nulos en campos obligatorios y coordenadas inválidas.
- Carnés vacíos o de longitud incorrecta; hashes que no tienen formato SHA-256.
- JSON incompleto o con tipos incorrectos.
- dB fuera del rango vigente `[-160, 150]` y duración fuera de `1..300000` ms.
- Inconsistencia de mínimo, promedio y máximo, y diferencia entre `value_db` y su métrica.
- Pares de mediciones a 50 m o menos en el mismo día local, sin filtrar por estudiante.

La tolerancia de comparación de métricas es `0.000001` dB, un criterio técnico
del auditor. Los problemas pueden solaparse y los pares no son un conteo de
filas duplicadas. Un hash con formato correcto no acredita que sea auténtico.
La auditoría usa una transacción **READ ONLY** y no borra ni corrige datos.
La búsqueda de pares tiene un límite de ejecución de 60 segundos; si el volumen
lo supera, la auditoría falla explícitamente y debe programarse una revisión por lotes.

Las solicitudes rechazadas no se almacenan en la tabla actual. Para ese criterio,
se necesita revisar los logs con el responsable de despliegue. El resultado local
de pruebas no acredita calidad ni estructura de la instancia real de Neon.
