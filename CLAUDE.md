# CLAUDE.md — WanderLog

## Qué es

WanderLog es una aplicación web estática para planificar viajes: horario por día con mapas, reservas, alojamientos, transportes de ida y vuelta, personas, seguro de viaje, equipaje, tareas y recordatorios, presupuesto multimoneda con gasto por persona, previsión del tiempo y exportación a calendario (.ics) y PDF.

- Mobile-first, instalable como PWA y usable sin conexión.
- Sin backend, sin build y sin dependencias npm. Se publica tal cual en GitHub Pages desde la raíz del repositorio.
- Librería externa: **Leaflet 1.9.4** (CSS y JS desde cdnjs), con teselas de OpenStreetMap.
- Servicios externos, sin clave y solo con conexión: **Open-Meteo** (previsión, geocodificación de ciudades y zona horaria), **Nominatim** (direcciones para los mapas), **Google Maps** (solo enlaces) y **Google Drive** (solo vista previa `/preview`).
- Interfaz y contenidos en español.
- **Versión actual:** app `5.0.1` · caché `wanderlog-v5.0.1` · modelo de datos `5`. El viaje publicado (`atenas-egina.json`, `2026.11.07-r7`) ya está guardado en el modelo 5.
- **Código:** nueve scripts en `assets/js/` (`core`, `model`, `services`, `info`, `schedule`, `forms`, `io`, `events`, `main`). Se cargan con `defer` en ese orden desde `index.html` y comparten el ámbito global; no hay `import`. `APP_VERSION` está en `core.js`.

**Estructura de archivos, funciones de cada script y modelo de datos completo:** [docs/modelo-datos.md](docs/modelo-datos.md).

## Reglas de trabajo

1. **No tocar los scripts de `assets/js/` sin explicar antes qué se va a cambiar y por qué**, y esperar la confirmación del usuario. Lo mismo para cualquier refactorización o reformateo de esos archivos.
2. Modificar solo los archivos que el usuario pida. Si un cambio necesita tocar otros, avisar antes.
3. Mantener la app estática: sin build, sin npm y sin frameworks. Cualquier librería o servicio externo nuevo debe consultarse antes, y las librerías deben venir de un CDN con versión exacta.
4. Respetar el estilo existente: código compacto, interfaz en español y diseño mobile-first.
5. Al cambiar cualquier archivo de `CORE`, subir la versión de `CACHE` en `sw.js` y, a la vez, `APP_VERSION` en `core.js`, para que los usuarios reciban la actualización. Si se añade, quita o renombra un script, actualizar también `index.html` (respetando el orden) y la lista `CORE`.
6. No romper la compatibilidad de datos: los cambios en el modelo deben mantener la migración de `normalizeTrip()` y la importación de modelos anteriores. Si cambia el modelo, subir `schemaVersion` y actualizar README.md.
7. No editar a mano los datos de viajes del usuario (`data/trips/*.json`) salvo que lo pida.
8. No hacer commits ni push salvo que el usuario lo pida.
9. Explicar los cambios en español, de forma clara, indicando archivo y línea.
10. **Cuando cambie la estructura de datos o la lógica de la app, actualizar en el mismo cambio CLAUDE.md, [docs/modelo-datos.md](docs/modelo-datos.md) y la versión de caché en `sw.js`.** Ver la tabla siguiente.

## Qué actualizar en cada cambio

| Tipo de cambio | Archivos que hay que actualizar |
|---|---|
| Lógica o interfaz (`assets/js/*.js`) | El script afectado · `APP_VERSION` en `core.js` · `CACHE` en `sw.js` (misma versión) · `docs/modelo-datos.md` si cambian funciones, bloques o reglas · CLAUDE.md si cambian las reglas o la versión actual · README.md si cambia lo que ve el usuario |
| Estilos (`styles.css`) | `styles.css` · `APP_VERSION` + `CACHE` |
| **Estructura de datos** | `model.js`: migración en `normalizeTrip`/`normalizeActivity` y, si aplica, `budget` · `io.js`: `DIFF_FIELDS`/`compareTrips` y `buildICS` · `schemaVersion` en `normalizeTrip` · `docs/modelo-datos.md` · README.md (Modelo de datos y Migración) · CLAUDE.md (versión actual) · `APP_VERSION` + `CACHE` · `data/trips/*.json` solo si el usuario lo pide |
| Datos de un viaje publicado | `data/trips/<viaje>.json` (subir `publishedVersion`) · `catalog.json` (`updatedAt`, y nombre o fechas si cambian) · `CACHE` |
| Nuevo viaje publicado | Crear `data/trips/<viaje>.json` siguiendo `atenas-egina.json` · añadirlo a `catalog.json` · añadirlo a `CORE` · `CACHE` + `APP_VERSION` |
| Nuevo archivo que debe funcionar sin conexión | Añadirlo a `CORE` · `CACHE` |
| Nueva librería o servicio externo | Consultarlo antes · CLAUDE.md («Qué es») · README.md |

**Versiones (`X.Y.Z`):** `APP_VERSION` y `CACHE` (`wanderlog-vX.Y.Z`) llevan siempre el mismo número.
- **Z**: correcciones.
- **Y**: funciones nuevas compatibles.
- **X**: cambio de modelo de datos (nuevo `schemaVersion`).

## Cómo probar

Hace falta un servidor HTTP: con `file://` fallan `fetch` y el Service Worker.

```bash
python -m http.server 8080
```

Abrir `http://localhost:8080`. Si los cambios no aparecen, puede ser la caché del Service Worker: recargar sin caché o anular el registro del SW en DevTools → Application.

**Comprobaciones mínimas tras un cambio:**
- La sintaxis de los nueve scripts es correcta: la app se pinta.
- Un viaje guardado con el modelo anterior se migra sin errores.
- El presupuesto del viaje publicado no cambia si no debía cambiar.
- Info, Horario, formularios, importación y exportación siguen funcionando.

## Específico de este equipo: pruebas sin Python

En este equipo no hay Python ni Node. Las pruebas se hacen así:
- **Servidor:** un script de PowerShell con `System.Net.HttpListener`, en segundo plano.
- **Navegador:** Chrome sin interfaz (`C:\Program Files\Google\Chrome\Application\chrome.exe --headless=new`):
  - `--dump-dom` con `--virtual-time-budget`, sobre páginas de prueba que abren la app en un iframe del mismo origen. En esas páginas hay que esperar comprobando el resultado, no con pausas fijas.
  - `--print-to-pdf` con `#viaje/<id>?vista=info&imprimir=1`, para la vista de impresión.
  - `--screenshot`, para revisar la maquetación a ojo.
- Las páginas y scripts de prueba van en el directorio temporal, nunca en el repositorio.
