# Avance de tareas de Marvin - Grupo 1

Fecha de trabajo: 5 de octubre de 2026, Guatemala.
Proyecto: monitoreo de ruido urbano. Responsable: Marvin Danilo Culajay.
Repositorio: https://github.com/Ricardo-we/noise-monitor-api
Base revisada: `main`, commit `1d51fa6`.
Rama de trabajo: `feat/marvin-hu08-hu18`.

## 1. Tareas identificadas y estado

La planificación adjunta asigna a Marvin backend, análisis de datos y despliegue.
Para este trabajo se tomó el alcance específico de Sprint 1; las historias del
backlog representan trabajo del equipo y no una asignación individual de todas
las funcionalidades a Marvin.

| Tarea | Responsable en el plan | Resultado de este trabajo |
| --- | --- | --- |
| HU-03: clonar backend | Equipo | Completado localmente; dependencias y cliente Prisma instalados |
| HU-08: validar radio antes de guardar | Marvin | Implementado y probado localmente; presentado como borrador para revisión |
| HU-18: revisar tabla y calidad | Marvin y Darwin | Modelo revisado y auditoría reproducible preparada; pendiente auditar la base del equipo |

Las fechas originales de estas tareas ya transcurrieron. No se cambió la
planificación compartida ni se atribuyó el estado pendiente a falta de trabajo
de otro integrante. Los resultados anteriores son los comprobados hoy.

## 2. Qué se hizo, por qué y cómo

1. **Leer la planificación.** Se revisaron Backlog, Roles y responsables y Sprints.
   Esto permitió identificar las tareas concretas de Marvin y sus criterios.
2. **Consultar GitHub y clonar el repositorio.** Se comprobó que la rama principal
   existe y se creó una copia local con historial y conexión al repositorio.
   Así se trabaja sobre el código real del equipo.
3. **Crear una rama de trabajo.** Los cambios se prepararon en
   `feat/marvin-hu08-hu18`, para que Ricardo pueda revisar la propuesta.
4. **Preparar el entorno.** Se usó `npm ci` para respetar las versiones del archivo
   de dependencias y se generó el cliente de Prisma. Node disponible: 26.5.0.
5. **Revisar el recorrido del endpoint.** La ruta valida con Zod, pasa al
   controlador y guarda mediante el repositorio de Prisma. La búsqueda de
   cercanía se añadió en ese repositorio, donde vive el acceso a la base.
6. **Implementar HU-08.** Se compara la nueva ubicación contra las mediciones del
   día antes de insertar. Una coincidencia devuelve `409 NEARBY_READING_EXISTS`.
   Un guardado válido mantiene el contrato `201` existente.
7. **Proteger solicitudes simultáneas.** El control y la inserción comparten una
   transacción y un bloqueo por día en PostgreSQL. La consulta de cercanía se hace
   después del bloqueo para ver un registro que otra solicitud acaba de guardar.
8. **Preparar HU-18.** Se creó `npm run data:quality`, que inspecciona estructura,
   restricciones, índices y calidad en una transacción de solo lectura.
9. **Probar con PostgreSQL real.** Se creó un contenedor local descartable con
   datos sintéticos. Se verificaron distancias, fechas, concurrencia, errores y
   detección de datos corruptos. Las pruebas impiden apuntar a una base remota.
10. **Documentar y preparar revisión.** Se actualizaron README y esta bitácora.
    La propuesta debe revisarse antes de incorporarse al servidor del equipo.

## 3. Decisiones de HU-08 que debe conocer el PM

La planificación pide prevenir duplicados dentro de un radio de 50 metros el
mismo día. No especifica todos los detalles de esa regla. Esta implementación
adopta los siguientes criterios, que se presentan para revisión de Ricardo:

- Se compara contra **todas las mediciones del día**, de cualquier estudiante.
- Se rechaza una distancia **menor o igual a 50 metros**.
- El día es el día calendario de **America/Guatemala**, configurable mediante
  `MEASUREMENT_TIME_ZONE`.
