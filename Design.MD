# Sistema de Diseño - ClevereX Academy

Este documento detalla el sistema de diseño, la identidad visual, la tipografía, la paleta de colores y las directrices estéticas utilizadas en la plataforma **ClevereX Academy**.

---

## 1. Concepto y Estética Visual

La interfaz de la plataforma está inspirada en las tendencias de diseño web moderno de gama alta (_premium_). Se basa en los siguientes pilares estéticos:

- **Glastomorfismo (Glassmorphism):** Superposiciones semi-transparentes combinadas con difuminados de fondo (`backdrop-blur-md`), bordes extremadamente sutiles (`border-white/10`) y sombras orgánicas profundas.
- **Micro-animaciones Dinámicas:** Transiciones fluidas en todos los estados interactivos (`transition-all duration-300`), efectos de escala ligeros al pasar el cursor (`group-hover:scale-105`), y animaciones de entrada elegantes (`animate-in fade-in zoom-in-95 duration-200`) para diálogos y menús desplegables.
- **Contraste y Jerarquía Oscura:** Un diseño base oscuro por defecto con toques de acentos vibrantes de color índigo y ámbar para guiar la atención del usuario sin fatiga visual.

---

## 2. Tipografía

La plataforma utiliza la tipografía **Sansation** como fuente principal y de identidad de marca.

- **Fuente Principal:** `Sansation`, gestionada dinámicamente mediante `next/font/google` para una óptima velocidad de carga sin saltos de contenido acumulativos (CLS).
- **Pesos Utilizados:**
  - `300` (Light): Usado para textos descriptivos extensos y etiquetas secundarias de menor peso visual.
  - `400` (Regular): Utilizado para textos base, entradas de formularios y contenido estándar.
  - `700` (Bold): Utilizado para encabezados (`h1`, `h2`, `h3`, `h4`), botones primarios y elementos que requieren alta distinción.
- **Mapeo en Tailwind CSS:**
  - `--font-sans` apunta a `var(--font-sansation), sans-serif`, asegurando que todas las clases de utilidad nativas de Tailwind (`font-sans`, etc.) adopten de manera predeterminada y uniforme esta tipografía.

---

## 3. Paleta de Colores y Tokens

La plataforma soporta nativamente **Modo Oscuro** (predeterminado) y **Modo Claro** mediante variables CSS configuradas en `app/globals.css`.

| Variable CSS   | Modo Oscuro (Dark) | Modo Claro (Light) | Propósito / Uso                                                     |
| :------------- | :----------------- | :----------------- | :------------------------------------------------------------------ |
| `--background` | `#191919`          | `#ffffff`          | Color de fondo de la aplicación.                                    |
| `--foreground` | `#d4d4d4`          | `#09090b`          | Texto primario de lectura.                                          |
| `--sidebar-bg` | `#202020`          | `#f4f4f5`          | Fondo del menú de navegación lateral.                               |
| `--card-bg`    | `#252525`          | `#ffffff`          | Fondo de tarjetas, tablas y modales.                                |
| `--border`     | `#2f2f2f`          | `#e4e4e7`          | Bordes finos, separadores y divisores.                              |
| `--hover-bg`   | `#2c2c2c`          | `#f4f4f5`          | Estado de fondo al hacer _hover_ sobre filas y botones.             |
| `--muted`      | `#9b9b9b`          | `#71717a`          | Texto secundario o deshabilitado.                                   |
| `--primary`    | `#4f46e5`          | `#4f46e5`          | Color de acento de marca (Indigo) para botones primarios y enlaces. |

---

## 4. Componentes Clave y Estilos de Interfaz

### A. Barra de Navegación Lateral (Sidebar)

- **Transiciones:** Animación de colapso fluida de `16rem (64)` a `4rem (16)` con clase `transition-all duration-300`.
- **Estilo:** Fondo opaco de color `--sidebar-bg` con borde divisor derecho de color `--border`.
- **Interactividad:** Resaltado del enlace activo mediante un fondo con opacidad e iconos en color `--primary`.

### B. Menú Flotante de Acciones (Dropdown Flotante)

- **Tecnología:** Renderizado en el nivel superior del DOM utilizando **React Portals** (`createPortal`) montado sobre `document.body` para eliminar el riesgo de recortes por límites de tabla (`overflow: hidden`).
- **Posicionamiento:** Calculado dinámicamente mediante `getBoundingClientRect()` del botón desencadenador con una distancia fija vertical y alineamiento lateral perfecto.
- **Aislamiento Z-Index:** Posee una jerarquía elevada (`z-[9999]`) que asegura flotar por encima de barras laterales y encabezados fijos.
- **Comportamiento:** Se cierra automáticamente de forma elegante al hacer scroll en cualquier contenedor o al redimensionar la pantalla.

### C. Diálogos y Modales de Confirmación

- **Fondo Trasero:** Fondo opaco con desenfoque de cristal (`bg-background/60 backdrop-blur-sm`).
- **Entrada de Animación:** Zoom micro-acelerado (`animate-in zoom-in-95 duration-200`) e incremento de opacidad.
- **Bordes de Acento:** Línea superior con gradiente difuso y sutil de color primario para una estética refinada.

### D. Barras de Desplazamiento Personalizadas (Scrollbars)

- Integradas de forma consistente con los colores del sistema:
  - **Track:** `--background` para pasar desapercibido en el diseño.
  - **Thumb:** `--border` con puntas redondeadas de `5px`.
  - **Thumb Hover:** Transición al color `--primary` al pasar el cursor.
