# 10 · Contribución y revisión de cambios

[Índice](../README.md) · [Pruebas](../08-pruebas/README.md) · [Trazabilidad](../12-trazabilidad/README.md)

## Flujo acordado para este proyecto

Trabajar en una rama, publicar el cambio y dejar un pull request que Ricardo
pueda revisar antes de integrar. Subir una rama no modifica `main` ni despliega
automáticamente el servidor. No se afirma una protección de ramas impuesta por
GitHub: es el flujo de revisión utilizado por el equipo.

## 1. Revisar y actualizar la copia

```bash
git status
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c docs/nombre-del-cambio
```

Antes de cambiar de rama, guardá y revisá el trabajo propio. Si `pull --ff-only`
se detiene por divergencia, resolvé la situación con el equipo; no se utiliza
`reset --hard`, force push o borrado de archivos para ocultarla.

Convenciones sugeridas: `feat/` para funciones, `fix/` para correcciones,
`docs/` para documentación. Son nombres de trabajo, no requisitos automáticos de GitHub.

## 2. Mantener código y documentación coherentes

| Si cambia… | Revisar también… |
| --- | --- |
| Método, URL o autenticación | Tabla del README, referencia HTTP, endpoint y OpenAPI. |
| Payload o validación | Esquema Zod, ejemplo JSON, contrato OpenAPI y casos de prueba. |
| Paginación o campos devueltos | Guía de registros, OpenAPI, pruebas e integración del consumidor. |
| Variable de entorno | `.env.example`, configuración, instalación y operación. |
| Regla del radio o día | Repositorio, HU-08, auditoría y casos geográficos/temporales. |
| Estructura de BD | Modelo, procedimiento de migración aprobado y diccionario de datos. |

Las propuestas nuevas se identifican como tales. No se presenta una regla
colaborativa de otro grupo como implementada sin verificarla en el código.

## 3. Revisar antes de registrar

```bash
git diff
git diff --check
git status --short
```

Para código, ejecutar los checks pertinentes de [pruebas](../08-pruebas/README.md).
Para documentación, comprobar enlaces relativos, ejemplos, rutas y correspondencia
con la implementación. Las evidencias deben indicar fecha, entorno y límites.

No se agregan `.env`, reportes privados, `node_modules`, cliente generado ni
logs con datos personales. Revisá la lista concreta de archivos; que algo no
aparezca en `.gitignore` no significa que deba publicarse.

## 4. Commit y publicación de la rama

```bash
git add README.md docs/
git diff --cached --stat
git diff --cached
git commit -m "docs: describe API setup, contracts and operation"
git push -u origin docs/nombre-del-cambio
```

El ejemplo anterior prepara documentación; para código elegí explícitamente sus
archivos. No incluyas cambios ajenos solo porque estén en la carpeta.

En VS Code podés usar Control de código fuente: revisar archivos → preparar
cambios → escribir mensaje → Commit → Publicar rama o Push. La barra inferior
debe mostrar la rama correcta. Los indicadores visuales ayudan, pero `git status`
y la rama remota permiten confirmar el resultado.

## 5. Pull request para Ricardo

El PR debe indicar problema o tarea, comportamiento resultante, alcance,
validaciones ejecutadas y decisiones pendientes. Un borrador permite compartir
trabajo revisable sin afirmar que ya fue aprobado.

Propuesta de estructura:

```text
Qué resuelve: tarea y resultado concreto.
Qué incluye: rutas, contratos o documentación afectados.
Cómo se verificó: comandos, resultados y entorno.
Qué debe revisar Ricardo: decisiones y límites relevantes.
```

La aprobación, integración y despliegue son estados diferentes. Un check local
aprobado no equivale a revisión humana ni a CI ejecutada en GitHub.

## 6. Confirmar que está visible

```bash
git status --short --branch
git log -1 --oneline
git ls-remote origin refs/heads/docs/nombre-del-cambio
```

Compará el hash local con el publicado y abrí la rama o PR en GitHub.
Si falla la autenticación, el cambio puede estar registrado localmente pero
todavía no publicado; no se debe decir «ya está en GitHub» sin verificarlo.

Después de la integración, actualizar `main` de nuevo. No borres una rama con
cambios pendientes o sin comprobar que el equipo ya conserva su trabajo.
