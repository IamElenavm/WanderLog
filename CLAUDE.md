# CLAUDE.md — WanderLog

## Qué es

WanderLog es una aplicación web estática para planificar viajes: horarios por día, mapas, alojamientos, reservas, notas prácticas, enlaces y presupuesto.

- Mobile-first, instalable como PWA y usable sin conexión.
- Sin backend, sin build y sin dependencias npm. Se publica tal cual en GitHub Pages desde la raíz del repositorio.
- Única dependencia externa: **Leaflet 1.9.4** (CSS y JS desde cdnjs), con teselas de OpenStreetMap. Google Maps solo se usa en enlaces de navegación.
- Interfaz y contenidos en español.

## Estructura

```
WanderLog/
├── index.html              Punto de entrada
├── manifest.webmanifest    Manifiesto PWA (nombre, colores, iconos)
├── sw.js                   Service Worker: caché offline
├── README.md               Documentación para usuarios/publicación
├── CLAUDE.md               Este archivo
├── assets/
│   ├── app.js              Toda la lógica de la app
│   ├── styles.css          Estilos compactos, mobile-first
│   ├── icons/              icon.svg, icon-192.png, icon-512.png
│   └── img/                Imágenes de viajes (atenas-egina.svg)
└── data/
    ├── catalog.json        Índice de viajes publicados
    └── trips/
        └── atenas-egina.json   Un JSON por viaje
```

## Qué hace cada archivo principal

- **index.html**: página casi vacía. Contiene `#app` (donde JS renderiza toda la interfaz), `#toast-region` (avisos) y un `<input type="file" id="json-import">` oculto para importar. Carga Leaflet y `assets/app.js` con `defer`.
- **assets/app.js**: código compacto (una función por línea, muy denso). Bloques principales:
  - Arranque y datos: `init()`, `loadTrips()` (lee `catalog.json` y cada viaje) y `normalizeTrip()`. Esta última migra modelos antiguos con `migrateBookings()`/`mergeBooking()` y normaliza cada actividad con `normalizeActivity()`.
  - Modelo 3: auxiliares `isStay`, `stays`, `stayForDay` (alojamiento de cada noche), `isBooking`, `legView` y `dayEntries` (tramos de ida y vuelta en el horario).
  - Enrutado por hash: `#viaje/<id>` (`applyRoute`).
  - Renderizado con plantillas de texto: `render()` reconstruye `#app` entero. Funciones `renderHome`, `renderTrip`, `renderInfo`, `renderSchedule`, `renderActivity`, `renderBudgetBody`, etc.
  - Mapas: `scheduleLeafletMaps`, `initMiniLeafletMap`, `initRouteLeafletMap`. `geocodePlace` usa una cola y guarda los resultados en `localStorage` (`wanderlog.geo.*`).
  - Modales de edición: viaje, día, actividad (que sirve también para reservas, alojamientos y transportes con vuelta, con campos que se muestran u ocultan según la categoría mediante `updateActivityForm`), notas prácticas, enlaces y ajustes.
  - Eventos delegados: `handleClick`, `handleChange` y `handleSubmit`, que se basan en `data-action` y `data-form`.
  - Persistencia: guardado automático en `localStorage`, que tiene prioridad sobre el JSON publicado. Importación y exportación en JSON.
  - Presupuesto: suma las actividades sin `linkedTo` («Incluida en»).
- **assets/styles.css**: todos los estilos, en formato compacto.
- **sw.js**: caché `wanderlog-vX.Y.Z` con la lista `CORE`. Sirve primero desde la caché y actualiza en segundo plano. Al activarse borra las cachés antiguas. Solo intercepta GET del mismo origen.
- **data/catalog.json**: `schemaVersion`, `updatedAt` y la lista `trips` (`id`, `file`, `name`, `destination`, `startDate`, `endDate`, `icon`).
- **data/trips/*.json**: modelo de datos v3 (`schemaVersion: 3`, `publishedVersion`). Contiene `days`, `activities`, `practical` (siete bloques) y `links`. Ya no hay `reservations` ni `accommodations`: todo es una actividad.
  - Una reserva es una actividad en estado `Pendiente` o `Reservado`.
  - Un alojamiento es una actividad de categoría `Alojamiento` cuyo fin (`endDate`) cae en un día posterior al inicio.
  - Un transporte puede tener `returnTrip` (vuelta).
  - `linkedTo` marca las actividades que cubre la reserva de otra.
  - El detalle de todos los campos está en el README.

## Cómo probar en local

Hace falta un servidor HTTP. Con `file://` fallan `fetch` y el Service Worker:

```bash
python -m http.server 8080
```

Abrir `http://localhost:8080`. Si los cambios no aparecen, puede ser la caché del Service Worker: recargar sin caché o anular el registro del SW en DevTools → Application.

## Añadir un viaje publicado

1. Crear `data/trips/mi-viaje.json` siguiendo `atenas-egina.json`.
2. Añadir su referencia a `data/catalog.json`.
3. Añadir el JSON a `CORE` en `sw.js`.
4. Cambiar el nombre de la caché en `sw.js` (nueva versión).

## Reglas al modificar el código

1. **No tocar `assets/app.js` sin explicar antes qué se va a cambiar y por qué**, y esperar la confirmación del usuario. Lo mismo para cualquier refactorización o reformateo de ese archivo.
2. Modificar solo los archivos que el usuario pida. Si un cambio necesita tocar otros, avisar antes.
3. Mantener la app estática: sin build, sin npm y sin frameworks. Cualquier librería nueva debe venir de un CDN con versión exacta, y hay que consultarlo antes de añadirla.
4. Respetar el estilo existente: código compacto, interfaz en español y diseño mobile-first.
5. Al cambiar archivos cacheados (`CORE`), subir la versión de `CACHE` en `sw.js` para que los usuarios reciban la actualización.
6. No romper la compatibilidad de datos: los cambios en el modelo del viaje deben mantener la migración de `normalizeTrip()` y la importación de modelos anteriores. Si cambia el modelo, actualizar `schemaVersion` y el README.
7. No editar a mano los datos de viajes del usuario (`data/trips/*.json`) salvo que lo pida.
8. No hacer commits ni push salvo que el usuario lo pida.
9. Explicar los cambios en español, de forma clara, indicando archivo y línea.
