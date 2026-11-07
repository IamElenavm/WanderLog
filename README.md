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

## Modelo de datos 4 (`schemaVersion: 4`)

Cada viaje contiene:

- `travelers`: personas del viaje (`id`, `name`). Se muestran en la cabecera y se usan para el gasto por persona.
- `timeZone`: zona horaria IANA del destino (por ejemplo `Europe/Athens`). Si está vacía, se detecta con el geocodificador de Open-Meteo a partir del destino.
- `currency`: moneda habitual de los gastos. Los totales se muestran siempre en euros.
- `rates`: tipos de cambio fijos, uno por moneda (`{"USD": 0.92}` significa 1 USD = 0,92 €).
- `insurances`: seguros de viaje (`insurer`, `policyNumber`, `phone`, `startDate`, `endDate`, `documentUrl`, `notes`).
- `packing`: equipaje (`category`, `text`, `done`), agrupado por categorías. La ropa se divide en interior; pantalones, faldas y vestidos; camisas y camisetas; jerseys, abrigos y sudaderas; y calzado.
- `tasks`: tareas y recordatorios (`text`, `done`, `dueDate` opcional).
- `days`: fecha, nombre resumen y `weatherPlace` opcional, el lugar de la previsión del tiempo de ese día.
- `activities`: **todo es una actividad**: visitas, comidas, transportes, reservas y alojamientos. Se ordenan por día y hora, con minimapa Leaflet y base OpenStreetMap al expandirse.
- `practical`: siete bloques de notas prácticas.
- `links`: enlaces del viaje.

Campos de una actividad:

| Campo | Uso |
|---|---|
| `dayId`, `time` | Inicio: día y hora (en alojamientos, check-in). |
| `endDate`, `endTime` | Fin: fecha y hora (en alojamientos, check-out). |
| `title`, `category`, `status` | Estado: `Sin reserva necesaria`, `Pendiente` o `Reservado`. |
| `location`, `mapQuery`, `lat`, `lng` | Ubicación, búsqueda de mapa y coordenadas opcionales. |
| `notes` | Notas (en transportes con vuelta, notas para la ida). |
| `locator` | Localizador de la reserva. |
| `bookingUrl` | Documento de reserva (Drive). Se abre con «📄 Ver documento». |
| `links` | Enlaces relevantes (`label`, `url`). |
| `estimated`, `spent`, `currency` | Importes estimado y gastado, en la moneda `currency`. |
| `participants` | Ids de las personas entre las que se reparte el gasto a partes iguales. Vacío = todas. |
| `linkedTo` | «Incluida en»: id de la actividad principal cuya reserva la cubre. No se cuenta en el presupuesto. |
| `returnTrip` | Solo transportes: vuelta con `dayId`, `time`, `endDate`, `endTime`, `notes`, `location`, `mapQuery`, `lat`, `lng` y `completed`, o `null`. |
| `completed` | Actividad completada (la vuelta tiene el suyo). |

Reglas:

