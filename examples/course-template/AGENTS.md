# AGENTS.md — generar contenido de curso en este repositorio

Instrucciones para agentes de IA que crean o editan cursos aquí. Este archivo
es autosuficiente: contiene el formato completo. No busques documentación
fuera de este repositorio.

La referencia para personas está en [`README.md`](./README.md).

## Qué es este repositorio

Un curso que una plataforma de formación importa directamente desde Git. Los
archivos **son** el curso: no hay base de datos que editar ni panel que
rellenar. Al importar, la plataforma calcula un diff y solo aplica lo que
cambió.

## Contrato de formato

Respétalo al pie de la letra. Un desvío no degrada el resultado: **rompe la
importación entera** con un error sobre un archivo concreto.

### Disposición

```
course.yaml                     obligatorio, en la raíz de la ruta del curso
modules/<NN-slug>/              un módulo por carpeta
  module.yaml                   opcional, solo define el título
  <NN-slug>.md                  lección text | video | pdf | podcast
  <NN-slug>.yaml                lección exam
```

- El **orden** de módulos y lecciones sale del prefijo numérico del nombre
  (`01-`, `02-`, ...). No existe ningún campo `order`; no lo inventes.
- Sin `module.yaml`, el título del módulo se deriva del nombre de la carpeta:
  `01-fundamentos` → «Fundamentos».
- Sin `title` en el frontmatter, el título de la lección se deriva igual del
  nombre del archivo.

### `course.yaml`

```yaml
title: "..."           # obligatorio
description: "..."     # obligatorio
duration: "4 semanas"  # obligatorio, texto libre
level: "Principiante"  # obligatorio, texto libre
startDate: "2026-01-01" # obligatorio, AAAA-MM-DD ENTRE COMILLAS
icon: "code"           # opcional
color: "green"         # opcional
enableChecklist: true  # opcional
enableRanking: true    # opcional
```

Faltar cualquiera de los cinco obligatorios aborta la importación.

### Lecciones `.md`

```markdown
---
title: "Título visible"
type: text        # text | video | pdf | podcast   (nunca exam)
url: "https://…"  # OBLIGATORIO si type es video, pdf o podcast
---

Cuerpo en Markdown. En `text` es el contenido de la lección; en los otros
tres es una descripción opcional bajo el reproductor o visor.
```

### Lecciones `.yaml` (exámenes)

```yaml
title: "Evaluación"
type: exam        # obligatorio y único valor admitido en un .yaml de lección

settings:
  duration: 10    # minutos; por defecto 15

questions:        # al menos una
  - text: "¿Pregunta?"
    options:      # al menos una
      - text: "Opción"
        correct: true    # puede haber varias correctas
```

## Reglas que rompen la importación

Comprueba estas antes de dar el trabajo por terminado:

1. **Toda carpeta de módulo contiene solo lecciones.** Cualquier `.md` o
   `.yaml` que no sea `module.yaml` se interpreta como lección y debe tener un
   `type` válido. **Nunca** dejes notas, borradores, planificaciones ni
   READMEs dentro de `modules/`. Si necesitas archivos de trabajo, ponlos en
   la raíz del repositorio o en una carpeta hermana de `modules/`.
2. **`startDate` siempre entre comillas.** Sin ellas YAML lo convierte en un
   objeto fecha.
3. **`type: exam` solo en `.yaml`; nunca en `.md`.** Y un `.yaml` de lección no
   admite otro `type`.
4. **`video`, `pdf` y `podcast` exigen `url`.**
5. **Solo se importan `.md`, `.yaml` y `.yml`.** No añadas imágenes, PDFs ni
   vídeos al repositorio esperando que se publiquen: no se suben. Enlaza a una
   URL pública.
6. **No inventes campos.** Los que no están en este documento se ignoran en el
   mejor de los casos, y en el peor rompen el parseo. En particular no existen
   `order`, `slug`, `id`, `tags` ni `duration` a nivel de lección.

## Cómo trabajar

