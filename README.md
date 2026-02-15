# Firmas Vectoriales (Vector Signatures)

Aplicación web moderna y profesional para crear, editar y exportar firmas digitales vectoriales de alta calidad. Esta versión es una refactorización completa del proyecto original, utilizando **Vite**, **TypeScript** y **SCSS** para garantizar un rendimiento óptimo, mantenibilidad y escalabilidad.

##  Características Principales

###  Motor de Dibujo Avanzado
*   **Trazos Vectoriales**: Captura de firmas suave y precisa basada en curvas de Bezier.
*   **Estilos de Pincel**: Variedad de herramientas que simulan instrumentos reales:
    *    **Pluma**: Trazo clásico y elegante.
    *    **Pincel**: Sensible a la presión con acabado artístico.
    *    **Marcador**: Trazo grueso y uniforme.
    *   **Fino**: Para detalles precisos.
    *    **Natural**: Simulación de escritura a mano estándar.
*   **Personalización**: Control total sobre el **grosor**, **opacidad** y **color** (presets y selector personalizado).

### Edición y Manipulación
*   **Modo Selección y Transformación**: Selecciona trazos individuales o grupos para **moverlos**, **escalarlos** o **rotarlos** libremente.
*   **Portapapeles**: Copia (`Ctrl+C`) y pega (`Ctrl+V`) trazos dentro del lienzo o entre sesiones.
*   **Historial Robusto**: Sistema de **Deshacer** (`Ctrl+Z`) y **Rehacer** (`Ctrl+Y`) ilimitado.

### Interfaz y Experiencia de Usuario
*   **Diseño Responsivo**: Funciona perfectamente en escritorio, tablets y móviles.
*   **Modo Oscuro / Claro**: Interfaz adaptable a tus preferencias visuales.
*   **Navegación Intuitiva**: Zoom infinito y Paneo (`Clic Central` o herramienta Mano) para trabajar en detalles.
*   **Internacionalización (i18n)**: Cambio instantáneo entre Español e Inglés.

### Exportación Profesional
*   **PNG Transparente**: Ideal para insertar en documentos.
*   **SVG Vectorial**: Formato escalable sin pérdida de calidad.
*   **Copiado Rápido**: Copia la imagen al portapapeles con un solo clic.

## Stack Tecnológico

*   **Core**: HTML5, TypeScript (Tipado estático para mayor robustez).
*   **Estilos**: SCSS (Sass) con arquitectura modular.
*   **Build Tool**: Vite (Rápido, HMR, optimización de assets).
*   **Librerías Clave**:
    *   `signature_pad`: Motor base para la captura de trazos.
    *   `lucide`: Set de iconos ligero y moderno.

## 📂 Estructura del Proyecto

El código estça organizado modularmente para facilitar su mantenimiento:

```
/
├── index.html          # Punto de entrada principal
├── vite.config.ts      # Configuración de Vite (Alias, Plugins)
├── src/
│   ├── scripts/        # Lógica de la aplicación (TypeScript)
│   │   ├── main.ts     # Inicialización, eventos globales y delegación
│   │   ├── canvas.ts   # Lógica de dibujo, historial, portapapeles y exportación
│   │   ├── state.ts    # Store global (Estado de la app)
│   │   ├── data.ts     # Configuración de UI, textos i18n y renderizado estático
│   │   ├── ui_updates.ts # Sincronización reactiva entre Estado y UI
│   │   └── workspace.ts # Gestión del lienzo, zoom, redimensionado y coordenadas
│   └── styles/         # Estilos SCSS
│       ├── style.scss  # Estilos globales, variables y layout base
│       ├── _panel.scss # Estilos específicos del panel de control
│       └── _workspace.scss # Estilos del área de trabajo y herramientas
└── dist/               # Resultado de la compilación (Generado por build)
```

## Instalación y Uso

1.  **Instalar dependencias**:
    Asegúrate de tener [Node.js](https://nodejs.org/) instalado.
    ```bash
    npm install
    ```

2.  **Iniciar Servidor de Desarrollo**:
    Inicia el servidor local con recarga en caliente (Hot Module Replacement).
    ```bash
    npm run dev
    ```
    Accede a la aplicación en `http://localhost:5173`.

3.  **Construir para Producción**:
    Genera la versión optimizada en la carpeta `dist/`.
    ```bash
    npm run build
    ```

## Contribución (Conventional Commits)

Este proyecto utiliza **Conventional Commits** para mantener un historial de cambios ordenado. Husky y Commitlint verificarán que tus mensajes de commit cumplan con el estándar.

**Formato del comando:**
```bash
git commit -m "tipo(alcance opcional): descripción breve"
```

**Tipos permitidos:**
*   `feat`: Nueva característica.
*   `fix`: Corrección de un bug.
*   `docs`: Cambios en documentación.
*   `style`: Formato de código scss/ts (no afecta lógica).
*   `refactor`: Refactorización de código.
*   `perf`: Mejoras de rendimiento.
*   `test`: Tests unitarios.
*   `chore`: Tareas de build, herramientas, dependencias.

**Ejemplo de uso:**
```bash
git commit -m "feat(canvas): añadir soporte para sensibilidad de presión"
```

## Atajos de Teclado

| Acción | Atajo |
| :--- | :--- |
| **Herramienta Dibujar** | `P` |
| **Herramienta Seleccionar** | `V` |
| **Herramienta Transformar** | `T` |
| **Herramienta Mover (Pan)** | `H` o `Clic Central` (Rueda) |
| **Deshacer** | `Ctrl + Z` |
| **Rehacer** | `Ctrl + Y` o `Ctrl + Shift + Z` |
| **Copiar Selección** | `Ctrl + C` |
| **Pegar Selección** | `Ctrl + V` |
| **Eliminar Selección** | `Supr` o `Backspace` |
| **Minimizar Panel**| `M` |

---
*Optimizado para el rendimiento y una experiencia de usuario fluida.*
