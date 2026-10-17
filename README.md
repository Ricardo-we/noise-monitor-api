# Noise Monitor API · Grupo 1

Backend REST para recibir, validar, guardar y consultar mediciones de ruido.
La aplicación móvil calcula las métricas; esta API recibe JSON y usa PostgreSQL
mediante Prisma. El repositorio no incluye el frontend ni almacena archivos de audio.

**Documentación revisada:** 17 de octubre de 2026, sobre `main` en `b33ded9`.
**Paquete:** `noise_recopiler_api` · **Versión declarada:** `1.0.0`.

[Documentación completa](docs/README.md) · [Instalación](docs/01-instalacion/README.md) · [Referencia HTTP](docs/04-api/README.md) · [OpenAPI](docs/04-api/openapi.yaml) · [Pruebas](docs/08-pruebas/README.md)

## Qué resuelve

| Capacidad | Comportamiento actual |
| --- | --- |
| Guardar una medición | Valida coordenadas, timestamp, carné, hash recibido y métricas; responde con el identificador de la fila. |
| Prevenir mediciones cercanas, HU-08 | Rechaza otra lectura a **50 metros o menos** en el mismo día local, considerando a todos los estudiantes. |
| Consultar datos, HU-30 | Devuelve páginas de **20** por defecto, hasta **100** por solicitud, con total y navegación. |
| Controlar consumidores | Exige encabezado **`x-api-key` si `API_KEY` está definida** en el servidor. |
| Comprobar conexión | Health-check público ejecuta un ping contra la BD. |
| Revisar calidad, HU-18 | Script de solo lectura inspecciona estructura y genera conteos de anomalías. |

La API key no verifica la identidad del estudiante. `auth_hash` se almacena sin
comprobar su autenticidad; no sustituye la clave de acceso. Los datos históricos
se devuelven como están almacenados y pueden requerir revisión de calidad.

## Inicio rápido

### Requisitos

Git, npm, una versión de Node compatible y acceso autorizado a una base PostgreSQL
con `public.noise_readings` ya preparada. Prisma 7.10 requiere
**`^20.19 || ^22.12 || >=24.0`**, aunque el paquete raíz declare `>=20`.
Docker solo se necesita para las pruebas de integración locales.

### Instalar y arrancar

```bash
git clone https://github.com/Ricardo-we/noise-monitor-api.git
cd noise-monitor-api
npm ci
cp .env.example .env
```

En PowerShell, el último comando es `Copy-Item .env.example .env`.
Si ya existe `.env`, conservá sus valores. Completá `DB_URL` con la conexión
autorizada y reemplazá el marcador `API_KEY` por la clave del entorno.

```bash
npm run prisma:generate
npm run typecheck
npm run dev
```

El arranque valida variables, conecta a la BD y ejecuta un ping antes de abrir
HTTP. Generar Prisma **no crea tablas ni aplica migraciones**. La preparación
de una base nueva y los cambios de esquema requieren el procedimiento del equipo.

### Comprobar disponibilidad y lectura

```bash
curl -i http://localhost:3000/api/health-check
```

```json
{ "status": "ok", "database": "ok" }
```

Para consultar, definí en la terminal del cliente `NOISE_API_KEY` con la clave
que el servidor tiene como `API_KEY`, y ejecutá:

```bash
curl -i 'http://localhost:3000/api/records?page=1&limit=2' \
  -H "x-api-key: ${NOISE_API_KEY}"
```

`NOISE_API_KEY` es solo una variable de los ejemplos del cliente; no la lee la
API. `.env` no se carga automáticamente en la terminal de curl.
El recorrido completo, incluidos Windows y resolución de fallos, está en
[instalación](docs/01-instalacion/README.md).

## Endpoints

Base local: `http://localhost:3000`. No se afirma una URL pública de despliegue.

| Método | Ruta | Resultado habitual | Documentación |
| --- | --- | --- | --- |
| GET | `/api/health-check` | 200 con estado API/BD; 503 si falla el ping. | [Estado del servicio](docs/04-api/estado-servicio/README.md). |
| POST | `/api/save-audio-record` | 201 con resumen; 409 si ya hay lectura cercana ese día. | [Guardar medición](docs/04-api/guardar-medicion/README.md). |
| GET | `/api/records?page=1&limit=20` | 200 con `data` y `pagination`. | [Consultar registros](docs/04-api/consultar-registros/README.md). |

POST de guardado y GET de registros usan `x-api-key` cuando está configurada.
Si `API_KEY` está **ausente**, esas rutas permiten acceso sin clave. Si está
**vacía**, falla el arranque. El health-check permanece público.
El contrato completo incluye campos, ejemplos, errores y límites en
[referencia HTTP](docs/04-api/README.md) y [openapi.yaml](docs/04-api/openapi.yaml).
No hay una ruta `/docs` o Swagger UI servida por Express: `/docs` es una carpeta del repositorio.