- La fecha usada es `timestamp` de la captura. `created_at` corresponde al guardado.
- Se usa Haversine, con un radio terrestre medio de 6 371 008,8 metros.
- No se incorpora una tolerancia por precisión de GPS porque el contrato actual
  no incluye un campo de precisión.

Una referencia anterior del equipo hablaba del último registro del día. Esa
interpretación difiere del control de cualquier medición cercana del plan.
Ejemplo: registrar A, después B a más de 50 metros y regresar a A. Esta propuesta
rechaza el regreso; comparar solo con B podría permitirlo. Asimismo, dos
estudiantes en el mismo punto y día no podrán guardar ambos bajo el alcance global.

| Escenario | Resultado comprobado |
| --- | --- |
| Primera lectura del día | 201, se guarda |
| Segunda lectura a 0, 49,99 o 50 metros | 409, no se inserta |
| Segunda lectura a 50,01 metros | 201, se guarda |
| Misma ubicación otro día local | 201, se guarda |
| Seis solicitudes simultáneas en el mismo punto | Un 201 y cinco 409 |

El bloqueo serializa los guardados del mismo día. Para un prototipo es una
solución simple de revisar. Un despliegue de mayor volumen necesitará medición
de rendimiento. Todos los clientes que escriban deben usar este flujo: el
control de la API no impide una inserción directa que ignore el bloqueo.

## 4. Revisión de la tabla y calidad de datos

El modelo existente contiene ocho columnas, descritas en `prisma/schema.prisma`:

| Campo | Tipo declarado | Uso |
| --- | --- | --- |
| reading_id | UUID | Identificador de la lectura |
| timestamp | TIMESTAMPTZ | Instante de la captura |
| latitude / longitude | DOUBLE PRECISION | Coordenadas GPS |
| student_id | VARCHAR(50) | Carné o identificador del estudiante |
| auth_hash | VARCHAR(64) | Hash recibido del cliente |
| domain_data | JSONB | Métricas y contexto del dispositivo |
| created_at | TIMESTAMPTZ | Momento del guardado |

Esta descripción procede del código. **No acredita la estructura efectiva de
Neon** hasta ejecutar la auditoría contra la conexión correcta del equipo.

El auditor detecta nulos obligatorios, coordenadas inválidas, JSON incompleto,
dB fuera del rango actual, duraciones incorrectas, inconsistencia entre mínimo,
promedio y máximo, diferencia entre valor y métrica y pares cercanos del mismo
día. Verifica el formato SHA-256 sin afirmar autenticidad. No borra ni corrige
datos y no expone el contenido de `auth_hash` o carnés individuales en el informe.

El rango `[-160, 150]` procede del contrato existente y admite dB negativos.
Debe confirmarse con frontend si sus valores son dBFS o dB SPL antes de interpretar
el ruido ambiental. La comparación entre `value_db` y la métrica usa tolerancia
de `0.000001` dB como criterio técnico, no como requisito del jefe.

Los conteos de problemas pueden solaparse. El número de pares cercanos no es el
número de filas duplicadas. Las solicitudes rechazadas no se guardan en esta
tabla; deben revisarse mediante logs o una tarea adicional acordada.

## 5. Uso de VS Code y reproducción

VS Code está instalado y se abrió la carpeta del repositorio. Es el editor:
permite leer y modificar archivos, usar la terminal y revisar cambios de Git.
Git hace la clonación y mantiene el historial; Node ejecuta la API; PostgreSQL
almacena los registros. VS Code facilita el trabajo, pero no sustituye esas herramientas.

En la terminal de la carpeta del backend:

```bash
npm ci
cp .env.example .env
# Completar DB_URL en .env con la conexión del equipo.
npm run prisma:generate
npm run typecheck
npm test
npm run build
npm run dev
```

La API comprueba la conexión antes de arrancar. Con la conexión de ejemplo no
levantará. `.env` está excluido de Git y no se debe subir al repositorio.

Para la revisión real de calidad, una vez configurado `.env`:

```bash
npm run data:quality
```

