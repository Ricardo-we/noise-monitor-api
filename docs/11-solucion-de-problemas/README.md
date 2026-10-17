# 11 · Solución de problemas

[Índice](../README.md) · [Configuración](../02-configuracion/README.md) · [Operación](../09-operacion/README.md)

Empezá por identificar si el fallo ocurre al instalar, arrancar, autenticar,
validar datos o consultar la BD. No hace falta reemplazar la conexión ni borrar
la tabla para resolver un error de HTTP.

| Síntoma | Causa probable | Comprobación y acción |
| --- | --- | --- |
| Prisma rechaza Node | Versión incompatible con su engine. | Revisar versión; Prisma 7.10 exige `^20.19 || ^22.12 || >=24.0`. |
| Falta el cliente generado | No se ejecutó generate o cambió el modelo. | `npm run prisma:generate`, después typecheck. |
| `[env] Configuración inválida` | Falta DB_URL, API_KEY vacía u otra variable inválida. | Leer los nombres de campos indicados; comparar `.env.example` sin publicar valores. |
| `API_KEY=""` impide arrancar | El esquema exige al menos un carácter si se define. | Establecer clave adecuada; omitirla solo en un entorno que deba funcionar sin clave. |
| La API no escucha | Falló ping de arranque, host o puerto. | Revisar el último log de arranque y la configuración del proceso. |
| Puerto ocupado / `EADDRINUSE` | Otro proceso usa PORT. | Cerrar el proceso propio anterior o elegir otro puerto; no terminar procesos ajenos sin identificarlos. |
| Health-check 200 pero records falla | Ping no comprueba tabla/esquema/permisos. | Revisar error de consulta y existencia de `public.noise_readings`. |
| `401 UNAUTHORIZED` | Clave no coincide, variable de cliente sin definir o servidor equivocado. | Verificar `API_KEY` en el servidor y envío de `x-api-key`; reiniciar después de cambios. |
| POST 400 | Contrato o JSON inválido. | Revisar código y details; no enviar números como strings ni claves adicionales. |
| GET records 400 | Query vacía, repetida, malformada, desconocida o fuera de límites. | Probar `?page=1&limit=20`; revisar la guía de paginación. |
| POST 409 de cercanía | Ya existe lectura a <=50 m el mismo día local. | Comportamiento esperado; cambiar carné no lo evita. No borrar registros para hacer pasar el POST. |
| GET 200 con lista vacía | Tabla vacía o página fuera de rango. | Revisar total y total_pages; pedir página 1. |
| Ruta 404 | URL o método no declarado. | Revisar `/api` y nombres exactos; no existe `/api/v1` ni `/api/record`. |
| Navegador bloquea CORS, curl funciona | Origen no permitido o configuración del consumidor. | Comparar esquema/host/puerto y reiniciar API tras cambiar CORS_ORIGIN. |
| `npm start` no encuentra entrada | Falta build o se usa ruta de salida incorrecta. | `npm run build`; la entrada es `dist/src/index.js`. |
| Docker no conecta con su socket | Docker Desktop no está listo. | Iniciar Docker Desktop y comprobar `docker info`. |
| Tests integración devuelven 401 | Heredaron API_KEY de `.env` o del proceso. | Ejecutar el aislamiento dotenv de la guía de pruebas; no desactivar el servidor real. |
| Suite rechaza TEST_DB_URL | Host o nombre de BD fuera del entorno permitido. | Usar únicamente la base local descartable noise_monitor_test. |
| `AUDIT_FAILED` | Error del auditor no clasificado o tiempo de consulta. | Revisar acceso, tabla y volumen; no tratarlo como reporte sin anomalías. |
| `TABLE_NOT_FOUND` en auditoría | No está la tabla esperada en public. | Confirmar entorno, esquema y preparación con el responsable. |
| `DB_URL_MISSING` en auditoría | Falta conexión o conserva un marcador de plantilla. | Completar conexión autorizada en `.env`. |

## Diagnóstico de conexión, sin exponer credenciales

1. Confirmar que la API usa `DB_URL`, no solo `DATABASE_URL`.
2. Confirmar proyecto, rama y base con el responsable; evitar mezclar ejercicios.
3. Revisar disponibilidad de red y permisos de esa conexión.
4. Para PostgreSQL local de pruebas, comprobar `sslmode=disable` explícito.
5. Para Neon, usar la cadena proporcionada con su configuración TLS; no desactivar SSL para resolver el síntoma.
6. Reiniciar el proceso tras editar configuración.

Los mensajes P1001/P1002 tienen traducción propia; otros errores de driver
pueden terminar como 500. Capturá estado y `error.code`, no solo el texto visible.

## Si una petición perdió la respuesta

Un timeout del cliente no prueba que un POST haya sido revertido. Consultá el
estado de las mediciones o coordiná la revisión antes de repetir. La API no
implementa idempotencia y el segundo intento puede generar 409 aunque el primero
sí se haya guardado.

## Datos mínimos para pedir ayuda

- Fecha y hora con zona, versión/commit del código y entorno local o compartido.
- Método, ruta y parámetros sin secretos.
- Estado HTTP, `error.code` y pasos para reproducir con datos sintéticos.
- Qué se esperaba y qué se recibió.
- Resultado del health-check y si falló antes o después del arranque.

No incluyas la cadena de conexión, claves reales, carnés o ubicaciones individuales
en un issue público. Un ejemplo reproducible sintético suele bastar para revisar
el contrato sin publicar información de la base del equipo.
