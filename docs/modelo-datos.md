# WanderLog: estructura, código y modelo de datos

Referencia técnica enlazada desde [CLAUDE.md](../CLAUDE.md). Hay que mantenerla al día cuando cambien la estructura de datos o la lógica de la app.

## Estructura

```
WanderLog/
├── index.html              Punto de entrada: carga Leaflet y los 9 scripts en orden
├── manifest.webmanifest    Manifiesto PWA (nombre, colores, iconos)
├── sw.js                   Service Worker: caché offline (CACHE + lista CORE)
├── README.md               Documentación para usuarios y publicación
├── CLAUDE.md               Instrucciones de trabajo
├── docs/
│   └── modelo-datos.md     Este archivo
├── assets/
│   ├── js/                 Código de la app (ver «Scripts»)
│   ├── styles.css          Estilos compactos, mobile-first, y @media print
│   └── icons/              icon.svg, icon-192.png, icon-512.png
└── data/
    ├── catalog.json        Índice de viajes publicados (formato propio, schemaVersion 2)
    └── trips/
        └── atenas-egina.json   Un JSON por viaje (guardado ya en el modelo 5)
```

## Otros archivos

- **index.html**: contiene `#app` (donde se dibuja toda la interfaz), `#toast-region` (avisos) y un `<input type="file" id="json-import">` oculto. Carga Leaflet y los scripts con `defer`.
- **assets/styles.css**: todos los estilos, en formato compacto, y la hoja de impresión (`@media print`).
- **sw.js**: caché `wanderlog-vX.Y.Z` con la lista `CORE`, que incluye los 9 scripts.
  - Sirve primero desde la caché y actualiza en segundo plano.
  - Al activarse, borra las cachés antiguas.
  - Solo intercepta GET del mismo origen.
  - Cuando un Service Worker nuevo toma el control, `registerServiceWorker` muestra el aviso «Hay una versión nueva».
- **data/catalog.json**: `schemaVersion` (del catálogo, independiente del de los viajes), `updatedAt` y la lista `trips` (`id`, `file`, `name`, `destination`, `startDate`, `endDate`, `icon`).

## Scripts (`assets/js/`)

Son scripts clásicos, sin módulos ni `import`. Comparten el ámbito global y se cargan en este orden: las constantes y funciones de un archivo están disponibles para los siguientes cuando se ejecutan. El código es compacto, con una función por línea.

| Archivo | Contenido |
|---|---|
| `core.js` | `APP_VERSION`, claves de `localStorage`, constantes (`CATEGORIES`, `STATUSES`, `PRACTICAL`, `PACKING_CATS`, `PACKING_TEMPLATE`, `TRANSPORT_TYPES`, `INFO_APPS`, `WMO`), `state`, utilidades de fechas, formato, URLs y escape, `toast` y `registerServiceWorker`. |
| `model.js` | `normalizeTrip` (con `migrateBookings`/`mergeBooking` del modelo 2, `splitReturnTrips` del 4 y `guessTransport`) y `normalizeActivity`. Auxiliares: `isStay`, `stays`, `stayForDay`, `isHomeNight`, `isBooking`, `legView`, `dayEntries`, `actIcon`, `relatedOf`, `journeyLegs`, `setRelated` (relación recíproca), `unlinkActivity`, `packingTemplate`, `activeStay`, `departingStay`, `shownStay`, `toEUR`, `amount`, `budget`, `saveCurrent`/`saveTrip` y la ordenación. |
| `services.js` | Zona horaria (`tzOffsetMin`, `zonedToUTC`, `ensureTimeZone`, `omGeocode`, `clockText`, `cityName`), tiempo (`loadWeather`, `weatherHtml`, `weatherSlot`, con caché de 3 horas), Drive (`drivePreviewUrl`, `drivePreview`, `isDriveUrl`) y mapas Leaflet (`scheduleLeafletMaps`, `geocodePlace` con Nominatim, 1 petición cada 1,1 s). |
| `info.js` | Cabecera (`renderTripHeader`, `miniChart`, `renderClocks`), mini apps (`renderInfo`, `infoAppSummary`, `infoAppBody`) y secciones: `renderAccommodations`, `renderReservations` (por categoría, `resGroupOpen`), `renderInsurances`, `renderPacking`/`packItem`, `renderTasks`, `renderTravelers`, `renderPractical`, `renderLinks`, `renderBudgetBody`, `renderPeopleBudget` y `renderRates`. |
| `schedule.js` | `renderSchedule`, `renderDayPlan`, `renderActivity` (relacionadas y «Editar trayecto completo»), `renderLodgingActivity` (estancia, Casa o «Añadir alojamiento»), `renderDayMap`, `timeLabel`, `rangeLabel` y `staySwitch`. |
| `forms.js` | `renderModal` y las ventanas: menú ＋ (`addMenuModal`), actividad (`activityModal` compacto, con relacionadas), asistente de transporte (`journeyModal`, `syncJourney`, `applyJourneyKind`, `journeyFromActivity`, `newLeg`), alojamiento de una noche (`nightLodgingModal`), día, viaje, persona, seguro, práctico, enlace, ajustes e importación. Ayudas: `field`, `selectField`, `modeField`, `updateActivityForm`. |
| `io.js` | Importación (`importJSONFile`, `nextImport`, `compareTrips`, `DIFF_FIELDS`), exportación (`exportData`, `downloadFile`), calendario (`buildICS`) e impresión (`renderPrint`, `printTrip`). |
| `events.js` | Tabla `ACTIONS` (un manejador por cada `data-action`), `handleClick`, `handleChange` y `handleSubmit`. Guardado: `saveActivityForm`, `saveJourney`, `extendDays`, `useStayForNight`. Además `gotoActivity` y los borrados. |
| `main.js` | `init`, `loadTrips`, `applyRoute` (`#viaje/<id>?vista=info|horario&app=<mini app>&imprimir=1`), `render` (aviso de versión, sin conexión y vista de impresión), `topbar`, `renderHome` y `renderTrip` (barra con ＋, Info y Horario). |

