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

## Modelo de datos 3 (`schemaVersion: 3`)

Cada viaje contiene:

- `days`: fecha y nombre resumen.
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
| `estimated`, `spent` | Importes estimado y gastado. |
| `linkedTo` | «Incluida en»: id de la actividad principal cuya reserva la cubre. No se cuenta en el presupuesto. |
| `returnTrip` | Solo transportes: vuelta con `dayId`, `time`, `endDate`, `endTime`, `notes`, `location`, `mapQuery`, `lat`, `lng` y `completed`, o `null`. |
| `completed` | Actividad completada (la vuelta tiene el suyo). |

Reglas:

- **Reservas** (Info) muestra las actividades en estado `Pendiente` o `Reservado` que no están incluidas en otra.
- **Alojamientos**: una actividad de categoría `Alojamiento` cuyo fin cae en un día posterior al inicio es una estancia. Aparece en Info → Alojamientos y al final de cada día desde el check-in hasta el día anterior al check-out. Al crear una, el check-in es a las 15:00 y el check-out al día siguiente a las 11:00, editables.
- **Ida y vuelta**: un transporte con `returnTrip` se muestra como dos entradas en el horario (*Ida* y *Vuelta*), que se editan desde el mismo formulario. Cuenta una sola vez en el presupuesto.
- **Presupuesto**: suma las actividades sin `linkedTo`.

Las secciones de Info conservan localmente su estado expandido o contraído. El mapa diario usa Leaflet y OpenStreetMap para mostrar la ruta completa sin una lista adicional. Google Maps se utiliza únicamente en los enlaces de navegación.

### Migración desde el modelo 2

Los viajes con `accommodations` y `reservations` se migran automáticamente al abrirse o importarse:

- Cada alojamiento pasa a ser una estancia. El check-in es el primer día asignado (15:00) y el check-out, el día siguiente al último asignado (11:00).
- Cada reserva se integra en su actividad principal, que recibe el estado, los importes, el localizador y las notas de la reserva. Las otras actividades vinculadas a esa reserva quedan como «Incluida en».
- Si una reserva no tiene actividad, se crea una nueva con su mismo id.

## Guardado y versiones

- Los cambios se guardan automáticamente en `localStorage`.
- La copia local tiene prioridad sobre el JSON publicado.
- **⚙️ Ajustes → ↺ Restaurar este viaje** carga el archivo del repositorio y elimina la copia local.
- La importación acepta el modelo 3, los modelos anteriores (que se migran al abrirse) y exportaciones completas.

## Añadir un viaje publicado

1. Crea `data/trips/mi-viaje.json` siguiendo `atenas-egina.json`.
2. Añade su referencia a `data/catalog.json`.
3. Añade el JSON a `CORE` en `sw.js`.
4. Cambia el nombre de la caché al publicar una versión nueva.
