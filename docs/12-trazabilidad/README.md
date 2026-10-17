# 12 · Trazabilidad, evidencia y decisiones

[Índice](../README.md) · [Contribución](../10-contribucion/README.md)

## Base de esta edición

Documentación revisada el **17 de octubre de 2026**, a partir del commit de
`main` **`b33ded967d0c4c2c69dd3b68dd4617171c09c47e`**. Se inspeccionaron rutas,
middlewares, esquemas, controladores, repositorio, modelo, scripts y pruebas.
La fuente de comportamiento fue el código, no una lista de funciones deseadas.

La rama documental parte de esa base. La publicación se hace separada de `main`
para que Ricardo revise antes de integrar. El PR de esta entrega y el commit
final se identifican en GitHub; no se confunden con un despliegue.

## Línea de cambios verificados

| Fecha / referencia | Cambio o evidencia | Cómo interpretarlo |
| --- | --- | --- |
| 5–6 de octubre, [informe de avance](../INFORME_AVANCE_MARVIN.md) | Preparación del backend, HU-08 y HU-18. | Documento histórico, conserva contexto y decisiones de esa entrega. |
| 6 de octubre, [auditoría Neon](../AUDITORIA_HU18_NEON.md) | Conteos agregados de calidad y esquema de la base real. | Instantánea de esa fecha; no se recalcula ni se presenta como estado actual. |
| 10 de octubre, `c2744cb` | Implementación inicial de HU-30 y verificación local/Neon. | Su informe decía pendiente de integración y sin API key en esa versión. |
| `602f397`, seguido de `2e3620d` | Ricardo incorporó middleware de API key y adaptación de pruebas de registros. | La consulta y guardado actuales pueden exigir `x-api-key`. |
| 12 de octubre, `b33ded9`, [PR #2](https://github.com/Ricardo-we/noise-monitor-api/pull/2) | Integración de HU-30 y esos cambios por Ricardo-we. | PR fusionado el 12/10/2026 a las 00:16:10 de Guatemala. No prueba despliegue. |
| 17 de octubre, esta entrega | README raíz, índice, guías, contrato OpenAPI y ejemplos. | Documentación del comportamiento integrado, con verificaciones nuevas fechadas. |

Los reportes históricos y sus JSON se preservan. Se agregan avisos de lectura
para dirigir al contrato actual sin reescribir los resultados del pasado.

## Matriz de funcionalidades y fuentes

| Tema | Implementación comprobable | Documentación vigente | Estado que se puede afirmar |
| --- | --- | --- | --- |
| Guardado de mediciones | Esquema y controlador save-audio-record, repositorio create. | [Guardar](../04-api/guardar-medicion/README.md). | Implementado; no incluye captura/cálculo de audio. |
| Prevención de cercanía HU-08 | Transacción, bloqueo por día y Haversine. | [Reglas y calidad](../06-reglas-y-calidad/README.md). | Implementada para escritores que usen ese flujo. |
| Auditoría HU-18 | Script y biblioteca data-quality. | [Reglas y calidad](../06-reglas-y-calidad/README.md). | Auditor de solo lectura; no limpia ni elimina registros. |
| Consulta HU-30 | Ruta, esquema records, controlador y list. | [Consultar](../04-api/consultar-registros/README.md). | Implementada con paginación por desplazamiento. |
| Acceso de consumidores | requireApiKey y env.API_KEY. | [Seguridad](../07-seguridad/README.md). | Clave compartida opcional según configuración; no identidad por usuario. |
| Disponibilidad | Health-check y ping. | [Estado](../04-api/estado-servicio/README.md). | Comprueba conectividad simple. |
| API especificada para herramientas | Archivo OpenAPI documental. | [Contrato](../04-api/openapi.yaml). | Importable; no hay servidor Swagger instalado. |

Esta matriz no declara completadas historias ajenas al código inspeccionado.
No se atribuye una HU de documentación con número inventado: el pedido actual
se trata como documentación de la API.

## Verificación de esta entrega

La [evidencia del 17/10](../evidencia/DOCUMENTACION_API_2026-10-17.json) registra
entorno, comandos, resultados de las suites, comprobaciones HTTP sintéticas,
consistencia del contrato y alcance de cambios. No contiene credenciales.

Se verifican enlaces locales y anclas, archivos JSON, estructura OpenAPI y
ejemplos de petición/respuesta frente a una API local con PostgreSQL 17.
No se escribe ni se ejecuta una auditoría nueva en Neon para documentar el sistema.
Las verificaciones locales no certifican datos reales ni disponibilidad productiva.

## Decisiones que deben seguir visibles

1. HU-08 mantiene alcance global, radio inclusivo y día por captura/zona configurada.
2. HU-30 conserva página 1, tamaño 20, máximo 100 y orden por captura/UUID.
3. API key debe definirse si se desea exigir acceso; no hay obligación automática en producción.
4. Carné, coordenadas y JSON se entregan a quien obtiene acceso; no se anonimiza automáticamente.
5. Escala acústica, identidad del estudiante, retención, controles de infraestructura y recuperación requieren acuerdos adicionales.

Estas decisiones describen el código o pendientes identificados. Su presencia
en un README no prueba una validación formal de cada requisito por el equipo.

## Mantener la evidencia útil

Registrar fecha, base de código, entorno, comando, resultado, límite y referencia
del archivo. No actualizar conteos históricos sin una ejecución nueva identificada.
Si una guía queda obsoleta, actualizar la guía vigente y señalar desde el informe
histórico cuál versión describe.

## Fuentes técnicas de apoyo

Los archivos del repositorio son la referencia primaria del contrato de este proyecto.
Para conceptos externos se consultaron fuentes oficiales:

- [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3.html): estructura de paths, esquemas y autenticación por API key.
- [PostgreSQL 17: aislamiento](https://www.postgresql.org/docs/17/transaction-iso.html): diferencias entre ReadCommitted y RepeatableRead.
- [Express 5: migración](https://expressjs.com/en/guide/migrating-5.html): tratamiento de req.query.
- [Neon: connection pooling](https://neon.com/docs/connect/connection-pooling): conexiones pooled y directas.

No se copiaron ejemplos de una versión distinta de Prisma para cambiar la API
del proyecto. Se respetó el cliente 7.10 instalado y su modelo generado.
