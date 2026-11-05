# WanderLog

Aplicación estática de viajes, mobile-first, sin dependencias y compatible con GitHub Pages.

## Publicar

1. Sube el contenido de esta carpeta a la raíz de un repositorio.
2. En **Settings → Pages**, selecciona **Deploy from a branch**.
3. Elige la rama principal y la carpeta raíz (`/`).

## Probar en local

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080`. La instalación y la caché requieren HTTPS o `localhost`.

## Estructura

- `index.html`: entrada.
- `assets/app.js`: interfaz, edición, cálculos e importación/exportación.
- `assets/styles.css`: estilos compactos y mobile-first.
- `assets/icons/`: iconos de la aplicación instalable.
- `data/catalog.json`: catálogo de viajes publicados.
- `data/trips/*.json`: un JSON por viaje.
- `manifest.webmanifest`: instalación.
- `sw.js`: caché básica.

## Modelo de datos 2

Cada viaje contiene:

- `days`: fecha, nombre resumen y alojamiento del día.
- `activities`: actividades ordenadas por día y hora.
- `accommodations`: alojamientos y días asignados.
- `reservations`: reservas generales con categoría y posible vínculo a una actividad.
- `practical`: siete bloques de notas prácticas.
- `links`: enlaces del viaje.

El presupuesto se calcula a partir de actividades, alojamientos y reservas. Si una actividad o alojamiento está vinculado a una reserva, solo se contabiliza la reserva.

## Guardado y versiones

- Los cambios se guardan automáticamente en `localStorage`.
- La copia local tiene prioridad sobre el JSON publicado.
- **Configuración → Publicado** restaura el archivo del repositorio y elimina la copia local.
- La importación acepta el modelo 2, exportaciones completas y viajes del modelo anterior, que se migran al abrirse.

## Añadir un viaje publicado

1. Crea `data/trips/mi-viaje.json` siguiendo `atenas-egina.json`.
2. Añade su referencia a `data/catalog.json`.
3. Añade el JSON a `CORE` en `sw.js`.
4. Cambia el nombre de la caché al publicar una versión nueva.