1. **Lee antes de escribir.** Abre `course.yaml` y un par de lecciones
   existentes para seguir el estilo, el idioma y la profundidad del curso.
2. **Un archivo por lección.** No metas varias lecciones en un mismo archivo ni
   partas una lección en varios.
3. **Numera con hueco.** Usa `01-`, `02-`, `03-`... y renumera si insertas algo
   en medio. Mantén los prefijos alineados con el orden pedagógico.
4. **Renombrar es borrar y crear.** La plataforma identifica cada lección por
   su ruta. Cambiar el nombre del archivo elimina la lección anterior y crea
   otra, perdiendo su progreso asociado. Para cambiar solo el título visible,
   edita `title` en el frontmatter y **deja el nombre del archivo intacto**.
5. **Escribe en el idioma del curso**, el que veas en el contenido existente.
6. **Verifica antes de terminar** (ver más abajo).

## Verificación

No des por bueno el contenido sin comprobarlo. Como mínimo:

- [ ] `course.yaml` tiene los cinco campos obligatorios y `startDate` entrecomillado.
- [ ] Cada carpeta bajo `modules/` contiene solo `module.yaml` y lecciones.
- [ ] Cada `.md` de lección tiene `type` válido, y `url` si es `video`, `pdf` o `podcast`.
- [ ] Cada `.yaml` de lección tiene `type: exam`, al menos una pregunta y opciones con al menos una `correct: true`.
- [ ] Los prefijos numéricos reflejan el orden deseado, sin duplicados dentro de una misma carpeta.
- [ ] El YAML es válido (frontmatter y archivos de examen).

Si tienes un intérprete disponible, esta comprobación detecta los fallos más
frecuentes:

```bash
python3 - <<'PY'
import os, re, sys
try:
    import yaml
except ImportError:
    sys.exit("instala pyyaml para validar (pip install pyyaml)")

errors = []
if not os.path.exists("course.yaml"):
    errors.append("falta course.yaml")
else:
    c = yaml.safe_load(open("course.yaml")) or {}
    for f in ("title", "description", "duration", "level", "startDate"):
        if not c.get(f):
            errors.append(f"course.yaml: falta {f}")
    if not isinstance(c.get("startDate"), str):
        errors.append("course.yaml: startDate debe ir entre comillas")

for mod in sorted(os.listdir("modules")) if os.path.isdir("modules") else []:
    d = os.path.join("modules", mod)
    if not os.path.isdir(d):
        continue
    for name in sorted(os.listdir(d)):
        if name == "module.yaml":
            continue
        p = os.path.join(d, name)
        if name.endswith((".yaml", ".yml")):
            data = yaml.safe_load(open(p)) or {}
            if data.get("type") != "exam":
                errors.append(f"{p}: los .yaml de lección requieren type: exam")
            if not data.get("questions"):
                errors.append(f"{p}: el examen no tiene preguntas")
            for q in data.get("questions") or []:
                if not any(o.get("correct") for o in q.get("options") or []):
                    errors.append(f"{p}: la pregunta {q.get('text','?')!r} no tiene opción correcta")
        elif name.endswith(".md"):
            raw = open(p).read()
            m = re.match(r"^---\\n(.*?)\\n---", raw, re.S)
            if not m:
                errors.append(f"{p}: falta el frontmatter")
                continue
            fm = yaml.safe_load(m.group(1)) or {}
            if fm.get("type") not in ("text", "video", "pdf", "podcast"):
                errors.append(f"{p}: type inválido ({fm.get('type')!r})")
            if fm.get("type") in ("video", "pdf", "podcast") and not fm.get("url"):
                errors.append(f"{p}: type {fm['type']} requiere url")
        else:
            errors.append(f"{p}: archivo no soportado dentro de un módulo")

print("\\n".join(errors) if errors else "OK: la estructura del curso es válida")
sys.exit(1 if errors else 0)
PY
```

## Al terminar

Haz commit con un mensaje que describa el cambio pedagógico («añade módulo de
evaluación final»), no el mecánico («añade archivos»). La persona importará
desde la plataforma y verá una vista previa antes de confirmar.
