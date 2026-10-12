# HU-30: consulta de mediciones con paginación

Fecha: 10 de octubre de 2026. Responsable de esta entrega: Marvin Danilo Culajay Morejón.
Rama: `feat/marvin-hu30-records`. Base revisada: `main`, commit `2a6ce54`.
Estado: implementación y pruebas completadas; pendiente de validación e integración por Ricardo.

## 1. Qué pidió la tarea

La HU-30 compartida por el equipo pide crear un endpoint que devuelva los datos
registrados en la BD, con paginación para evitar exceso de datos, accesible desde
`api/records`. Ese es el requisito utilizado. Los mensajes sobre la hoja `reglas`
aportan contexto; no equivalen a aprobación de todas las reglas propuestas.

Se implementó **`GET /api/records`**. Es una consulta de la tabla existente
`noise_readings`: las filas vienen de PostgreSQL mediante Prisma.

## 2. Cómo entenderlo sin complicarse

Pensá en una lista de mediciones dividida en páginas. En un ejemplo de **55
mediciones**, pedir 20 por página produce tres páginas: 20, 20 y 15 registros.
Ese número es ilustrativo, no un conteo de la base del equipo.

```text
/api/records                    → primera página, hasta 20 mediciones
/api/records?page=2&limit=20     → segunda página, hasta 20 mediciones
/api/records?page=1&limit=100    → primera página, hasta 100 mediciones
```

`data` trae las mediciones de esa página. `pagination` dice qué página se pidió,
cuántas mediciones hay en total, cuántas páginas corresponden a ese tamaño y si
hay páginas anteriores o siguientes. El frontend puede construir los botones
de navegación con esta información.

## 3. Pasos realizados y por qué

| Paso | Qué se hizo | Por qué |
| --- | --- | --- |
| 1 | Se revisaron `main`, rutas, modelo Prisma, manejo de errores y pruebas existentes. | Integrar la tarea con la estructura que ya usa el equipo. |
| 2 | Se creó `feat/marvin-hu30-records` desde `main` actualizado. | Dar a Ricardo un cambio independiente para revisar antes de integrar. |
| 3 | Se agregó la ruta GET `/api/records`. | Cumplir la dirección solicitada por HU-30 usando un método de lectura. |
| 4 | Se validaron `page` y `limit` con Zod antes del acceso a datos. | Evitar consultas con valores inválidos o tamaños excesivos. |
| 5 | Se aplicaron `skip`, `take`, orden explícito y conteo en el repositorio. | Pedir a PostgreSQL solo las filas de la página, sin cargar toda la tabla en memoria. |
| 6 | Se consultaron página y total en una transacción `RepeatableRead`. | Mantener ambos resultados sobre la misma instantánea dentro de la petición. |
| 7 | Se seleccionaron siete campos y se formatearon fechas en ISO UTC. | Mantener nombres consistentes con la API y excluir `auth_hash`. |
| 8 | Se ejecutaron verificaciones de TypeScript, compilación, pruebas HTTP y PostgreSQL local. | Comprobar límites, navegación y compatibilidad con las funciones anteriores. |
| 9 | Se hizo un GET desde la API local conectado al Neon del equipo. | Confirmar que la implementación también puede leer la base real. |
| 10 | Se documentaron contrato, evidencia y decisiones para revisión. | Facilitar que Ricardo y los consumidores de la API puedan evaluar y utilizar el cambio. |

## 4. Decisiones propuestas para que Ricardo valide

HU-30 exige paginación, pero no fija estos detalles. Son criterios de la implementación:

| Decisión | Criterio utilizado | Motivo |
| --- | --- | --- |
| Forma de paginar | `page` y `limit`; comienza en página 1. | Permite solicitar directamente una página y mostrar el total. |
| Tamaño | 20 por defecto, máximo 100. | Reducir el volumen transferido por petición sin impedir recorrer la tabla. |
| Orden | `timestamp DESC`, después `reading_id DESC`. | Presentar capturas recientes y resolver empates de fecha de forma determinista. |
| Campos | `reading_id`, `timestamp`, `latitude`, `longitude`, `student_id`, `domain_data`, `created_at`. | Permitir el consumo de mediciones sin devolver el hash de autenticación almacenado. |
| JSON histórico | Se devuelve tal como está almacenado. | Evitar inventar métricas faltantes o esconder filas que requieren revisión de calidad. |
| Fecha | ISO 8601 UTC (`Z`). | Conservar el instante; cada tablero puede presentarlo en `America/Guatemala`. |
| Página inexistente | `200`, lista vacía y total real. | Permitir al consumidor reconocer que ya terminó el recorrido. |
| Parámetros inválidos | `400 VALIDATION_ERROR`; también para claves desconocidas o repetidas. | Hacer visibles los errores del consumidor. |
| Desplazamiento máximo | `page <= 2147483647` y `(page - 1) * limit <= 2147483647`. | Mantener la paginación dentro del rango técnico elegido de enteros de 32 bits. |

