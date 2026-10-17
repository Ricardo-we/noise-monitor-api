# 05 · Base de datos y diccionario de datos

[Índice](../README.md) · [Referencia HTTP](../04-api/README.md) · [Reglas y calidad](../06-reglas-y-calidad/README.md)

## Modelo persistido

El backend usa PostgreSQL. La tabla esperada es `public.noise_readings` y el
modelo [NoiseReading](../../prisma/schema.prisma) mapea nombres camelCase del
cliente Prisma a nombres snake_case en la BD. No hay tablas de estudiantes,
dispositivos, sesiones o roles definidas en este modelo.

| Columna | Propiedad Prisma | Tipo PostgreSQL | Nulo | Origen o función |
| --- | --- | --- | --- | --- |
| `reading_id` | `readingId` | `uuid` | No | PK; predeterminado `gen_random_uuid()`. |
| `timestamp` | `timestamp` | `timestamptz(6)` | No | Instante de captura enviado por el cliente. |
| `latitude` | `latitude` | `double precision` | No | Latitud de la medición. |
| `longitude` | `longitude` | `double precision` | No | Longitud de la medición. |
| `student_id` | `studentId` | `varchar(50)` | No | Identificador recibido del estudiante. |
| `auth_hash` | `authHash` | `varchar(64)` | No | Texto recibido; su autenticidad no se comprueba. |
| `domain_data` | `domainData` | `jsonb` | No SQL NULL | Métricas y metadatos; puede contener JSON `null`. |
| `created_at` | `createdAt` | `timestamptz(6)` | No | Predeterminado `now()` al insertar. |

`timestamptz` conserva un instante, no el nombre original de la zona horaria.
La API usa `Date` de JavaScript y entrega ISO UTC con precisión de milisegundos;
no promete conservar en JSON los seis dígitos fraccionarios posibles de la BD.

## JSONB y contrato

Para nuevas escrituras por la API se exige el objeto `domain_data` de la guía
de [guardado](../04-api/guardar-medicion/README.md). En cambio, PostgreSQL no
impone ese esquema dentro de JSONB y el GET no lo vuelve a validar.

Es posible encontrar registros históricos con claves faltantes, JSON nulo o
valores que no cumplen las reglas actuales. HU-18 los detecta; no se deben
completar con valores inventados para hacer que una consulta «pase».

## DDL de referencia

La estructura lógica esperada es:

```sql
CREATE TABLE public.noise_readings (
  reading_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ(6) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  student_id VARCHAR(50) NOT NULL,
  auth_hash VARCHAR(64) NOT NULL,
  domain_data JSONB NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
```

El SQL anterior describe el contrato; no es una instrucción para recrear la
tabla compartida. El flujo de [pruebas](../08-pruebas/README.md) prepara su
propia tabla en una base local descartable.

## Restricciones que existen y las que no

El modelo declara PK única, columnas obligatorias, tipos y longitudes de texto.
No declara restricciones CHECK para coordenadas, dB, JSON o radio de 50 metros;
esas verificaciones de entrada o negocio ocurren en la API.

El carné no es único en la tabla: un estudiante puede tener varias mediciones
que cumplan la regla geográfica/temporal. El UUID identifica la fila; no verifica
por sí mismo que dos capturas representen mediciones distintas.

La ausencia de CHECK significa que otro escritor con acceso directo puede
insertar datos que la API rechazaría. Además, ese escritor puede saltarse el
bloqueo de HU-08. El equipo debe coordinar todos los canales de escritura.

## Conexiones y generación

La API y `prisma.config.ts` leen `DB_URL`. Se conserva el ORM y driver existentes:
Prisma 7.10, `@prisma/adapter-pg` y `pg`. La auditoría usa un pool `pg` independiente
y lo cierra al terminar.

Para aplicación se utiliza normalmente la URL pooled de Neon (`-pooler`). Para
migraciones y respaldos, revisar una conexión directa, el entorno y los permisos.
Referencia: [documentación de pooling de Neon](https://neon.com/docs/connect/connection-pooling).

```bash
npm run prisma:generate
```

Ese comando genera código a partir del modelo, sin aplicar DDL. La aplicación
no crea tablas al arrancar. `prisma:studio` abre una herramienta con capacidad
de editar datos; no equivale a una inspección garantizada de solo lectura.

## Migraciones y cambios de esquema

Existen scripts `prisma:migrate` y `prisma:deploy`, pero la base revisada no
incluye un historial de migraciones en `prisma/migrations`. `prisma:deploy` no
debe describirse como un instalador automático de la tabla actual.

Antes de introducir una migración, el responsable debe acordar el cambio,
establecer la línea base de la BD existente, probarlo en un entorno aislado,
revisar su SQL y aprobar la ejecución. Esta entrega documental no aplica cambios
de esquema ni ejecuta migraciones contra Neon.

## Índices y crecimiento

El modelo solo declara la PK. No se agregaron índices secundarios por documentar
la API. La consulta paginada ordena por timestamp y reading_id; la búsqueda HU-08
filtra un intervalo de timestamp y calcula distancia.

Si crece el volumen, se deben medir consultas representativas antes de decidir
índices, límites de paginación o una estrategia geoespacial distinta. Un índice
propuesto no se debe presentar como ya instalado en la base real.

## Respaldos y recuperación

Una copia del código no contiene las mediciones de la BD. El proyecto no
implementa un procedimiento propio de backup/restore ni define RPO/RTO.
El responsable del entorno debe acordar respaldos, retención y una prueba de
restauración; no se garantiza recuperación solo por usar un servicio alojado.