## Configuración esencial

| Variable | Uso |
| --- | --- |
| `DB_URL` | Conexión PostgreSQL, obligatoria. La API no usa `DATABASE_URL`. |
| `API_KEY` | Clave exigida a consumidores de las rutas protegidas si se define. |
| `PORT`, `HOST` | Predeterminados `3000` y `0.0.0.0`. |
| `NODE_ENV` | `development`, `production` o `test`; predeterminado development. |
| `CORS_ORIGIN` | `*` o lista de orígenes separados por comas. |
| `MEASUREMENT_TIME_ZONE` | Día calendario de HU-08; predeterminado `America/Guatemala`. |
| `LOG_LEVEL` | Nivel del logger propio; predeterminado `info`. |

Ver [configuración detallada](docs/02-configuracion/README.md) para validación,
prioridades, TLS y diferencias entre variables del servidor y de pruebas.

## Estructura

```text
noise-monitor-api/
├── README.md                 # Entrada al proyecto
├── docs/                     # Índice, guías, OpenAPI, ejemplos e informes
├── src/
│   ├── index.ts              # Arranque y cierre
│   ├── app/                  # Rutas, controladores, middlewares y esquemas
│   ├── repositories/         # Consultas y transacciones de la API
│   ├── lib/                  # Entorno, Prisma, errores y logger
│   └── types/                # Tipos compartidos del dominio
├── prisma/schema.prisma      # Modelo de noise_readings
├── prisma.config.ts          # Configuración del CLI
├── scripts/                  # Auditoría HU-18
├── tests/                    # Validación, HTTP e integración PostgreSQL
├── .env.example              # Plantilla sin credenciales reales
└── package-lock.json         # Versiones de dependencias
```

Flujo: **ruta → API key → validación → controlador → repositorio → Prisma → PostgreSQL**.
La [arquitectura](docs/03-arquitectura/README.md) explica las diferencias entre
los flujos de guardado, consulta y health-check.

## Comandos habituales

| Comando | Función |
| --- | --- |
| `npm run dev` | Desarrollo con recarga. |
| `npm run prisma:generate` | Generar el cliente Prisma local. |
| `npm run typecheck` | Revisar tipos sin emitir archivos. |
| `npm test` | Pruebas de esquemas y HTTP con repositorio sustituido. |
| `npm run test:integration` | HTTP y PostgreSQL local descartable; requiere preparación e aislamiento de entorno. |
| `npm run build` | Compilar a dist. |
| `npm start` | Ejecutar `dist/src/index.js`. |
| `npm run data:quality` | Auditar la BD configurada, en solo lectura; guarda reporte local. |
| `npm run prisma:studio` | Abrir explorador Prisma, con capacidad de editar datos. |
| `npm run prisma:migrate` | Herramienta de migración de desarrollo; requiere plan y entorno adecuado. |
| `npm run prisma:deploy` | Aplicar migraciones versionadas aprobadas; no hay historial inicial incluido. |

El comando de integración no debe apuntar a Neon. La suite vacía su tabla local
antes de cada caso. Seguí la [guía reproducible de pruebas](docs/08-pruebas/README.md).

## Seguridad y límites conocidos

Se usan Helmet, validación estricta, consultas parametrizadas, límite de JSON y
API key configurable. GET no selecciona la columna `auth_hash`; sí entrega carné,
coordenadas y el JSON almacenado. CORS no sustituye autenticación.

No hay identidad por estudiante, roles, rate limiting ni HTTPS gestionado por
Node. La precisión acústica y escala de dB deben acordarse con el cliente.
Las páginas pueden desplazarse si cambia la tabla entre peticiones.
Más detalles: [seguridad](docs/07-seguridad/README.md),
[reglas y calidad](docs/06-reglas-y-calidad/README.md) y
[operación](docs/09-operacion/README.md).

## Contribuir y revisar

Trabajá en una rama, verificá el cambio y publicá un pull request para revisión
de Ricardo antes de integrar. No subir `.env`, claves, reportes privados ni datos
individuales de la BD. Ver [flujo de contribución](docs/10-contribucion/README.md).

Los informes anteriores se conservan como evidencia fechada; el índice distingue
esas entregas del contrato vigente. Consultá [trazabilidad](docs/12-trazabilidad/README.md)
para referencias y verificación de esta edición.

El campo `license` de `package.json` declara `ISC`; la base revisada no contiene
un archivo LICENSE independiente. Esta documentación no agrega ni modifica términos de licencia.
