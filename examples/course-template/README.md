# Plantilla de curso

Esta carpeta es el punto de partida para crear un curso importable en la
plataforma. Estructura:

- `course.yaml` — metadata del bootcamp (título, descripción, duración, etc.)
- `modules/NN-nombre/` — un módulo por carpeta, numerada para ordenar
  - `module.yaml` (opcional) — título del módulo, si no quieres derivarlo
    del nombre de la carpeta
  - `NN-nombre.md` — lección de texto (`type: text`), video/pdf/podcast
    (`type: video|pdf|podcast` + `url` en el frontmatter)
  - `NN-nombre.yaml` — lección de examen (`type: exam`)

Ver `docs/superpowers/specs/2026-07-25-course-git-import-design.md` en el
repositorio de la plataforma para el formato completo.
