# WanderLog: estructura, código y modelo de datos

Referencia técnica enlazada desde [CLAUDE.md](../CLAUDE.md). Hay que mantenerla al día cuando cambien la estructura de datos o la lógica de la app.

## Estructura

```
WanderLog/
├── index.html              Punto de entrada
├── manifest.webmanifest    Manifiesto PWA (nombre, colores, iconos)
├── sw.js                   Service Worker: caché offline (CACHE + lista CORE)
├── README.md               Documentación para usuarios y publicación
├── CLAUDE.md               Instrucciones de trabajo
├── docs/
│   └── modelo-datos.md     Este archivo
├── assets/
│   ├── app.js              Toda la lógica de la app (APP_VERSION)
│   ├── styles.css          Estilos compactos, mobile-first, y @media print
│   ├── icons/              icon.svg, icon-192.png, icon-512.png
│   └── img/                atenas-egina.svg (sin uso actualmente; no está en CORE)
└── data/
    ├── catalog.json        Índice de viajes publicados (formato propio, schemaVersion 2)
    └── trips/
        └── atenas-egina.json   Un JSON por viaje (modelo 4)
```

## Qué hace cada archivo principal

- **index.html**: página casi vacía. Contiene:
  - `#app`, donde JS dibuja toda la interfaz;
  - `#toast-region`, para los avisos;
  - un `<input type="file" id="json-import">` oculto, para importar.

  Carga Leaflet y `assets/app.js` con `defer`.
- **assets/styles.css**: todos los estilos, en formato compacto, y la hoja de impresión (`@media print`).
- **sw.js**: caché `wanderlog-vX.Y.Z` con la lista `CORE`.
  - Sirve primero desde la caché y actualiza en segundo plano.
  - Al activarse, borra las cachés antiguas.
  - Solo intercepta GET del mismo origen: las APIs externas no se guardan en su caché.
