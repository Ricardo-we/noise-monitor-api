# POST /api/save-audio-record · Guardar una medición

[Referencia HTTP](../README.md) · [Regla de 50 metros](../../06-reglas-y-calidad/README.md)

## Propósito y acceso

Persistir una medición numérica y sus metadatos en `noise_readings`.
Es un endpoint de escritura: ensayá con datos sintéticos únicamente en una base
de desarrollo o con autorización del responsable de la base compartida.

Requiere `x-api-key` cuando existe `API_KEY` en el servidor. `auth_hash` es un
campo del payload; no autentica esta petición ni reemplaza ese encabezado.

## Cuerpo completo

```json
{
  "timestamp": "2026-10-17T18:00:00.000Z",
  "latitude": 14.6349,
  "longitude": -90.5069,
  "student_id": "test-student",
  "auth_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "domain_data": {
    "metric": "avg",
    "value_db": 62.4,
    "noise_min_db": 48.1,
    "noise_max_db": 78.9,
    "noise_avg_db": 62.4,
    "recording_duration_ms": 3000,
    "device_model": "Test device",
    "app_version": "1.0.0"
  }
}
```

Todos los campos del ejemplo son obligatorios. El esquema es estricto en la
raíz y dentro de `domain_data`: claves adicionales generan 400. No se adjunta
audio, multipart, base64 ni un archivo binario.

## Reglas por campo

| Campo | Tipo JSON | Regla efectiva |
| --- | --- | --- |
| `timestamp` | string | ISO 8601 con hora y zona `Z` u offset; no solo fecha. |
| `latitude` | number | De -90 a 90, inclusive. |
| `longitude` | number | De -180 a 180, inclusive. |
| `student_id` | string | Recorta espacios exteriores; longitud resultante 1–50. |
| `auth_hash` | string | Recorta espacios exteriores; longitud resultante 1–64. No exige hexadecimal ni calcula un hash. |
| `domain_data.metric` | string | Exactamente `min`, `max` o `avg`. |
| `domain_data.value_db` | number | Entre -160 y 150, inclusive. |
| `domain_data.noise_min_db` | number | Entre -160 y 150, inclusive. |
| `domain_data.noise_max_db` | number | Entre -160 y 150, inclusive. |
| `domain_data.noise_avg_db` | number | Entre -160 y 150, inclusive. |
| `domain_data.recording_duration_ms` | integer | De 1 a 300000 ms, inclusive: máximo cinco minutos. |
| `domain_data.device_model` | string | Recorta espacios exteriores; longitud resultante 1–120. |
| `domain_data.app_version` | string | Recorta espacios exteriores; longitud resultante 1–40. |

El contrato no rechaza actualmente `min > avg`, `avg > max`, ni una diferencia
entre `value_db` y el campo elegido por `metric`. La auditoría HU-18 detecta esos
casos después; no se debe afirmar que son validaciones preventivas del POST.
Tampoco se valida que el timestamp sea del día actual o que provenga del servidor.

## Ejemplo ejecutable

Desde la raíz, con el servidor de desarrollo activo y `NOISE_API_KEY` definida
en la terminal del cliente:

```bash
curl -i http://localhost:3000/api/save-audio-record \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${NOISE_API_KEY}" \
  --data-binary @docs/04-api/ejemplos/medicion.json
```

Si repetís el ejemplo sobre la misma ubicación y el mismo día, corresponde un
409 por HU-08. Cambiar solo el carné no evita esa regla porque el alcance es global.

## Respuesta 201

```json
{
  "data": {
    "reading_id": "00000000-0000-4000-8000-000000000001",
    "student_id": "test-student",
    "metric": "avg",
    "value_db": 62.4,
    "created_at": "2026-10-17T18:00:01.000Z"
  }
}
```

El identificador lo asigna PostgreSQL; el de arriba es ilustrativo. `created_at`
es el momento de inserción en la BD. `timestamp` es el instante de captura que
envió el cliente. La respuesta de guardado es un resumen, no la fila completa;
no incluye `auth_hash` ni coordenadas. La consulta GET sí devuelve coordenadas.

## Rechazo por cercanía: 409

```json
{
  "error": {
    "code": "NEARBY_READING_EXISTS",
    "message": "Ya existe una medición a 50 metros o menos en el mismo día"
  }
}
```

Se compara con cualquier estudiante, tomando el día local del timestamp de
captura y una distancia inclusiva de 50 metros. La transacción rechazada no
inserta una fila. Misma ubicación en otro día local puede guardarse.

## Otros resultados

| Resultado | Acción del consumidor |
| --- | --- |
| 400 `VALIDATION_ERROR` | Revisar `details`; números como texto no se convierten automáticamente. |
| 400 `INVALID_JSON` | Corregir sintaxis JSON y `Content-Type`. |
| 401 `UNAUTHORIZED` | Enviar la clave correcta del servidor al que se está llamando. |
| 409 `DUPLICATE_RESOURCE` | Revisar conflicto de unicidad; distinto del rechazo geográfico. |
| 500 / 503 | Revisar disponibilidad y código de error; no repetir un POST ciegamente. |

No hay idempotency key. Si se pierde la respuesta tras confirmar una inserción,
repetirla puede terminar en 409; eso no reproduce la respuesta original 201.

Fuentes de código: [esquema](../../../src/app/schemas/save-audio-record.schema.ts),
[controlador](../../../src/app/controllers/save-audio-record.controller.ts) y
[repositorio](../../../src/repositories/noise-reading.repository.ts).
