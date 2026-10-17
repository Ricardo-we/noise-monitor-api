# GET /api/records · Consultar mediciones paginadas

[Referencia HTTP](../README.md) · [Ejemplo de guardado](../guardar-medicion/README.md)

## Propósito

Leer los registros existentes de `noise_readings` sin devolver toda la tabla
en una sola respuesta. Requiere `x-api-key` si el servidor tiene `API_KEY`.
Esta ruta no modifica mediciones ni corrige su calidad.

```bash
curl -i 'http://localhost:3000/api/records?page=1&limit=20' \
  -H "x-api-key: ${NOISE_API_KEY}"
```

## Parámetros de query

| Parámetro | Predeterminado | Restricción |
| --- | --- | --- |
| `page` | `1` | Entero positivo, como texto en dígitos sin ceros iniciales. Máximo 2147483647. |
| `limit` | `20` | Entero de 1 a 100, como texto en dígitos sin ceros iniciales. |

Además, `(page - 1) * limit` no puede superar `2147483647`. Es un límite técnico
del desplazamiento elegido por esta implementación, no una promesa de que una
consulta de miles de millones de posiciones resulte rápida.

Solo se admiten estas dos claves, una vez cada una. `page=0`, `page=01`,
`page=1.5`, `page=1e2`, `limit=101`, valores vacíos, claves repetidas y filtros
no implementados generan **400 `VALIDATION_ERROR`**. Los omitidos toman su valor
predeterminado; no se reduce silenciosamente un `limit` superior a 100.

## Orden de los datos

1. `timestamp` descendente: primero las capturas de fecha más reciente.
2. `reading_id` descendente: desempate único para fechas idénticas.

No se ordena por `created_at` ni se interpreta el UUID como una fecha.
Una captura antigua insertada hoy se ubica según su timestamp de captura.

## Respuesta 200: ejemplo con un solo registro total

```json
{
  "data": [
    {
      "reading_id": "00000000-0000-4000-8000-000000000001",
      "timestamp": "2026-10-17T18:00:00.000Z",
      "latitude": 14.6349,
      "longitude": -90.5069,
      "student_id": "test-student",
      "domain_data": {
        "metric": "avg",
        "value_db": 62.4,
        "noise_min_db": 48.1,
        "noise_max_db": 78.9,
        "noise_avg_db": 62.4,
        "recording_duration_ms": 3000,
        "device_model": "Test device",
        "app_version": "1.0.0"
      },
      "created_at": "2026-10-17T18:00:01.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false
  }
}
```

La selección contiene exactamente esos siete campos en cada fila. No se
selecciona `auth_hash` de la columna de la tabla. `domain_data` se devuelve
como JSON almacenado, sin una limpieza adicional de sus claves históricas.
Puede ser incompleto, `null` u otro valor JSON; el consumidor debe comprobarlo
antes de leer métricas. La selección no garantiza datos históricos validados.

## Interpretación de metadatos

| Campo | Significado |
| --- | --- |
| `page` | Número de página solicitado o predeterminado. |
| `limit` | Tamaño máximo de página, no la cantidad realmente devuelta. |
| `total` | Total de filas en la tabla para esa petición. |
| `total_pages` | `Math.ceil(total / limit)`; vale 0 si la tabla está vacía. |
| `has_next` | `page < total_pages`. |
| `has_previous` | Hay filas en la tabla y `page > 1`; existe alguna página anterior. |

Con 55 filas y `limit=20`, las páginas contienen 20, 20 y 15 elementos.
Es un ejemplo aritmético, no un conteo actual de Neon.

Tabla vacía: `data: []`, total 0, total_pages 0 y ambas banderas falsas.
Una página posterior a la última devuelve 200 con lista vacía, conserva `page`
y el total real. Si la tabla no está vacía, `has_previous` puede ser verdadero
incluso si la página inmediatamente anterior también está fuera de rango.

## Consumo en JavaScript / TypeScript

Ejemplo para un consumidor autorizado con una clave ya obtenida por el mecanismo
del entorno. No es una instrucción para incrustar una clave privada en un bundle web.

```ts
async function consultarPagina(apiUrl: string, apiKey: string, page = 1) {
  const query = new URLSearchParams({ page: String(page), limit: "20" });
  const response = await fetch(`${apiUrl}/api/records?${query}`, {
    headers: { "x-api-key": apiKey },
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message ?? `HTTP ${response.status}`);
  }
  return result;
}
```

Mostrá `data` y habilitá «Siguiente» con `pagination.has_next`. Al cambiar
`limit`, conviene volver a página 1. Los filtros por fechas, carné o ubicación
y un parámetro de orden configurable no forman parte de esta ruta.

## Consistencia y rendimiento

Prisma consulta página y conteo en una transacción `RepeatableRead`. Dentro de
esa petición comparten una instantánea. Si entran o se borran filas entre dos
peticiones, pueden desplazarse las páginas, aun con el orden de desempate.
No se debe usar este recorrido como garantía de exportación congelada.

El máximo limita filas, no bytes del JSON. `count`, ordenamiento y offsets altos
pueden ser más costosos cuando crece la tabla. No se ha incorporado un índice
compuesto para esa consulta ni una caché de conteos.

Resultados de error: 400 de query, 401 de acceso y errores generales 500/503.
Un fallo de BD no se convierte intencionalmente en una lista vacía exitosa.
