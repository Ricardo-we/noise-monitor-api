# 01 · Instalación y primer arranque

[Índice](../README.md) · [Siguiente: configuración](../02-configuracion/README.md)

## Objetivo

Ejecutar una copia del backend en tu computadora y comprobar que puede consultar
PostgreSQL. Esta guía usa una base existente del equipo o una base de desarrollo
preparada por su responsable. El arranque no crea tablas ni ejecuta migraciones.

## 1. Requisitos

| Herramienta o acceso | Para qué sirve | Comprobación |
| --- | --- | --- |
| Git | Clonar y trabajar en ramas. | `git --version` |
| Node.js compatible con Prisma 7.10 | Ejecutar la API y herramientas. | `node --version` |
| npm | Instalar lo fijado en `package-lock.json`. | `npm --version` |
| PostgreSQL accesible y tabla existente | Guardar y consultar mediciones. | Health-check después del arranque. |
| Cadena de conexión autorizada | Configurar `DB_URL`. | Solicitarla al responsable por el canal acordado. |
| Editor, por ejemplo VS Code | Leer y modificar el proyecto. | Opcional: `code .` |

`package.json` declara Node `>=20`, pero Prisma 7.10 instalado exige
`^20.19 || ^22.12 || >=24.0`. Por tanto, Node 20.0 no cumple todos los requisitos.
Un Node 22.12 o posterior de la rama 22, o una versión 24 compatible, satisface
ese rango. Las verificaciones de esta entrega se realizaron con Node 26.5.0.

Docker solo se necesita para el recorrido de pruebas de PostgreSQL local.
No es requisito para conectarse a una base existente en Neon.

## 2. Clonar y abrir

```bash
git clone https://github.com/Ricardo-we/noise-monitor-api.git
cd noise-monitor-api
code .
```

Si ya tenés una copia, revisá primero `git status`. Con los cambios propios
guardados, podés actualizar `main` sin crear una mezcla automática:

```bash
git switch main
git pull --ff-only origin main
```

Si Git informa cambios locales o divergencia, seguí la guía de
[contribución](../10-contribucion/README.md). No descartes archivos para forzar la actualización.

## 3. Instalar dependencias

```bash
npm ci
```

Se usa `npm ci` para respetar el archivo de versiones bloqueadas. Puede recrear
`node_modules`, pero no debe cambiar `package.json` ni `package-lock.json`.
No se requieren paquetes globales de TypeScript, Prisma o tsx.

## 4. Crear la configuración local

macOS, Linux o Git Bash:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Si `.env` ya existe, conservá sus valores y comparalo con la plantilla: no lo
sobrescribas. Completá `DB_URL` y reemplazá el marcador de `API_KEY` por la clave
acordada para ese entorno. Consultá la [tabla completa de variables](../02-configuracion/README.md).

La cadena debe apuntar al proyecto, rama y base correctos. Tener una cuenta
personal de Neon no equivale a tener acceso a la base compartida de la universidad.

## 5. Generar el cliente y revisar la instalación

```bash
npm run prisma:generate
npm run typecheck
```

`prisma:generate` produce el cliente en `src/generated/prisma`, excluido de Git.
Generar código no crea ni actualiza la tabla. No ejecutes `prisma:migrate` como
paso de instalación contra la base compartida.

## 6. Arrancar en desarrollo

```bash
npm run dev
```

La secuencia real es: validar configuración → conectar Prisma → ejecutar
`SELECT 1` → abrir el puerto HTTP. Si falla la conexión, el proceso termina sin
dejar una API escuchando. `tsx watch` reinicia el proceso cuando cambia el código.

Con los valores predeterminados se escucha en el puerto `3000`. `HOST=0.0.0.0`
significa escuchar en todas las interfaces; para una sesión solo local podés
configurar `HOST=127.0.0.1` antes del arranque.

## 7. Comprobar el resultado

En otra terminal:

```bash
curl -i http://localhost:3000/api/health-check
```

Respuesta esperada:

```json
{ "status": "ok", "database": "ok" }
```

Para una ruta protegida, usá una variable de tu terminal con la clave del entorno:

```bash
curl -i 'http://localhost:3000/api/records?page=1&limit=2' \
  -H "x-api-key: ${NOISE_API_KEY}"
```

`NOISE_API_KEY` es una variable del cliente usada en estos ejemplos; la API lee
`API_KEY`. No se cargan automáticamente las variables de `.env` en la terminal
de `curl`. Si no definiste la variable del cliente, la petición no enviará una clave válida.

Esta comprobación solo lee. Para ensayar el POST sin crear datos en la base
compartida, utilizá el entorno descartable de [pruebas](../08-pruebas/README.md).

## 8. Detener o ejecutar la build

`Ctrl+C` solicita cierre del servidor y del cliente Prisma. Para ejecutar el
código compilado:

```bash
npm run build
npm start
```

El punto de entrada compilado es `dist/src/index.js`, no `dist/index.js`.

## Criterio de instalación terminada

- Dependencias y cliente generado sin errores.
- Variables válidas y conexión correspondiente al entorno deseado.
- Health-check con `200` y base `ok`.
- Consulta protegida con la clave correcta, si `API_KEY` está configurada.

Ante un fallo, revisá [solución de problemas](../11-solucion-de-problemas/README.md).
