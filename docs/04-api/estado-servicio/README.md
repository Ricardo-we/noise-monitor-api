# GET /api/health-check · Estado del servicio

[Referencia HTTP](../README.md) · [Operación](../../09-operacion/README.md)

## Uso

```bash
curl -i http://localhost:3000/api/health-check
```

La ruta es pública. No requiere `x-api-key`, parámetros ni body. El controlador
llama a `noiseReadingRepository.ping()`, que ejecuta `SELECT 1` en la BD.

## Conexión disponible: 200 OK

```json
{ "status": "ok", "database": "ok" }
```

Esto demuestra que el proceso atendió HTTP y pudo ejecutar una consulta simple.
No demuestra que `noise_readings` exista, tenga el esquema esperado, permita
insertar o contenga mediciones de buena calidad. Para eso existen pruebas y auditoría.

## Consulta fallida: 503 Service Unavailable

```json
{ "status": "error", "database": "unavailable" }
```

El controlador captura cualquier error del ping, lo registra y usa esta
respuesta. Su forma no es `{ error: ... }`; una integración de monitoreo debe
tratar este caso expresamente.

## Interpretación operativa

| Observación | Interpretación posible | Próximo paso |
| --- | --- | --- |
| HTTP 200, `database: ok` | Conectividad básica disponible. | Consultar una página con clave para verificar el flujo real de datos. |
| HTTP 503 | El proceso HTTP responde, pero falla el ping. | Revisar logs, acceso y conexión a la BD. |
| Conexión HTTP rechazada | El proceso no escucha, no arrancó o se usa host/puerto incorrecto. | Comprobar arranque y variables. |
| Respuesta tarda | Puede existir espera de red o de la BD. | Revisar el entorno; no se ha fijado un SLA de respuesta. |

El arranque ya hace un ping antes de abrir HTTP. Si falla al iniciar, no habrá
una respuesta 503 de health-check: el servidor todavía no llegó a escuchar.

La sonda consulta realmente la base; programar una frecuencia excesiva aumenta
tráfico. La periodicidad del monitoreo y los límites externos deben acordarse
según el entorno. No se instala ni programa un monitor con esta documentación.
