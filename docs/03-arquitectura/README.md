# 03 · Arquitectura y recorrido de las peticiones

[Índice](../README.md) · [Anterior: configuración](../02-configuracion/README.md) · [Siguiente: API](../04-api/README.md)

## Responsabilidad del backend

Recibir mediciones numéricas de ruido, validarlas, aplicar la regla geográfica
del día, persistirlas y exponer consultas paginadas. La API no captura el audio
del micrófono, no calcula sus decibeles y no recibe archivos WAV/MP3. El cliente
calcula y envía las métricas en JSON.

```text
Aplicación móvil / consumidor autorizado
                    |
                    | HTTP + JSON (+ x-api-key en rutas protegidas)
                    v
         Express: middlewares y rutas /api
                    |
            validación con Zod
                    |
                controlador
                    |
                repositorio
                    |
         Prisma Client + adapter-pg / pg
                    |
                    v
       PostgreSQL: public.noise_readings
```

## Mapa de archivos

| Capa | Archivos | Decisión de diseño |
| --- | --- | --- |
| Arranque | `src/index.ts` | Verifica BD antes de abrir HTTP y registra apagado. |
| Construcción de aplicación | `src/app/app.ts` | Separa `createApp()` de `listen()` para probar en un puerto temporal. |
| Rutas | `src/app/routes/` | Expresan método, URL y secuencia de middlewares. |
| Seguridad de acceso | `src/app/middlewares/api-key.ts` | Compara el encabezado con la clave de entorno cuando existe. |
| Validación | `schemas/`, `middlewares/validate.ts` | Mantiene contratos y conversiones antes del acceso a datos. |
| Controladores | `src/app/controllers/` | Traducen entradas y filas al contrato HTTP. |
| Repositorio | `src/repositories/noise-reading.repository.ts` | Concentra consultas de Prisma y transacciones de la API. |
| Infraestructura | `src/lib/` | Entorno, conexión, normalización de URL, errores y logs. |
| Tipos | `src/types/noise-reading.ts` | Describe payload y resultado de guardado. |
| Modelo | `prisma/schema.prisma` | Mapea camelCase de código a columnas snake_case. |
| Auditoría | `scripts/audit-data-quality.ts`, `scripts/lib/data-quality.ts` | Usa `pg` directamente para inspección y conteos de solo lectura; no es una ruta HTTP. |
| Pruebas | `tests/` | Casos de esquema, HTTP y PostgreSQL local. |

## Orden global de middlewares

1. Desactivar `x-powered-by`.
2. Aplicar Helmet.
3. Analizar JSON con límite `64kb`.
4. Aplicar CORS con `credentials: false`.
5. Registrar método, URL, estado y duración.
6. Resolver rutas bajo `/api`.
7. Generar `404` si no hay coincidencia.
8. Traducir errores al formato de la API.

El JSON se analiza **antes** de verificar la API key. Un JSON mal formado puede
devolver `400 INVALID_JSON` aunque falte la clave. El preflight de CORS puede
resolverse antes del logger y de la autenticación; no equivale a leer registros.

## Flujo de guardado: HU-08

```text
POST /api/save-audio-record
  → comprobar API key, si está configurada
  → validar body estricto y recortar ciertos textos
  → convertir timestamp a Date
  → iniciar transacción ReadCommitted
  → adquirir bloqueo transaccional por día local
  → buscar cualquier medición del día a <=50 m
      → existe: error 409 y rollback
      → no existe: insertar y confirmar
  → responder 201 con resumen del registro
```

El bloqueo `pg_advisory_xact_lock` usa una clave de dominio `5008` y el día
calendario. La búsqueda se ejecuta en otra consulta después de adquirirlo para
ver guardados confirmados mientras se esperaba. Esto protege solicitudes que
usan este mismo flujo incluso desde varias instancias de la API.

La distancia se calcula con Haversine y radio terrestre `6371008.8 m`. No
requiere PostGIS. El bloqueo se libera al confirmar o revertir la transacción.
Una escritura directa desde otro cliente no participa de este mecanismo.

## Flujo de consulta: HU-30

```text
GET /api/records?page=2&limit=20
  → comprobar API key, si está configurada
  → validar query y guardarla en res.locals.query
  → calcular skip = (page - 1) * limit
  → consultar filas y count en RepeatableRead
  → proyectar siete campos y fechas ISO UTC
  → responder 200 con data y pagination
```

La transacción hace que conteo y página correspondan a una misma instantánea
dentro de una petición. No conserva esa instantánea al pasar a la siguiente
página en otra petición. Ordenar por timestamp y UUID resuelve empates sobre un
conjunto estable; no evita desplazamientos si ese conjunto cambia.

## Salud, conexión y cierre

`GET /api/health-check` ejecuta `SELECT 1`: comprueba conexión, no existencia de
la tabla ni capacidad de insertar. Usa un contrato distinto al de errores generales.

El cliente Prisma se reutiliza en `globalThis` fuera de producción para evitar
crear pools adicionales por recargas. En producción se conserva la instancia
del módulo. `SIGINT` y `SIGTERM` cierran HTTP y después Prisma; no hay un timeout
de apagado implementado para peticiones que no terminen.

## Límites de esta arquitectura

No hay colas, microservicios, caché, jobs ETL, WebSockets, almacenamiento de
archivos ni dashboard en este repositorio. No se incluye un servidor Swagger
en ejecución: OpenAPI es un archivo documental importable.

El diseño usa pocas capas para que cada una tenga una responsabilidad visible.
Cambiar una regla requiere revisar contrato, repositorio, documentación y
pruebas; cambiar una URL solo en un ejemplo no modifica el servicio.

Referencias de apoyo: [aislamiento en PostgreSQL](https://www.postgresql.org/docs/17/transaction-iso.html)
y [`req.query` en Express 5](https://expressjs.com/en/guide/migrating-5.html#req.query).
