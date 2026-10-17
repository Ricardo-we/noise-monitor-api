# 06 · Reglas de negocio y calidad de datos

[Índice](../README.md) · [Base de datos](../05-base-de-datos/README.md) · [Pruebas](../08-pruebas/README.md)

## Tres niveles diferentes

| Nivel | Cuándo ocurre | Resultado |
| --- | --- | --- |
| Validación Zod | Antes de consultar o insertar. | Rechaza datos o query inválidos con 400. |
| HU-08: prevención de cercanía | Dentro de la transacción de guardado. | Rechaza una nueva medición cercana con 409. |
| HU-18: auditoría de calidad | Al ejecutar el script, sobre datos existentes. | Genera conteos e inspección de estructura; no corrige filas. |

Detectar un problema en una auditoría no demuestra que el POST ya lo rechace.
La documentación distingue esos controles para que el equipo pueda explicar
qué protección existe y qué validación adicional se está proponiendo.

## HU-08: radio y día calendario

**Regla implementada:** rechazar el guardado si existe cualquier medición a una
distancia menor o igual a 50 metros en el mismo día local de captura.

- Alcance global: incluye a otros estudiantes, no solo al carné que envía.
- Día calculado con `timestamp` de captura y `MEASUREMENT_TIME_ZONE`.
- Zona predeterminada: `America/Guatemala`.
- Límite inclusivo: exactamente 50 m se rechaza; más de 50 m puede pasar.
- Se comparan todas las mediciones válidas del día, no solo la última.
- Misma ubicación en un día local distinto puede guardarse.

| Situación sintética | Resultado esperado |
| --- | --- |
| Primera medición del día en esa zona | 201, si el resto del payload es válido. |
| Otra a 0, 49.99 o 50 metros | 409 `NEARBY_READING_EXISTS`. |
| Otra a 50.01 metros | 201, si no hay otra medición cercana. |
| Otro carné en el mismo punto y día | 409. |
| Mismo punto después de medianoche local | Puede ser 201 porque cambió el día. |
| Dos capturas en fechas UTC distintas pero en el mismo día local | Se consideran del mismo día. |

El bloqueo transaccional por día y el aislamiento `ReadCommitted` coordinan los
guardados de esta API. La protección no es una restricción declarada de la tabla;
depende de que todos los escritores respeten el mismo flujo y zona horaria.

## HU-18: ejecutar una auditoría

Con `.env` configurado para la base que se quiere inspeccionar:

```bash
npm run data:quality
```

El script valida que la conexión no sea el marcador de la plantilla, abre una
conexión y usa `REPEATABLE READ READ ONLY`. Establece un límite de 60 segundos
por sentencia dentro de la transacción; no es un timeout total de todo el proceso.
Si falla una consulta, revierte la transacción y no publica un informe exitoso.

El resultado se guarda como `reports/data-quality-<fecha-UTC>.json`, excluido de
Git, con permisos `0600` al crear el archivo. La consola imprime ruta y resumen
de calidad. El reporte incluye nombre de base, tabla, zona, estructura,
restricciones, índices, criterios y limitaciones.

## Indicadores del reporte

| Indicador | Qué cuenta |
| --- | --- |
| `total_readings` | Filas totales de la tabla. |
| `null_required_fields` | Filas con SQL NULL en algún campo obligatorio inspeccionado. |
| `invalid_coordinates` | Coordenadas nulas o fuera de latitud/longitud admitidas. |
| `invalid_student_ids` | Carné nulo, vacío tras trim o longitud fuera de 1–50. |
| `non_sha256_hash_format` | Hash que no tiene 64 caracteres hexadecimales. No verifica autenticidad. |
| `malformed_domain_data` | JSON que no tiene el objeto y tipos/campos esperados; también JSON nulo. |
| `db_out_of_range` | Algún valor numérico dB fuera de -160 a 150. |
| `inconsistent_min_avg_max` | Mínimo mayor que promedio o promedio mayor que máximo. |
| `value_metric_mismatch` | Diferencia superior a 0.000001 entre value_db y la métrica declarada. |
| `invalid_duration` | Duración numérica fuera de 1–300000 o no entera. |
| `nearby_same_day_pairs` | Pares de filas válidas en coordenadas a <=50 m el mismo día local. |
| `first_measurement`, `last_measurement` | Extremos del timestamp almacenado; nulos si no hay filas. |

Una duración faltante queda detectada por JSON mal formado; no necesariamente
incrementa `invalid_duration`, que evalúa valores numéricos existentes. Las
categorías se solapan: no se suman para calcular «filas malas» únicas.

Los pares cercanos tampoco equivalen a filas duplicadas. Tres filas cercanas
entre sí pueden formar tres pares. El resultado no autoriza borrar mediciones.

## Límites semánticos que debe acordar el equipo

- Si la app reporta dBFS o dB SPL y cómo está calibrada; no se deduce del rango aceptado.
- Si deben validarse preventivamente `min <= avg <= max` y coherencia de `value_db`.
- Cómo identificar al estudiante y relacionarlo con su dispositivo.
- Cómo registrar y conservar evidencia de solicitudes rechazadas.
- Qué hacer con datos históricos que incumplen reglas nuevas.

El backend actual no implementa la escala 1–5 de otros tableros ni convierte
decibeles a esa escala. Tampoco incorpora ETL o reglas geográficas de otros
grupos por el hecho de que figuren en una tabla colaborativa.

## Informes fechados

La [auditoría del 6 de octubre](../AUDITORIA_HU18_NEON.md) y las
[evidencias históricas](../12-trazabilidad/README.md) conservan resultados de
esa fecha. No representan el conteo actual de la BD. Esta entrega de
documentación no repite la auditoría real ni modifica sus valores anteriores.
