# 07 · Seguridad y alcance del control de acceso

[Índice](../README.md) · [Configuración](../02-configuracion/README.md) · [Operación](../09-operacion/README.md)

## Autenticación de consumidores con API key

Las rutas de guardado y consulta ejecutan `requireApiKey`. Si el servidor tiene
`API_KEY`, se exige un encabezado `x-api-key` que coincida con ella. Si no existe,
el middleware deja continuar. No hay una obligación automática de definirla al
usar `NODE_ENV=production`.

```http
x-api-key: <CLAVE_DEL_ENTORNO>
```

El código compara buffers de igual longitud con `timingSafeEqual`; primero
rechaza longitudes distintas. Esto no constituye por sí solo un sistema de
sesiones, permisos o identificación de cada persona. La clave es compartida
por los consumidores del entorno y no hay roles diferenciados de lectura/escritura.

Ante clave ausente o incorrecta cuando se exige:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API key inválida o ausente"
  }
}
```

El health-check es público y expone únicamente el resultado de conectividad.

## Qué hace cada identificador

| Elemento | Función real | No demuestra |
| --- | --- | --- |
| `API_KEY` / `x-api-key` | Autorizar al consumidor que conoce la clave del entorno. | Identidad de un estudiante o un dispositivo específico. |
| `student_id` | Carné o identificador declarado en la medición. | Que el remitente sea realmente ese estudiante. |
| `auth_hash` | Texto recibido y almacenado. | Firma válida, contraseña verificada o sesión autenticada. |
| `reading_id` | Identificador único de una fila. | Autorización para acceder a datos. |

No hay OAuth, JWT, registro de usuarios, recuperación de contraseña, MFA, control
por carné, revocación individual o relación carné-dispositivo implementados.
No se debe presentar la API key como cumplimiento de todos esos requisitos.

## Controles existentes

| Control | Dónde actúa | Límite |
| --- | --- | --- |
| Helmet y `x-powered-by` desactivado | Encabezados HTTP. | No reemplaza control de acceso. |
| JSON limitado a 64kb | Parser global. | Error de exceso de tamaño no tiene traducción HTTP específica propia. |
| Zod estricto | Nuevos payloads y query de registros. | No sanea filas históricas ni verifica identidad. |
| Consultas parametrizadas y Prisma | Repositorio y auditoría. | No limita por sí solo privilegios de la cuenta de BD. |
| Exclusión de columna `auth_hash` en GET | Selección del repositorio. | `domain_data` histórico se devuelve sin filtrar claves internas. |
| CORS configurable | Navegadores. | No bloquea clientes fuera del navegador. |
| Detalles internos omitidos en producción | Respuesta genérica de error 500. | Los logs siguen necesitando revisión y protección. |
| Bloqueo transaccional HU-08 | Guardados coordinados. | No cubre escritores que accedan directamente a la tabla. |

## Tratamiento de claves y datos

La clave de la API debe configurarse en el servidor y entregarse por el canal
acordado. No se envía como parámetro de query: el logger registra `originalUrl`,
incluidos sus parámetros. Las URLs con secretos pueden terminar en logs o historial.

Los ejemplos usan variables o marcadores. `.env` está ignorado, pero Git no
elimina automáticamente un secreto que ya se haya versionado en el pasado.
Antes del commit se revisan los archivos preparados y los nombres ignorados.

GET `/api/records` entrega carné y coordenadas. Eso requiere definir consumidores
autorizados y propósito de uso. No hay anonimización automática. Una clave
incluida en código cliente distribuido puede extraerse: para un tablero web que
necesite mantenerla privada, el equipo debe evaluar una capa de servidor o un
mecanismo de acceso distinto. Esa capa no se incorpora en esta entrega.

## Operación pendiente de definición por entorno

- Exigir una API key adecuada en el despliegue y acordar su rotación. El proyecto no tiene endpoint de rotación.
- Configurar HTTPS en la infraestructura: el servidor Node actual usa HTTP y no administra certificados.
- Limitar privilegios de la cuenta de BD según tareas necesarias.
- Acordar rate limiting, observación y límites de red en la infraestructura o como tareas futuras.
- Revisar retención y acceso a logs, carnés, coordenadas y reportes.

Son decisiones operativas o mejoras pendientes, no funciones que esta guía
declare implementadas. No se cambian permisos, claves, CORS del servidor real
ni infraestructura al subir documentación.

Fuentes: [middleware de API key](../../src/app/middlewares/api-key.ts),
[orden de rutas](../../src/app/routes/index.ts), [aplicación](../../src/app/app.ts)
y [manejo de errores](../../src/app/middlewares/error-handler.ts).
