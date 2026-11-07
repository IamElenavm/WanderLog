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

- `index.html`: entrada. Carga los scripts de `assets/js/` en orden.
- `assets/js/`: el código, en nueve archivos que comparten el ámbito global:
  - `core.js`: constantes, estado y utilidades.
  - `model.js`: modelo de datos y migraciones.
  - `services.js`: tiempo, zona horaria, mapas y Drive.
  - `info.js`: pestaña Info.
  - `schedule.js`: pestaña Horario.
  - `forms.js`: formularios.
  - `io.js`: importación, exportación, calendario e impresión.
  - `events.js`: clics y guardado.
  - `main.js`: arranque y renderizado.
- `assets/styles.css`: estilos compactos y mobile-first, con hoja de impresión.
- `assets/icons/`: iconos de la aplicación instalable.
- `data/catalog.json`: catálogo de viajes publicados.
- `data/trips/*.json`: un JSON por viaje.
- `docs/modelo-datos.md`: referencia técnica del código y del modelo de datos.
- `manifest.webmanifest`: instalación.
- `sw.js`: caché sin conexión. Avisa cuando hay una versión nueva.

## Uso

- **Barra superior del viaje:** **＋** · **🛏️ Volver al alojamiento** · **⚙️ Ajustes**.
- **🛏️ Volver al alojamiento** abre Google Maps con la ruta desde tu ubicación actual hasta la dirección del alojamiento del día: hoy si el viaje incluye la fecha actual (en la zona horaria del destino) o, si no, el día abierto en Horario. Si ese día hay dos alojamientos (salida y entrada), pregunta a cuál ir y pone primero el que corresponde a la hora actual. Si no hay alojamiento con dirección (por ejemplo, una noche en Casa), el botón no aparece.
- **Botón ＋**: es el único punto para añadir cosas.
  - **Actividad:** Transporte, Alojamiento, Cultura, Gastronomía, Naturaleza u Otro.
  - **Otros:** Día, Persona, Seguro, Enlace, Tarea o Equipaje.
- **Transporte:** abre un asistente con el tipo (✈️ Avión, ⛴️ Ferry, 🚆 Tren, 🚌 Autobús, 🚗 Coche, 🚕 Taxi, 🚇 Metro, 🚶 A pie) y el trayecto: solo ida, ida y vuelta, o varios tramos.
  - Cada tramo tiene origen, destino, salida, llegada, código (nº de vuelo) y notas.
  - Al guardar se crea **una actividad por tramo**, cada una en su día. El importe se guarda en el primer tramo, para no contarlo dos veces.
  - Si un tramo sale fuera de las fechas del viaje, la app ofrece ampliar el viaje.
  - «🧭 Editar trayecto completo» reabre todos los tramos a la vez.
- **Info** muestra la cabecera del viaje y una cuadrícula de **mini apps**: Alojamientos, Reservas, Seguro de viaje, Equipaje, Tareas y recordatorios, Personas, Práctico, Enlaces y Gastos.
  - Al pulsar una se abre en pantalla completa, con su propia dirección (`?vista=info&app=reservas`).
  - El botón «Guardar en PDF» está al final de la cuadrícula.
- **Reservas** se agrupan por categoría, en bloques plegables. La app recuerda cuáles están abiertos.
- **Alojamiento de cada noche:** al final de cada día, si no hay alojamiento, «Añadir alojamiento» ofrece:
  - **Nuevo alojamiento.**
  - **Uno de los alojamientos del viaje.** Si esa noche es contigua a la estancia, la estancia se amplía; si no, se crea una copia de una noche, relacionada con la original.
  - **🏠 Casa**, sin más detalles.
- **Actividades relacionadas:** en el formulario de una actividad se pueden marcar varias. La relación es recíproca, y en el detalle cada relacionada es un botón que lleva a ella. No afecta al presupuesto: cada actividad cuenta su propio importe.
- **Equipaje:** «Cargar lista base» crea una lista con cantidades y notas. Por ejemplo, Ropa → Interior trae como cantidad el número de días y, en las notas, el tipo de prendas. En las listas que ya existen, el botón añade solo lo que falte. Las cantidades no se recalculan solas.

## Modelo de datos 5 (`schemaVersion: 5`)

La referencia completa está en [docs/modelo-datos.md](docs/modelo-datos.md). Resumen:

- **Viaje:** `travelers`, `timeZone`, `currency`, `rates`, `insurances`, `packing`, `tasks`, `days`, `activities`, `practical` y `links`.
- **Día:** `id`, `date`, `name`, `weatherPlace` (opcional, lugar de la previsión) y `lodging: "home"` (opcional, noche en casa).
- **Actividad:** inicio (`dayId`, `time`), fin (`endDate`, `endTime`), `title`, `category`, `status`, ubicación, notas, `locator`, `bookingUrl` (documento de Drive), `links`, importes con `currency` y `participants`, `related` (ids de actividades relacionadas) y `completed`.
  - Los transportes añaden `transportType`, `origin`, `destination`, `transportCode` y `journeyId`, que agrupa los tramos de un mismo trayecto.
- **Equipaje:** `category`, `text`, `qty`, `notes` y `done`.

Reglas:

- **Reservas**: actividades en estado `Pendiente` o `Reservado`.
- **Estancia**: actividad de categoría `Alojamiento` cuyo fin cae en un día posterior al inicio. Aparece al final de cada día, desde el check-in hasta el día anterior al check-out.
- **Presupuesto**: suma en euros todas las actividades, usando `rates`. Si falta el tipo de cambio de una moneda, Gastos lo avisa y esos importes no se suman. El reparto por persona es a partes iguales entre `participants`.
- **Alojamiento activo**: el día de un check-out, antes de esa hora se usa el alojamiento de salida y después el de esa noche. El botón «Volver al alojamiento» usa esta regla para ordenar las opciones.
- **Tiempo**: previsión de [Open-Meteo](https://open-meteo.com/), sin clave y para uso no comercial, con el texto «Weather data by Open-Meteo». Se guarda en caché 3 horas.
- **Documentos de Drive**: vista previa incrustada (`/preview`) y siempre el botón «Abrir en Drive». Si el documento no está compartido o el navegador bloquea las cookies de Google, la vista previa puede mostrar la pantalla de inicio de sesión.
- **Calendario**: Ajustes → «📅 Exportar a calendario» genera un `.ics` con un evento por actividad. Las horas se convierten a UTC con la zona del viaje.
- **PDF**: impresión del navegador con una vista sin menús ni botones. Cada día empieza en una página nueva.

### Migración automática al abrir o importar

- **Del modelo 4 al 5:**
  - Cada vuelta (`returnTrip`) pasa a ser una actividad propia, «Vuelta · …», relacionada con la ida («Ida · …») y del mismo trayecto. Su importe queda a 0.
  - «Incluida en» (`linkedTo`) pasa a ser «relacionadas», y cada actividad cuenta su propio importe.
  - A los transportes se les asigna un tipo según su texto. Revísalo: puede no acertar.
  - Las categorías de ropa del equipaje pasan a «Ropa».
- **Del modelo 3 al 4:** se rellenan los campos nuevos con valores vacíos o por defecto. La zona horaria se detecta la primera vez que el viaje se abre con conexión.
- **Del modelo 2 al 3:**
  - `accommodations` y `reservations` pasan a ser actividades.
  - Las actividades que antes cubría una reserva quedan como relacionadas. Su importe se pasa a las notas para no contarlo dos veces.

## Guardado y versiones

- Los cambios se guardan automáticamente en `localStorage`.
- La copia local tiene prioridad sobre el JSON publicado.
- Cada cambio actualiza `updatedAt` (fecha y hora de la última modificación) en el viaje.
- Cuando se publica una versión nueva, aparece el aviso «Hay una versión nueva de WanderLog · Recargar».
- **⚙️ Ajustes → ↺ Restaurar este viaje** carga el archivo del repositorio y elimina la copia local.
- **⚙️ Ajustes → Copia del viaje:**
  - **⬇️ Exportar viaje** descarga el viaje abierto como `.json`. Solo aparece con un viaje abierto.
  - **⬆️ Importar viaje** abre un `.json`. Acepta cualquier modelo (los anteriores se migran al abrirse) y archivos con varios viajes.
  - **📅 Exportar a calendario.**
- **Si el viaje importado ya existe** (mismo `id`), se abre una comparación:
  - Muestra la última modificación, las fechas, el número de actividades y reservas, las personas y los importes de cada versión.
  - Indica cuál de las dos es más reciente.
  - Lista las actividades añadidas, eliminadas y modificadas.
  - Opciones: **Cancelar** (también al hacer clic fuera de la ventana), **Guardar como viaje diferente** (pide un nombre nuevo) o **Reemplazar por el archivo**.

## Añadir un viaje publicado

1. Crea `data/trips/mi-viaje.json` siguiendo `atenas-egina.json`.
2. Añade su referencia a `data/catalog.json`.
3. Añade el JSON a `CORE` en `sw.js`.
4. Cambia el nombre de la caché al publicar una versión nueva.