## Modelo de datos (`schemaVersion: 5`)

### Viaje

| Campo | Contenido |
|---|---|
| `schemaVersion`, `publishedVersion`, `updatedAt` | Versión del modelo; versión publicada (`AAAA.MM.DD-rN`); última modificación local (ISO). |
| `id`, `name`, `destination`, `icon` | Identificador, nombre, destino y emoji. |
| `startDate`, `endDate` | Se calculan a partir de `days`. Al editarlas se crean o eliminan días; el asistente de transporte también puede ampliarlas. |
| `currency` | Moneda habitual de los gastos. Los totales siempre se muestran en EUR. |
| `timeZone` | Zona IANA del destino. Vacía = se detecta con Open-Meteo. |
| `travelers` | `[{id, name}]`. |
| `rates` | `{"USD": 0.92}`: 1 unidad = X €. Un tipo de cambio fijo por moneda. |
| `insurances` | `[{id, insurer, policyNumber, phone, startDate, endDate, documentUrl, notes}]`. |
| `packing` | `[{id, category, text, qty, notes, done}]`. `category` es una de `PACKING_CATS` (Documentos, Ropa, Aseo, Electrónica, Salud, Otros); `qty` es un número o `null`. |
| `tasks` | `[{id, text, done, dueDate}]`: tareas y recordatorios. |
| `days` | `[{id, date, name, weatherPlace?, lodging?}]`. `lodging: "home"` = esa noche en casa. |
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
| `notes`, `locator`, `bookingUrl`, `links` | Notas, localizador, documento de Drive y enlaces relevantes. |
| `estimated`, `spent`, `currency` | Importes en su moneda. |
| `participants` | Ids de personas entre las que se reparte el gasto. Vacío = todas. |
| `related` | Ids de actividades relacionadas. La relación es siempre recíproca (`setRelated`) y no afecta al presupuesto. |
| `completed` | Completada. |
| `transportType`, `origin`, `destination`, `transportCode` | Solo transportes. `transportType` es una clave de `TRANSPORT_TYPES`; `transportCode` es el nº de vuelo o código. |
| `journeyId` | Solo transportes: identifica los tramos de un mismo trayecto. El importe va en el primer tramo; los demás quedan a 0. |

### Reglas que se calculan (no se guardan)

- **Reserva**: actividad en estado `Pendiente` o `Reservado`. Aparece en Info → Reservas, agrupada por categoría.
- **Estancia**: actividad de categoría `Alojamiento` con `endDate` posterior al día de inicio. Aparece en Info → Alojamientos y al final de cada día, desde el check-in hasta el día anterior al check-out.
- **Noche en casa**: `day.lodging === "home"` y ninguna estancia cubre esa noche (`isHomeNight`).
- **Alojamiento activo**: el día de un check-out, antes de esa hora se usa el alojamiento de salida; después, el de esa noche. Si el mismo día hay salida y entrada, aparece el selector de alojamiento.
- **Usar un alojamiento existente para una noche** (`useStayForNight`): si la noche es la anterior al check-in o la del check-out, la estancia se amplía. Si no, se crea una copia de una noche, a 0 € y relacionada con la original.
- **Presupuesto**: todas las actividades, convertidas a EUR con `rates`. Las monedas sin tipo de cambio quedan en `missing` y no se suman. El reparto por persona es a partes iguales entre `participants`.

### Claves de localStorage

- `wanderlog.trip.<id>`: copia local de cada viaje.
- `wanderlog.customTrips`: ids de los viajes creados o importados que no están publicados.
- `wanderlog.settings`: moneda por defecto y bloques abiertos de Reservas (`resGroups`).
- `wanderlog.geo.*` (Nominatim), `wanderlog.omgeo.*` (geocodificación de Open-Meteo) y `wanderlog.wx.*` (previsión).

### Migración

`normalizeTrip()` acepta los modelos 1 a 5 y siempre devuelve el 5:
- **Del 2 al 3:** `reservations` y `accommodations` pasan a ser actividades. Las actividades que cubría una reserva quedan relacionadas y su importe pasa a las notas.
- **Del 3 al 4:** se rellenan los campos nuevos con valores vacíos o por defecto.
- **Del 4 al 5:**
  - `returnTrip` pasa a ser una actividad «Vuelta · …» (id `<ida>-vuelta`), relacionada con la ida y con el mismo `journeyId`. La ida se renombra «Ida · …».
  - `linkedTo` pasa a `related`.
  - Los transportes reciben `transportType` con `guessTransport`.
  - Las categorías «Ropa · …» del equipaje pasan a «Ropa», y cada elemento recibe `qty` y `notes`.

Si se añade un modelo nuevo, la migración debe seguir aceptando todos los anteriores.
