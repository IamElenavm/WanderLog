# WanderLog

Aplicación estática, minimalista y mobile-first para organizar viajes. No requiere compilación, servidor propio ni clave de Google Maps.

## Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a la raíz de un repositorio de GitHub.
2. En **Settings → Pages**, selecciona **Deploy from a branch**.
3. Elige la rama principal y la carpeta raíz (`/`).
4. Abre la URL publicada por GitHub.

> Para que la instalación y la caché sin conexión funcionen, la aplicación debe abrirse mediante HTTPS o `localhost`; no basta con abrir `index.html` directamente desde el sistema de archivos.

## Probar en local

```bash
python3 -m http.server 8080
```

Después abre `http://localhost:8080`.

## Estructura

- `index.html`: entrada de la aplicación.
- `assets/app.js`: interfaz y lógica completa, sin dependencias.
- `assets/styles.css`: diseño mobile-first.
- `assets/icons/`: iconos de la aplicación instalable.
- `assets/img/`: imágenes locales.
- `data/catalog.json`: catálogo publicado.
- `data/trips/*.json`: un archivo por viaje publicado.
- `manifest.webmanifest`: datos de instalación.
- `sw.js`: caché básica sin conexión.

## Datos y prioridad local

- Cada cambio se guarda automáticamente en `localStorage`.
- Si existe una copia local, tiene prioridad sobre el JSON publicado.
- En **Configuración → Versión publicada** se puede descartar la copia local y restaurar el JSON del repositorio.
- La exportación genera JSON descargable. La importación admite un viaje individual o una exportación completa.

## Añadir un viaje publicado

1. Crea `data/trips/mi-viaje.json` siguiendo el modelo de `atenas-egina.json`.
2. Añade su referencia a `data/catalog.json`.
3. Añade el nuevo JSON y sus imágenes a la constante `CORE` de `sw.js` si deben estar disponibles sin conexión desde la primera visita.
4. Cambia el nombre de la caché en `sw.js` al publicar una versión nueva.