Se admiten enteros escritos como `1`, `2`, `20`. No se admiten `01`, espacios,
decimales, notación científica ni valores vacíos. Un `limit=101` se rechaza con
400, en lugar de cambiarlo silenciosamente. Los ejemplos completos de JSON están
en el [README](../README.md#3-endpoints-disponibles).

## 5. Cómo funciona por dentro

```text
GET /api/records?page=2&limit=20
  → ruta /api/records
  → validateQuery: valida y convierte los parámetros a números
  → controlador: usa los parámetros ya validados
  → repositorio: consulta página y total con Prisma
  → PostgreSQL: ordena, omite 20 filas y devuelve como máximo otras 20
  → controlador: entrega { data, pagination }
```

El desplazamiento se calcula como **`(page - 1) * limit`**. Página 1 omite cero;
página 2 con tamaño 20 omite 20. `total_pages = ceil(total / limit)`.
El conteo no devuelve todas las filas a la API: entrega un número.

En Express 5 se conserva `req.query` y el resultado validado se guarda en
`res.locals.query`. Se reutiliza el formato global de errores. El mensaje de
validación del body de las rutas anteriores permanece igual.

| Archivo | Responsabilidad |
| --- | --- |
| `src/app/schemas/records.schema.ts` | Validar y convertir parámetros de consulta. |
| `src/app/middlewares/validate.ts` | Ejecutar la validación y transmitir errores. |
| `src/app/routes/records.route.ts` y `routes/index.ts` | Registrar GET `/api/records`. |
| `src/app/controllers/records.controller.ts` | Convertir filas al contrato HTTP y construir metadatos. |
| `src/repositories/noise-reading.repository.ts` | Consultar PostgreSQL con Prisma. |
| `src/lib/http-error.ts` | Admitir un mensaje de validación específico para la consulta. |
| `tests/records.test.ts` | Comprobar rechazos antes de consultar y error de conexión. |
| `tests/integration/save-audio-record.test.ts` | Comprobar páginas, contenido y funciones existentes contra PostgreSQL. |

## 6. Evidencia de verificación

| Verificación | Resultado del 10/10/2026 |
| --- | --- |
| `npm run typecheck` | Aprobada. |
| `npm run build` | Aprobada. |
| `npm test` | 26 pruebas aprobadas, 0 fallidas. |
| `npm run test:integration` | 22 pruebas aprobadas, 0 fallidas, PostgreSQL 17 local. |
| Total | **48 pruebas aprobadas**: 25 anteriores y 23 nuevas de HU-30. |
| GET real en Neon, desde servidor local | HTTP 200; 2 filas solicitadas y devueltas; total de 137 en ese momento. |

La lectura real se realizó el **10/10/2026 a las 17:44:55, hora de Guatemala**
(`2026-10-10T23:44:55Z`). El total puede cambiar con el trabajo del equipo.
Se guardaron únicamente estado, conteo, nombres de campos y metadatos:
[evidencia JSON](evidencia/HU30_VERIFICACION_2026-10-10.json).
No se publican valores de carné, coordenadas ni credenciales reales en la evidencia.

Las pruebas verifican base vacía, lectura recién guardada, páginas completas y
parciales, máximo 100, navegación con fechas empatadas, repetición de la misma
página, páginas fuera de rango, JSON incompleto o nulo, exclusión de `auth_hash`,
conservación de filas y rechazo de consultas inválidas. También siguen pasando
las pruebas de guardado, HU-08, HU-18 y health-check.

Para reproducirlas, seguir la [sección de pruebas del README](../README.md#7-pruebas-reproducibles).
Las pruebas de integración crean y vacían una tabla exclusivamente en la base
local descartable `noise_monitor_test`. La comprobación en Neon fue de lectura;
no se hicieron inserciones, correcciones, migraciones ni cambios de esquema allí.

## 7. Alcance y asuntos pendientes

- La implementación está preparada para revisión. Ricardo decide la integración
  a `main` y el despliegue; una rama publicada no actualiza por sí sola el servidor.
- Esta HU no implementa autenticación ni verifica tokens. `student_id` y
  coordenadas siguen siendo datos entregados por la ruta. Se debe definir el
  acceso de consumidores y aprobar esos campos antes de exponerla públicamente
  (relación con HU-11). Excluir `auth_hash` no sustituye ese control.
- Se conservó `domain_data` completo. El equipo debe acordar su contrato para
  los consumidores y cómo tratar datos históricos incompletos.
- El orden es estable mientras el conjunto de datos no cambia. Entre solicitudes
  de páginas distintas, nuevas filas o borrados pueden desplazar registros.
  Para una exportación consistente durante escrituras continuas se debe evaluar
  paginación por cursor o una instantánea de exportación.
- El máximo de 100 limita filas transferidas; no garantiza un tamaño máximo en
  bytes del JSON. Conteos, ordenamiento y desplazamientos grandes pueden costar
  más a medida que crece la tabla. No se añadieron índices ni se prometen tiempos
  de respuesta bajo carga; eso requiere medición y acuerdo sobre esquema.
- No se agregaron filtros, cambios de escala ni nuevas reglas de negocio.

## 8. Qué pedirle a Ricardo

Validar que la respuesta y los campos sirven al consumidor, confirmar 20/100 y
el orden de capturas, y revisar los casos de prueba. Si está conforme, aprobar
la integración de la rama mediante pull request. Para acceso público, coordinar
el control de acceso de HU-11. No hace falta pedir una contraseña adicional ni
permisos para modificar tablas: la consulta usa la conexión local ya configurada.

## 9. Referencias técnicas

Se respetó la API del cliente Prisma 7.10 instalado (`findMany`, `skip`, `take`,
`select`, `count`, `$transaction`), comprobada mediante tipos y pruebas reales.
La documentación actual de Prisma consultada redirige a una API más reciente;
no se utilizó esa sintaxis para cambiar la versión del proyecto.

- [PostgreSQL 17: Repeatable Read](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-REPEATABLE-READ): las consultas de la transacción comparten una instantánea.
- [Express: migración a versión 5](https://expressjs.com/en/guide/migrating-5.html#req.query): `req.query` es un getter y sus datos deben validarse.
