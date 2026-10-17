# Documentación de Noise Monitor API

Guías del backend del Grupo 1. Esta edición describe el código integrado en
`main` hasta `b33ded9`, revisado el **17 de octubre de 2026**. Los cambios de
documentación se entregan en una rama independiente para revisión de Ricardo.

## Elegí por dónde empezar

| Si necesitás… | Leé… | Resultado esperado |
| --- | --- | --- |
| Entender el proyecto rápidamente | [README principal](../README.md) | Conocer alcance, rutas y puesta en marcha. |
| Instalar y ejecutar el backend | [01 · Instalación](01-instalacion/README.md) | API local conectada a una base existente. |
| Preparar `.env` correctamente | [02 · Configuración](02-configuracion/README.md) | Entender cada variable y la API key. |
| Comprender el recorrido de una petición | [03 · Arquitectura](03-arquitectura/README.md) | Identificar capas, archivos y transacciones. |
| Consumir la API | [04 · Referencia HTTP](04-api/README.md) | Usar contratos, autenticación y errores. |
| Enviar una medición | [Guardar medición](04-api/guardar-medicion/README.md) | Construir el JSON y manejar `201`, `400`, `401`, `409`. |
| Leer mediciones por páginas | [Consultar registros](04-api/consultar-registros/README.md) | Navegar con `page`, `limit` y metadatos. |
| Verificar disponibilidad | [Estado del servicio](04-api/estado-servicio/README.md) | Interpretar `200` y `503` del health-check. |
| Importar el contrato en un cliente | [OpenAPI 3.0.3](04-api/openapi.yaml) | Disponer de rutas y modelos legibles por herramientas. |
| Comprender los datos persistidos | [05 · Base de datos](05-base-de-datos/README.md) | Reconocer columnas, JSON, conexiones y límites del esquema. |
| Entender HU-08 y auditar HU-18 | [06 · Reglas y calidad](06-reglas-y-calidad/README.md) | Distinguir validación, prevención y auditoría. |
| Entender las protecciones reales | [07 · Seguridad](07-seguridad/README.md) | Configurar acceso sin confundirlo con identidad del estudiante. |
| Ejecutar verificaciones reproducibles | [08 · Pruebas](08-pruebas/README.md) | Verificar HTTP y PostgreSQL sin alterar Neon. |
| Compilar, operar y diagnosticar | [09 · Operación](09-operacion/README.md) | Arrancar la build, revisar logs y apagar el servicio. |
| Aportar cambios al repositorio | [10 · Contribución](10-contribucion/README.md) | Preparar una rama y un pull request revisable. |
| Resolver un fallo concreto | [11 · Solución de problemas](11-solucion-de-problemas/README.md) | Encontrar causa, comprobación y siguiente acción. |
| Revisar evidencias y decisiones | [12 · Trazabilidad](12-trazabilidad/README.md) | Separar implementación actual de informes históricos. |

## Recorridos recomendados

**Nueva incorporación:** instalación → configuración → arquitectura → referencia HTTP → pruebas.

**Frontend o integración:** configuración de API key → referencia HTTP → endpoint necesario → errores.

**QA:** contratos → reglas y calidad → pruebas → trazabilidad.

**Ricardo y revisión del proyecto:** README principal → arquitectura → seguridad → trazabilidad → pull request.

## Convenciones de lectura

- Los comandos se ejecutan desde la raíz del repositorio, salvo indicación explícita.
- Las URLs con `localhost:3000` corresponden al entorno local. No se afirma una URL de producción.
- Los ejemplos contienen datos sintéticos y marcadores; no incluyen credenciales reales.
- Un estado HTTP exitoso no acredita precisión acústica, identidad del estudiante ni despliegue.
- «Implementado» significa comprobable en el código; «propuesto» o «pendiente» requiere trabajo o decisión adicional.

El código y los esquemas Zod son la referencia del comportamiento. Si cambia un
contrato, se deben actualizar juntos su guía, OpenAPI, ejemplos y pruebas.

## Informes históricos conservados

Estos documentos registran lo ocurrido en su fecha; no sustituyen las guías actuales:

- [Avance de HU-08/HU-18, 5–6 de octubre](INFORME_AVANCE_MARVIN.md).
- [Auditoría real HU-18, 6 de octubre](AUDITORIA_HU18_NEON.md).
- [Entrega inicial HU-30, 10 de octubre](HU30_CONSULTA_REGISTROS.md).
- [Evidencia HU-18](evidencia/HU18_NEON_2026-10-06.json).
- [Evidencia HU-30](evidencia/HU30_VERIFICACION_2026-10-10.json).

Los conteos de esas auditorías son instantáneas. La incorporación posterior de
API key y la integración de HU-30 se explican en [trazabilidad](12-trazabilidad/README.md).

[Volver al proyecto](../README.md)
