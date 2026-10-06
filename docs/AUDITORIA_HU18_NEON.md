# HU-18: revisión de la base real del equipo

Fecha: 6 de octubre de 2026, Guatemala. Responsable: Marvin Danilo Culajay.

## Acceso y método

Se localizó la invitación de Neon en el correo institucional de Marvin y se
confirmó el proyecto compartido `noise_db`, rama `production`, base `neondb` y
tabla `public.noise_readings`. La auditoría terminó el 6 de octubre a las
06:37:17, hora de Guatemala (12:37:17 UTC).

Se ejecutó `npm run data:quality`: estructura y conteos se consultan en una
transacción `REPEATABLE READ READ ONLY`. Después se realizaron consultas SELECT
agregadas para explicar los hallazgos. No se insertaron, actualizaron ni borraron
mediciones. La conexión se configuró en `.env`, excluido de Git; no se publica
la contraseña, el contenido de hashes, carnés ni coordenadas individuales.

## Resultados

La estructura real coincide con las ocho columnas del modelo Prisma, todas
obligatorias, con clave primaria UUID y un índice sobre `reading_id`.

| Revisión | Resultado |
| --- | --- |
| Mediciones revisadas | 99 |
| Nulos en columnas obligatorias | 0 |
| Coordenadas fuera de rango | 0 |
| Identificadores vacíos o de longitud inválida | 0 |
| Hash sin formato hexadecimal de 64 caracteres | 0 |
| JSON que no cumple el contrato actual | 15 |
| dB fuera de [-160, 150] | 0 |
| Mínimo/promedio/máximo inconsistentes | 0 |
| Valor diferente de la métrica seleccionada, cuando ambos existen | 0 |
| Duraciones fuera de 1 a 300000 ms | 9 |
| Pares cercanos del mismo día local, radio <= 50 m | 1134 |

Las 15 lecturas de JSON incompleto carecen simultáneamente de `metric` y
`value_db`. Las nueve duraciones inválidas se desglosan en seis de cero
milisegundos y tres superiores a cinco minutos; la mayor es de 591178 ms.

Las 99 lecturas participan en al menos un par cercano, distribuidos en cuatro
días locales. **1134 pares no significa 1134 registros duplicados**: una lectura
puede formar pares con muchas otras. Se cuenta según la propuesta de HU-08:
cualquier estudiante, todas las lecturas del día, hora de Guatemala y <= 50 m.
Ricardo debe confirmar si ese es el alcance esperado.

## Interpretación y siguiente paso

- Revisar con Darwin y frontend el origen de los 15 JSON incompletos y las
  duraciones en cero o superiores a cinco minutos. Son incompatibilidades con
  el contrato actual; no se atribuyen a una persona ni se reconstruyen valores
  que faltan.
- Acordar con Ricardo el alcance de la regla de cercanía antes de integrar
  HU-08. Los registros históricos cercanos no demuestran por sí mismos que el
  nuevo código falle: la validación nueva aún debe desplegarse y probarse con
  la APK del equipo.
- No borrar ni corregir datos históricos sin acordar cómo conservar su evidencia.
- Confirmar si frontend reporta dBFS o dB SPL antes de interpretar ruido ambiental.

Los conteos pueden solaparse. El formato de hash no verifica autenticidad. Las
solicitudes rechazadas no están registradas en esta tabla y requieren logs.
Las consultas adicionales se ejecutaron después de la instantánea principal;
no constituyen un seguimiento continuo de una base que puede cambiar.

## Evidencia reproducible

El informe agregado de estructura y calidad está en
`docs/evidencia/HU18_NEON_2026-10-06.json`. El original permanece en `reports/`,
excluido de Git. Para actualizar la revisión con una conexión autorizada:

```bash
npm run data:quality
```

HU-18 tiene ahora evidencia de revisión de estructura y datos reales. Queda
pendiente compartir y validar los hallazgos con Darwin y Ricardo; no se modificó
el estado de la planificación compartida.