El resultado se guarda en `reports/`. El README incluye cómo crear la base local
descartable y ejecutar `npm run test:integration`; esa suite no utiliza Neon.

## 6. Evidencia, límites y siguiente paso

- Pasaron la revisión de tipos, la compilación y 22 pruebas: 6 de contrato y
  16 de integración con HTTP y PostgreSQL real.
- El archivo de dependencias original se conservó.
- `npm audit` identificó cuatro entradas de severidad alta en dependencias
  transitivas de la herramienta Prisma, incluyendo `deepmerge-ts` y `mysql2`.
  El arreglo automático sugería cambiar de versión principal de Prisma; no se
  aplicó esa sustitución a la arquitectura del equipo. Se deja como hallazgo.
- La relación carné-dispositivo, la verificación del hash y el token del despliegue
  requieren trabajo adicional de sus historias. El código original solo guarda
  `auth_hash`; esta tarea no convierte ese campo en autenticación.
- HU-18 sigue pendiente de la conexión y auditoría de la base del proyecto.
- HU-08 sigue pendiente de la revisión de sus criterios y de integración y prueba
  con la APK y el servidor del equipo. Las pruebas locales no son una prueba de producción.

### Búsqueda de la conexión solicitada por Marvin

Se buscaron archivos de configuración en las carpetas locales de proyectos,
Documentos, Descargas y los proyectos disponibles del curso. Los `.env`
encontrados corresponden a otro ejercicio con MySQL. Una referencia de ventas
incluye un host de Neon, pero solicita la contraseña de forma interactiva y no
contiene la conexión del backend de ruido.

También se accedió a la cuenta de Neon de Marvin. Solo aparece su organización
personal, con los proyectos `USPG` y `ETL_Sales_BusinessAnalytics`, ambos con una
rama `production`. En las bases `neondb` de esas ramas se ejecutó únicamente:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'noise_readings';
```

Las dos consultas finalizaron correctamente sin resultados. No se copiaron
credenciales de otros ejercicios ni se cambiaron sus tablas. Esta comprobación
no acredita la calidad de los datos del proyecto de ruido: demuestra que su
tabla no está en las dos bases accesibles de esa cuenta. Ricardo debe facilitar
la conexión que usa la API, o compartir el proyecto correcto en Neon.

## 7. Explicación propuesta para Ricardo

Ricardo, ya cloné y preparé el backend. Implementé HU-08 para validar la distancia
antes de guardar en `POST /api/save-audio-record`. Si existe una medición a 50
metros o menos en el mismo día, el endpoint devuelve 409 y no agrega otra fila.
Probé el guardado, el límite de distancia, el cambio de día y solicitudes
simultáneas contra PostgreSQL local; la compilación también pasó.

Dejé una propuesta para revisión. Tomé el día de Guatemala y comparé contra todas
las mediciones del día, incluyendo otros estudiantes. Esos criterios necesitan
quedar acordados contigo porque el plan no los detalla completamente.

Para HU-18 revisé el modelo y preparé un auditor de solo lectura con controles de
nulos, coordenadas, métricas y duplicados. Falta acceso a la base Neon que usa
este backend para comprobar estructura y datos reales con Darwin. Con esa
conexión podemos ejecutar el auditor y cerrar la revisión con evidencia.

## Fuentes de trabajo

- Archivo adjunto `Planificacion Grupo 1.xlsx`: Roles y responsables A3:B3;
  Sprints A4:F9; Backlog C9:F9 y C19:F19. No se editó el archivo original.
- Repositorio original y código del endpoint, esquema Prisma y README en el commit base.
- Referencias locales del curso del 3 de octubre, usadas para identificar la
  diferencia entre último registro y cualquier registro del día.
- PostgreSQL, aislamiento de transacciones:
  https://www.postgresql.org/docs/current/transaction-iso.html
- PostgreSQL, bloqueo por transacción:
  https://www.postgresql.org/docs/current/functions-admin.html
- Prisma 7, transacciones:
  https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions
