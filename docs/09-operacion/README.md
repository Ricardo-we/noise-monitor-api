# 09 · Operación, compilación y mantenimiento

[Índice](../README.md) · [Configuración](../02-configuracion/README.md) · [Diagnóstico](../11-solucion-de-problemas/README.md)

## Desarrollo y ejecución compilada

| Modo | Comando | Comportamiento |
| --- | --- | --- |
| Desarrollo | `npm run dev` | `tsx watch src/index.ts`, con recarga al cambiar código. |
| Compilación | `npm run build` | Genera `dist/` con TypeScript. |
| Ejecución compilada | `npm start` | Ejecuta `node dist/src/index.js`. |

La secuencia habitual de preparación del artefacto es:

```bash
npm ci
npm run prisma:generate
npm run typecheck
npm test
npm run build
```

Después de configurar el entorno autorizado, `npm start` abre el servicio.
No elimina ni migra tablas. En una plataforma de despliegue, la etapa de build
requiere las herramientas de desarrollo para generar y compilar; instalar solo
dependencias de producción antes de esa etapa puede dejar sin Prisma CLI o TypeScript.

Este repositorio no incluye Dockerfile, configuración de un proveedor,
pipeline CI ni procedimiento de despliegue automatizado. Estos pasos documentan
el proceso del servicio, no acreditan que exista un despliegue productivo.

## Secuencia de arranque

1. dotenv y validación de entorno.
2. Creación del adaptador PostgreSQL y Prisma Client.
3. Conexión y ping `SELECT 1`.
4. Registro de conexión verificada.
5. Creación de Express y apertura de `HOST:PORT`.

Ante un fallo capturado por el arranque se registra un error y se termina con
código 1. Variables inválidas terminan antes, desde el módulo de configuración.
Un ping exitoso no asegura que la tabla y todos los permisos existan.

## Comprobación después de iniciar

```bash
curl -i http://localhost:3000/api/health-check
curl -i 'http://localhost:3000/api/records?page=1&limit=1' \
  -H "x-api-key: ${NOISE_API_KEY}"
```

La primera confirma conectividad básica; la segunda, acceso y consulta de la
tabla. Una tabla vacía puede responder correctamente con `data: []`.
El POST de comprobación debe realizarse en una base de desarrollo preparada para
ello; no se introduce una fila en producción solo para confirmar que arranca.

## Logs

El logger escribe una línea JSON por evento. Ejemplo sintético:

```json
{
  "level": "info",
  "time": "2026-10-17T18:00:00.000Z",
  "message": "request",
  "method": "GET",
  "path": "/api/records?page=1&limit=20",
  "status": 200,
  "duration_ms": 12.5
}
```

Se registran método, URL original, estado y duración para peticiones que llegan
al logger. También se registra identificador y métrica al guardar. Los errores
de parseo que ocurren antes del logger se registran por el manejador de errores;
el preflight puede resolverse antes de llegar a él.

`LOG_LEVEL` controla el filtro del logger propio. Los logs Prisma tienen su
configuración separada: `error` en producción, `warn` y `error` en otros modos.
No hay agregación, retención, métricas Prometheus ni identificador de correlación
implementados. El operador debe acordar cómo recolectar y proteger la salida.

El logger no registra por diseño el body completo ni el encabezado de API key,
pero URLs y mensajes de error pueden contener información del contexto. Revisá
los logs antes de compartirlos; no se promete una redacción automática universal.

## Apagado

`SIGINT` y `SIGTERM` dejan de aceptar nuevas conexiones HTTP, esperan el cierre
del servidor y desconectan Prisma. El proceso finaliza con 0 en ese camino.
No se ha implementado un timeout máximo ni manejo de un segundo cierre forzado.

## Configuración para un entorno compartido

El responsable debe confirmar:

- `NODE_ENV=production` y una `API_KEY` definida adecuadamente.
- DB_URL del proyecto, rama y base destinados a ese entorno.
- Host y puerto compatibles con la plataforma.
- CORS para el consumidor previsto.
- Zona horaria coherente entre instancias y escritores.
- HTTPS, límites de red y reinicio del proceso provistos por la infraestructura.
- Permisos de BD y respaldo/restauración acordados.

Son condiciones operativas que deben verificarse; no se modifican al subir los
README. El servidor no instala certificados ni configura un proxy por sí solo.

## Actualizaciones y regreso a una versión previa

Registrar commit, configuración y resultado de verificación antes de actualizar.
La reversión del código requiere elegir una versión compatible con el esquema
y volver a desplegarla mediante el procedimiento del equipo. Revertir un commit
no restaura datos borrados ni deshace migraciones ejecutadas fuera del servicio.

Esta entrega documental no introduce migraciones y puede revisarse sin cambios
de BD. La integración a `main` y cualquier despliegue siguen sujetos al proceso
de aprobación del proyecto.
