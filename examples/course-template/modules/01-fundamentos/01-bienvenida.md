---
title: "Bienvenida"
type: text
---

# Bienvenida al curso

Esta es una lección de tipo `text`. Todo lo que escribas debajo del
frontmatter se convierte a HTML y se muestra al alumno.

## Markdown soportado

Puedes usar **negrita**, *cursiva*, `código en línea` y
[enlaces](https://example.com).

- Listas con viñetas
- Con varios elementos

1. Listas numeradas
2. También funcionan

> Las citas se renderizan como bloque destacado.

```js
// Los bloques de código conservan el lenguaje para el resaltado
function saludar(nombre) {
  return `Hola, ${nombre}`;
}
```

| Columna A | Columna B |
| --------- | --------- |
| Valor 1   | Valor 2   |

Las imágenes deben apuntar a una URL pública, porque los archivos binarios
del repositorio no se importan:

![Texto alternativo](https://example.com/diagrama.png)
