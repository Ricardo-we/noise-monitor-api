# 04 · Referencia de la API HTTP

[Índice](../README.md) · [Arquitectura](../03-arquitectura/README.md) · [OpenAPI](openapi.yaml)

## Dirección base y rutas

En desarrollo: `http://localhost:3000`. Todas las rutas declaradas comienzan con
`/api`. No hay un prefijo `/v1` ni una URL de producción confirmada en esta documentación.

| Método | Ruta | Función | Acceso |
| --- | --- | --- | --- |
| `GET` | [`/api/health-check`](estado-servicio/README.md) | Comprobar API y conexión a BD. | Público. |
| `POST` | [`/api/save-audio-record`](guardar-medicion/README.md) | Guardar una medición validada. | `x-api-key` si el servidor tiene `API_KEY`. |
| `GET` | [`/api/records`](consultar-registros/README.md) | Leer mediciones por páginas. | `x-api-key` si el servidor tiene `API_KEY`. |

No existen endpoints de edición, eliminación, login o descarga de audio.
`GET /` no es una página de bienvenida; una ruta no declarada termina en `404`,
salvo que un middleware anterior rechace primero la petición.

## Encabezados y formatos

Para guardar:

```http
Content-Type: application/json
x-api-key: <CLAVE_DEL_ENTORNO>
```

Para consultar registros basta el encabezado `x-api-key`, cuando corresponda.
El cuerpo y las respuestas usan JSON. Los nombres del contrato HTTP están en
`snake_case`; los parámetros de paginación son `page` y `limit`.

`API_KEY` ausente permite entrar a ambas rutas; `API_KEY` vacía impide el arranque.
La clave no se transmite en la URL ni se reemplaza por `auth_hash` o por el carné.
Detalles en [configuración](../02-configuracion/README.md) y [seguridad](../07-seguridad/README.md).

## Fechas y números

- El POST exige fecha ISO 8601 con hora y `Z` u offset explícito.
- Las respuestas de mediciones serializan fechas con `toISOString()` en UTC.
- La regla de cercanía convierte el instante a `MEASUREMENT_TIME_ZONE` para decidir el día.
- Coordenadas y métricas son números JSON; no cadenas con separador decimal local.
- Los parámetros de query llegan como texto y se validan antes de convertirse a enteros.

## Respuestas exitosas

El guardado devuelve `{ "data": { ... } }`. La consulta devuelve
`{ "data": [ ... ], "pagination": { ... } }`. El health-check usa
`{ "status": "ok", "database": "ok" }` sin envoltorio `data`.
No hay un campo `success` global ni `request_id` generado por esta API.

## Errores generales

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API key inválida o ausente"
  }
}
```

Los errores de validación incluyen `details`, una lista con `path`, `message`
y `code` del problema Zod. Los textos individuales pueden cambiar al actualizar
esa dependencia; el consumidor debe basarse principalmente en estado HTTP y
`error.code`, y mostrar los detalles para corregir la entrada.

| HTTP | `error.code` | Cuándo se utiliza |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Body o parámetros de consulta no cumplen su esquema. |
| `400` | `INVALID_JSON` | El analizador JSON rechaza la sintaxis del body. |
| `400` | `FOREIGN_KEY_ERROR` | Prisma `P2003`; mapeo general, sin relación foránea definida en el modelo actual. |
| `401` | `UNAUTHORIZED` | Falta o no coincide la clave en una ruta protegida y el servidor la exige. |
| `404` | `NOT_FOUND` | Ruta no declarada o Prisma `P2025`. |
| `409` | `NEARBY_READING_EXISTS` | Ya hay una medición del mismo día local a 50 metros o menos. |
| `409` | `DUPLICATE_RESOURCE` | Prisma `P2002`, violación de unicidad. |
| `503` | `DB_UNAVAILABLE` | Prisma `P1001`. |
| `503` | `DB_TIMEOUT` | Prisma `P1002`. |
| `500` | `INTERNAL_ERROR` | Error no contemplado por el normalizador. |

Los dos códigos 503 se generan cuando el error recibido trae esos códigos
Prisma. No se promete que cualquier caída de red del driver se traduzca a 503:
un error distinto puede caer en 500. En `NODE_ENV=production`, los errores
internos 500 omiten `details`; los de validación conservan sus detalles.

El health-check traduce cualquier fallo de su ping a su propio `503`:

```json
{ "status": "error", "database": "unavailable" }
```

## Orden de fallos y comportamientos a considerar

- El parser JSON precede a autenticación; un body mal formado puede generar 400 antes que 401.
- En rutas protegidas, la API key se revisa antes que el esquema de body/query.
- No hay un manejador específico de `405 Method Not Allowed`; un método no declarado normalmente termina en 404, después de los middlewares aplicables.
- El parser limita JSON a `64kb`. El manejador global no asigna un código específico a exceso de tamaño; no se documenta un 413 garantizado.
- No hay rate limiting ni un 429 implementado por el código de la API.

## Probar con herramientas

Importá [openapi.yaml](openapi.yaml) como archivo OpenAPI en tu cliente compatible.
Configurá la dirección base local y autorizá `ApiKeyAuth` con la clave del entorno.
El contrato describe el perfil con clave configurada; la excepción de entorno
sin `API_KEY` está explicada en su descripción. Importar el archivo no despliega
un servidor Swagger ni crea datos por sí solo.

Para evitar publicar claves, no incrustes valores reales en colecciones
compartidas. Usá variables locales del cliente. El JSON sintético de
[ejemplo](ejemplos/medicion.json) puede usarse en una base de desarrollo.

## Guía de manejo para consumidores

1. Comprobar el estado HTTP antes de asumir una respuesta exitosa.
2. Para 400, corregir campos o query; repetir el mismo JSON no resuelve el problema.
3. Para 401, revisar la clave y el entorno del servidor.
4. Para 409 de cercanía, informar al usuario; no reintentar automáticamente el guardado.
5. Para fallos de red después de un POST, verificar el resultado antes de repetir: no hay clave de idempotencia.
6. Para GET, avanzar solo mientras `has_next` sea verdadero y manejar los errores de cada página.

La validación no certifica calibración del micrófono. El rango `[-160, 150]`
es un filtro del contrato actual, no una escala física acordada de dB SPL o dBFS.
