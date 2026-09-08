# Plantilla de curso

Este repositorio contiene un curso importable por la plataforma. **Todo lo que
necesitas saber está en estos archivos**: no hace falta consultar ninguna
documentación externa.

- **¿Eres una persona?** Sigue leyendo.
- **¿Eres un agente de IA?** Lee [`AGENTS.md`](./AGENTS.md).

---

## Cómo funciona

La plataforma lee este repositorio, convierte los archivos en módulos y
lecciones, y te muestra una vista previa antes de crear nada. Cuando vuelvas a
importar, solo se aplican los cambios: las lecciones que no tocaste se quedan
como están.

Puedes editar el contenido con cualquier editor y subirlo con Git normal. No
hay panel que rellenar ni formato propietario: son archivos Markdown y YAML.

## Estructura

```
course.yaml                        <- metadatos del curso (obligatorio)
modules/
  01-fundamentos/                  <- un módulo por carpeta
    module.yaml                    <- título del módulo (opcional)
    01-bienvenida.md               <- lección de texto
    02-video-introductorio.md      <- lección de video
    03-material-de-lectura.md      <- lección de PDF
    04-podcast-entrevista.md       <- lección de audio
    05-evaluacion.yaml             <- examen
  02-practica/
    module.yaml
    01-ejercicio-guiado.md
```

**El orden lo marca el prefijo numérico** del nombre de carpetas y archivos
(`01-`, `02-`, ...). Un archivo sin prefijo se coloca al principio.

Si una carpeta de módulo no tiene `module.yaml`, el título se deduce del
nombre: `01-fundamentos` → «Fundamentos».

## `course.yaml`

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| `title` | Sí | Nombre del curso |
| `description` | Sí | Descripción breve |
| `duration` | Sí | Texto libre, p. ej. `"4 semanas"` |
| `level` | Sí | Texto libre, p. ej. `"Principiante"` |
| `startDate` | Sí | `"AAAA-MM-DD"`, **siempre entre comillas** |
| `icon` | No | Icono de la ficha (por defecto `code`) |
| `color` | No | Color de acento (por defecto `green`) |
| `enableChecklist` | No | Checklist de progreso (por defecto `true`) |
| `enableRanking` | No | Ranking del curso (por defecto `true`) |

## Tipos de lección

Hay cinco. Los cuatro primeros son archivos `.md` con *frontmatter*; el examen
es un `.yaml`.

### `text` — contenido escrito

```markdown
---
title: "Bienvenida"
type: text
---

# Encabezado

Markdown normal: **negrita**, listas, tablas, bloques de código, citas.
```

### `video`, `pdf`, `podcast` — contenido enlazado

Los tres funcionan igual y **requieren el campo `url`**:

```markdown
---
title: "Video introductorio"
type: video
url: "https://example.com/video.mp4"
---

Texto opcional que se muestra como descripción.
```

Cambia `type` por `pdf` o `podcast` según el material. La `url` debe ser un
enlace público y directo al archivo.

### `exam` — evaluación

Siempre en un archivo `.yaml`:

```yaml
title: "Evaluación del módulo"
type: exam

settings:
  duration: 10        # minutos; por defecto 15

questions:
  - text: "¿Pregunta?"
    options:
      - text: "Respuesta correcta"
        correct: true
      - text: "Respuesta incorrecta"
        correct: false
```

Puedes marcar **más de una opción** como `correct: true`. El examen necesita al
menos una pregunta, y cada pregunta al menos una opción.

## Reglas importantes

Estas son las causas habituales de que una importación falle:

1. **Dentro de una carpeta de módulo, todo archivo `.md` o `.yaml` se trata
   como una lección** (excepto `module.yaml`). No dejes ahí notas, borradores
   ni READMEs: fallarán al no tener un `type` válido. Guárdalos fuera de
   `modules/`.
2. **`startDate` debe ir entre comillas.** Sin ellas YAML lo convierte en fecha
   y el error resultante es confuso.
3. **`type: exam` solo en archivos `.yaml`.** Un `.md` no puede ser examen, y un
   `.yaml` de lección no puede ser otra cosa.
4. **`video`, `pdf` y `podcast` requieren `url`.**
5. **Solo se importan archivos `.md`, `.yaml` y `.yml`.** Imágenes, PDFs y
   vídeos guardados en el repositorio se ignoran: súbelos a un alojamiento
   público y enlázalos por URL.
6. Los archivos sueltos directamente en `modules/` (fuera de una carpeta de
   módulo) se ignoran.

## Añadir contenido

- **Nueva lección:** crea el archivo en la carpeta del módulo con el prefijo
  numérico que le corresponda.
- **Nuevo módulo:** duplica una carpeta de `modules/`, renumérala y ajusta su
  `module.yaml`.
- **Reordenar:** cambia los prefijos numéricos.
- **Renombrar un archivo** equivale a borrar la lección anterior y crear una
  nueva. Si solo quieres cambiar el título visible, edita `title` en el
  frontmatter y deja el nombre del archivo como está.

Cuando termines, haz commit y push, y vuelve a importar desde la plataforma:
verás una vista previa de los cambios antes de confirmarlos.