- **data/catalog.json**: `schemaVersion` (del catálogo, independiente del de los viajes), `updatedAt` y la lista `trips` (`id`, `file`, `name`, `destination`, `startDate`, `endDate`, `icon`).
- **data/trips/*.json**: un viaje por archivo, en el modelo de datos 4.

## Funciones de assets/app.js

Código compacto, una función por línea. Bloques principales:

- **Arranque y datos:**
  - `init()` y `loadTrips()`, que leen `catalog.json` y cada viaje.
  - `normalizeTrip()`, que migra cualquier modelo anterior al 4. Se apoya en `migrateBookings()`/`mergeBooking()` (modelo 2 → 3) y en `normalizeActivity()`.
- **Auxiliares del modelo:**
  - Estancias: `isStay`, `stays`, `stayForDay`.
  - Reservas y tramos: `isBooking`, `legView`, `dayEntries`.
  - Alojamiento activo: `activeStay`, `departingStay`, `shownStay`, `staySwitch`.
- **Dinero:** `toEUR`, `amount` y `budget()`. Esta última devuelve el estimado y el gastado en EUR, `byCategory`, `byDay`, `byPerson` y `missing`.
- **Info:**
  - `renderTripHeader` (con `miniChart` y `renderClocks`).
  - Secciones: `renderAccommodations`, `renderReservations`, `renderInsurances`, `renderPacking`, `renderTasks`, `renderTravelers`, `renderPractical`, `renderLinks`.
  - Gastos: `renderBudgetBody` (con `renderPeopleBudget` y `renderRates`).
- **Horario:** `renderSchedule`, `weatherSlot`, `renderDayPlan`, `renderActivity`, `renderLodgingActivity`, `renderDayMap`.
- **Zona horaria:** `tzOffsetMin`, `zonedToUTC`, `ensureTimeZone` y `omGeocode`.
- **Tiempo:** `loadWeather` y `weatherHtml`, con caché de 3 horas.
- **Mapas:** `scheduleLeafletMaps`, `initMiniLeafletMap`, `initRouteLeafletMap` y `geocodePlace` (Nominatim, con cola).
- **Drive:** `drivePreviewUrl` y `drivePreview`.
- **Enrutado por hash:** `#viaje/<id>?vista=info|horario`, en `applyRoute`. `&imprimir=1` muestra la vista de impresión, útil para pruebas.
- **Renderizado:** `render()` reconstruye `#app` entero con plantillas de texto.
- **Formularios (modales):** viaje, día, actividad, persona, seguro, notas prácticas, enlaces, ajustes e importación.
  - El de actividad sirve también para reservas, alojamientos y transportes con vuelta.
  - `updateActivityForm` muestra u oculta sus campos según la categoría.
- **Eventos delegados:** `handleClick`, `handleChange` y `handleSubmit`, que funcionan con `data-action`, `data-form` y `data-check`.
- **Persistencia:** guardado automático en `localStorage`, que tiene prioridad sobre el JSON publicado. `saveCurrent()` actualiza `updatedAt`.
- **Importación y exportación:**
  - Importar: `importJSONFile` → `nextImport`. Si el id ya existe, `compareTrips` compara las versiones y ofrece Cancelar, Guardar como viaje diferente o Reemplazar.
  - Exportar: `exportData` (JSON), `buildICS` (calendario), `renderPrint` y `printTrip` (PDF).

## Modelo de datos (`schemaVersion: 4`)

### Viaje

| Campo | Contenido |
|---|---|
| `schemaVersion`, `publishedVersion`, `updatedAt` | Versión del modelo; versión publicada (`AAAA.MM.DD-rN`); última modificación local (ISO). |
| `id`, `name`, `destination`, `icon` | Identificador, nombre, destino y emoji. |
| `startDate`, `endDate` | Se calculan a partir de `days`. Al editarlas en el formulario del viaje se crean o eliminan días. |
| `currency` | Moneda habitual de los gastos. Los totales siempre se muestran en EUR. |
| `timeZone` | Zona IANA del destino. Vacía = se detecta con Open-Meteo. |
| `travelers` | `[{id, name}]`. |
| `rates` | `{"USD": 0.92}`: 1 unidad = X €. Un tipo de cambio fijo por moneda. |
| `insurances` | `[{id, insurer, policyNumber, phone, startDate, endDate, documentUrl, notes}]`. |
| `packing` | `[{id, category, text, done}]`, con las categorías de `PACKING_CATS`. |
| `tasks` | `[{id, text, done, dueDate}]`: tareas y recordatorios. |
| `days` | `[{id, date, name, weatherPlace?}]`. |
| `activities` | Ver la tabla siguiente. |
| `practical` | Objeto con los siete bloques de `PRACTICAL`. |
| `links` | Enlaces del viaje: `[{id?, label, url}]`. |

### Actividad

| Campo | Contenido |
|---|---|
| `id`, `dayId`, `time` | Inicio: día y hora (en alojamientos, check-in). |
| `endDate`, `endTime` | Fin (en alojamientos, check-out). |
| `title`, `category`, `status` | `category` es una clave de `CATEGORIES`; `status` es uno de `STATUSES`. |
| `location`, `mapQuery`, `lat`, `lng` | Ubicación, búsqueda de mapa y coordenadas opcionales. |
| `notes`, `locator`, `bookingUrl`, `links` | Notas (notas de la ida si hay vuelta), localizador, documento de Drive y enlaces relevantes. |
| `estimated`, `spent`, `currency` | Importes en su moneda. |
| `participants` | Ids de personas entre las que se reparte el gasto. Vacío = todas. |
| `linkedTo` | «Incluida en»: id de la actividad principal. No se cuenta en el presupuesto. |
| `returnTrip` | Solo transportes: `{dayId, time, endDate, endTime, notes, location, mapQuery, lat?, lng?, completed}` o `null`. |
| `completed` | Completada. |

### Reglas que se calculan (no se guardan)

- **Reserva**: actividad en estado `Pendiente` o `Reservado` sin `linkedTo`. Aparece en Info → Reservas.
- **Estancia**: actividad de categoría `Alojamiento` con `endDate` posterior al día de inicio. Aparece en Info → Alojamientos y al final de cada día, desde el check-in hasta el día anterior al check-out.
- **Alojamiento activo**: el día de un check-out, antes de esa hora se usa el alojamiento de salida; después, el de esa noche. Si el mismo día hay salida y entrada, aparece el selector de alojamiento.
- **Presupuesto**: actividades sin `linkedTo`, convertidas a EUR con `rates`. Las monedas sin tipo de cambio quedan en `missing` y no se suman. El reparto por persona es a partes iguales entre `participants`.

### Valores fijos en app.js

- `CATEGORIES`: Transporte, Alojamiento, Cultura, Gastronomía, Naturaleza, Otro.
- `STATUSES`: Sin reserva necesaria, Pendiente, Reservado.
- `PACKING_CATS`: Documentos, Ropa · Interior, Ropa · Pantalones, faldas y vestidos, Ropa · Camisas y camisetas, Ropa · Jerseys, abrigos y sudaderas, Ropa · Calzado, Aseo, Electrónica, Salud, Otros.
- `PRACTICAL`: los siete bloques de notas prácticas.

### Claves de localStorage

- `wanderlog.trip.<id>`: copia local de cada viaje.
- `wanderlog.customTrips`: ids de los viajes creados o importados que no están publicados.
- `wanderlog.settings`: moneda por defecto y estado de las secciones de Info.
- `wanderlog.geo.*` (Nominatim), `wanderlog.omgeo.*` (geocodificación de Open-Meteo) y `wanderlog.wx.*` (previsión).

### Migración

`normalizeTrip()` acepta los modelos 1, 2, 3 y 4 y siempre devuelve el 4:
- **Del 2 al 3:** `reservations` y `accommodations` pasan a ser actividades.
- **Del 3 al 4:** se rellenan los campos nuevos con valores vacíos o por defecto.

Si se añade un modelo nuevo, la migración debe seguir aceptando todos los anteriores.