- **Reservas** (Info) muestra las actividades en estado `Pendiente` o `Reservado` que no están incluidas en otra.
- **Alojamientos**: una actividad de categoría `Alojamiento` cuyo fin cae en un día posterior al inicio es una estancia. Aparece en Info → Alojamientos y al final de cada día desde el check-in hasta el día anterior al check-out. Al crear una, el check-in es a las 15:00 y el check-out al día siguiente a las 11:00, editables.
- **Ida y vuelta**: un transporte con `returnTrip` se muestra como dos entradas en el horario (*Ida* y *Vuelta*), que se editan desde el mismo formulario. Cuenta una sola vez en el presupuesto.
- **Presupuesto**: suma en euros las actividades sin `linkedTo`, usando `rates`. Si falta el tipo de cambio de una moneda, Gastos lo avisa y esos importes no se suman. Gastos muestra también el total por persona.
- **Alojamiento activo**: el día en que un alojamiento termina, las actividades anteriores a su check-out usan ese alojamiento, y las demás, el de esa noche. Los botones «Volver al alojamiento» siguen esta regla. Si el mismo día hay salida y entrada, aparece un selector con los dos alojamientos.
- **Cabecera de Info**: inicio, fin, días, personas, importes, los días de Horario, un gráfico pequeño de gastos por tipo y, si la zona horaria del destino es distinta de la de Madrid, dos relojes.
- **Tiempo**: cada día de Horario muestra la previsión de [Open-Meteo](https://open-meteo.com/), sin clave y para uso no comercial, con el texto «Weather data by Open-Meteo». Se guarda en caché 3 horas. Solo hay previsión para unos 16 días vista.
- **Documentos de Drive**: en Reservas, Alojamientos y Seguro se muestra una vista previa incrustada (`/preview`) y siempre el botón «Abrir en Drive». Si el documento no está compartido o el navegador bloquea las cookies de Google, la vista previa puede mostrar la pantalla de inicio de sesión, pero el botón sigue funcionando.
- **Calendario**: Ajustes → «📅 Exportar a calendario» genera un `.ics` con cada actividad (la ida y la vuelta por separado). Las horas se convierten a UTC con la zona del viaje.
- **PDF**: el botón «🖨️ Guardar en PDF», al final de Info, abre la impresión del navegador con una vista sin menús ni botones. Cada día empieza en una página nueva.

Las secciones de Info conservan localmente su estado expandido o contraído. El mapa diario usa Leaflet y OpenStreetMap para mostrar la ruta completa sin una lista adicional. Google Maps se utiliza únicamente en los enlaces de navegación.

### Migración desde el modelo 3

Los campos nuevos se rellenan al abrir el viaje:
- listas vacías de personas, seguros, equipaje y tareas;
- `currency` de cada actividad = la moneda del viaje;
- `participants` vacío;
- `rates` vacío.

La zona horaria se detecta la primera vez que el viaje se abre con conexión. En los viajes en euros el presupuesto no cambia.

### Migración desde el modelo 2

Los viajes con `accommodations` y `reservations` se migran automáticamente al abrirse o importarse:

- Cada alojamiento pasa a ser una estancia. El check-in es el primer día asignado (15:00) y el check-out, el día siguiente al último asignado (11:00).
- Cada reserva se integra en su actividad principal, que recibe el estado, los importes, el localizador y las notas de la reserva. Las otras actividades vinculadas a esa reserva quedan como «Incluida en».
- Si una reserva no tiene actividad, se crea una nueva con su mismo id.

## Guardado y versiones

- Los cambios se guardan automáticamente en `localStorage`.
- La copia local tiene prioridad sobre el JSON publicado.
- Cada cambio actualiza `updatedAt` (fecha y hora de la última modificación) en el viaje.
- **⚙️ Ajustes → ↺ Restaurar este viaje** carga el archivo del repositorio y elimina la copia local.
- **⚙️ Ajustes → Copia del viaje:**
  - **⬇️ Exportar viaje** descarga el viaje abierto como `.json`. Solo aparece con un viaje abierto.
  - **⬆️ Importar viaje** abre un `.json`. Acepta el modelo 3, los modelos anteriores (que se migran al abrirse) y archivos con varios viajes.
- **Si el viaje importado ya existe** (mismo `id`), se abre una comparación:
  - Muestra la última modificación, las fechas, el número de actividades y reservas, y los importes de cada versión.
  - Indica cuál de las dos es más reciente.
  - Lista las actividades añadidas, eliminadas y modificadas.
  - Opciones:
    - **Cancelar**: no cambia nada. Hacer clic fuera de la ventana equivale a cancelar.
    - **Guardar como viaje diferente**: pide un nombre nuevo, que no puede repetir el de otro viaje.
    - **Reemplazar por el archivo**.

## Añadir un viaje publicado

1. Crea `data/trips/mi-viaje.json` siguiendo `atenas-egina.json`.
2. Añade su referencia a `data/catalog.json`.
3. Añade el JSON a `CORE` en `sw.js`.
4. Cambia el nombre de la caché al publicar una versión nueva.
