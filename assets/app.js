(() => {
  "use strict";

  const APP_VERSION = "1.0.0";
  const STORAGE_PREFIX = "wanderlog.trip.";
  const CUSTOM_KEY = "wanderlog.customTrips";
  const SETTINGS_KEY = "wanderlog.settings";
  const CATEGORIES = {
    Transporte: { icon: "🚌", className: "transporte" },
    Alojamiento: { icon: "🛏️", className: "alojamiento" },
    Cultura: { icon: "🏛️", className: "cultura" },
    Gastronomía: { icon: "🍽️", className: "gastronomia" },
    Naturaleza: { icon: "🌿", className: "naturaleza" },
    Otro: { icon: "📍", className: "otro" }
  };
  const STATUSES = ["Sin reserva necesaria", "Pendiente", "Reservado"];
  const state = {
    catalog: [],
    published: new Map(),
    trips: new Map(),
    currentTripId: null,
    view: "info",
    expanded: new Set(),
    modal: null,
    deferredInstall: null,
    settings: loadJSON(SETTINGS_KEY, { defaultCurrency: "EUR" }),
    online: navigator.onLine
  };

  const app = document.querySelector("#app");
  const importInput = document.querySelector("#json-import");

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    window.addEventListener("online", () => { state.online = true; render(); toast("Conexión recuperada"); });
    window.addEventListener("offline", () => { state.online = false; render(); toast("Estás sin conexión"); });
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      state.deferredInstall = event;
      render();
    });
    window.addEventListener("hashchange", applyRoute);
    app.addEventListener("click", handleClick);
    app.addEventListener("submit", handleSubmit);
    app.addEventListener("change", handleChange);
    importInput.addEventListener("change", importJSONFile);

    await loadTrips();
    applyRoute();
    registerServiceWorker();
  }

  async function loadTrips() {
    let catalog = { trips: [] };
    try {
      const response = await fetch("data/catalog.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("No se pudo cargar el catálogo");
      catalog = await response.json();
    } catch (error) {
      console.warn(error);
      toast("Catálogo publicado no disponible; se usarán los viajes locales");
    }

    const entries = Array.isArray(catalog.trips) ? catalog.trips : [];
    const loaded = await Promise.all(entries.map(async entry => {
      try {
        const response = await fetch(entry.file, { cache: "no-cache" });
        if (!response.ok) throw new Error(entry.file);
        return await response.json();
      } catch (error) {
        console.warn("Viaje publicado no disponible", error);
        return null;
      }
    }));

    loaded.filter(Boolean).forEach(trip => {
      normalizeTrip(trip);
      state.published.set(trip.id, clone(trip));
      const local = loadJSON(STORAGE_PREFIX + trip.id, null);
      state.trips.set(trip.id, local ? normalizeTrip(local) : clone(trip));
    });

    const customIds = loadJSON(CUSTOM_KEY, []);
    customIds.forEach(id => {
      const local = loadJSON(STORAGE_PREFIX + id, null);
      if (local) state.trips.set(id, normalizeTrip(local));
    });
    syncCatalog();
  }

  function normalizeTrip(trip) {
    trip.schemaVersion = 1;
    trip.currency ||= state.settings.defaultCurrency || "EUR";
    trip.summary ||= "";
    trip.travelers ||= "";
    trip.notes ||= "";
    trip.coverImage ||= "assets/icons/icon.svg";
    trip.info ||= { accommodation: [], transport: [], practical: [], links: [] };
    trip.info.accommodation ||= [];
    trip.info.transport ||= [];
    trip.info.practical ||= [];
    trip.info.links ||= [];
    trip.activities = Array.isArray(trip.activities) ? trip.activities : [];
    trip.activities.forEach(activity => {
      activity.id ||= uid("act");
      activity.category = CATEGORIES[activity.category] ? activity.category : "Otro";
      activity.status = STATUSES.includes(activity.status) ? activity.status : "Pendiente";
      activity.links = Array.isArray(activity.links) ? activity.links : [];
      activity.estimated = Number(activity.estimated) || 0;
      activity.spent = Number(activity.spent) || 0;
      activity.completed = Boolean(activity.completed);
    });
    sortActivities(trip);
    return trip;
  }

  function syncCatalog() {
    state.catalog = [...state.trips.values()]
      .map(trip => ({ id: trip.id, name: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, cover: trip.coverImage }))
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  }

  function applyRoute() {
    const match = location.hash.match(/^#viaje\/([^/?]+)/);
    if (match && state.trips.has(decodeURIComponent(match[1]))) {
      state.currentTripId = decodeURIComponent(match[1]);
      const params = new URLSearchParams(location.hash.split("?")[1] || "");
      const requestedView = params.get("vista");
      state.view = ["info", "horario", "mapa"].includes(requestedView) ? requestedView : state.view;
    } else {
      state.currentTripId = null;
    }
    state.modal = null;
    render();
  }

  function render() {
    app.innerHTML = `${state.online ? "" : '<div class="offline-banner">Sin conexión · los cambios se guardan en este dispositivo</div>'}${state.currentTripId ? renderTrip() : renderHome()}${renderModal()}`;
  }

  function renderTopbar(title = "", subtitle = "") {
    return `<header class="topbar"><div class="topbar-inner">
      ${state.currentTripId ? '<button class="icon-btn" data-action="home" aria-label="Volver a viajes">←</button>' : `<a class="brand" href="#"><img class="brand-logo" src="assets/icons/icon.svg" alt=""><span>WanderLog</span></a>`}
      ${state.currentTripId ? `<div class="topbar-title"><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div>` : '<div style="flex:1"></div>'}
      <button class="icon-btn" data-action="settings" aria-label="Abrir configuración">⚙️</button>
    </div></header>`;
  }

  function renderHome() {
    const cards = state.catalog.map(meta => renderTripCard(state.trips.get(meta.id))).join("");
    return `${renderTopbar()}
      <main class="page">
        <section class="hero">
          <div><p class="eyebrow">Tu ruta, a tu manera</p><h1>Viajes claros.<br>Recuerdos grandes.</h1><p>Organiza horarios, reservas, mapas y presupuesto en un solo lugar. Tus cambios se guardan automáticamente en este dispositivo.</p></div>
          <div class="hero-card"><p class="eyebrow">Listo para salir</p><h2 style="margin:0">${state.catalog.length} ${state.catalog.length === 1 ? "viaje" : "viajes"}</h2><p>${totalActivities()} actividades · ${completedActivities()} completadas</p><button class="secondary-btn" data-action="import">Importar JSON</button></div>
        </section>
        <section class="section-heading"><div><h2>Mis viajes</h2><p>Abre un viaje para ver su plan.</p></div></section>
        <div class="trip-grid">${cards || '<div class="empty-state">Todavía no hay viajes. Crea el primero abajo.</div>'}</div>
        <section class="section-heading"><div><h2>Nuevo viaje</h2><p>Solo lo esencial; podrás completar los detalles después.</p></div></section>
        ${renderQuickTripForm()}
      </main>`;
  }

  function renderTripCard(trip) {
    const total = trip.activities.length;
    const completed = trip.activities.filter(a => a.completed).length;
    const percent = total ? Math.round(completed / total * 100) : 0;
    return `<article class="trip-card">
      <div class="trip-card-cover"><img src="${safeSrc(trip.coverImage)}" alt="${esc(trip.destination)}" onerror="this.src='assets/icons/icon.svg'"><span class="trip-dates">${formatRange(trip.startDate, trip.endDate)}</span></div>
      <div class="trip-card-body"><h3>${esc(trip.name)}</h3><p>${esc(trip.destination)}</p>
        <div class="trip-card-meta"><div class="progress" aria-label="${percent}% completado"><i style="width:${percent}%"></i></div><small>${completed}/${total}</small><button class="primary-btn" data-action="open-trip" data-id="${attr(trip.id)}">Abrir</button></div>
      </div>
    </article>`;
  }

  function renderQuickTripForm() {
    const today = new Date().toISOString().slice(0, 10);
    return `<form class="quick-form form-grid cols-2" data-form="new-trip">
      <div class="field"><label for="new-name">Nombre</label><input id="new-name" name="name" required placeholder="Escapada a Lisboa"></div>
      <div class="field"><label for="new-destination">Destino</label><input id="new-destination" name="destination" required placeholder="Lisboa, Portugal"></div>
      <div class="field"><label for="new-start">Inicio</label><input id="new-start" name="startDate" type="date" required value="${today}"></div>
      <div class="field"><label for="new-end">Fin</label><input id="new-end" name="endDate" type="date" required value="${today}"></div>
      <div class="field span-2"><label for="new-cover">Imagen de portada (URL o ruta local, opcional)</label><input id="new-cover" name="coverImage" placeholder="https://… o assets/img/mi-viaje.jpg"></div>
      <div class="span-2"><button class="primary-btn" type="submit">Crear viaje</button></div>
    </form>`;
  }

  function renderTrip() {
    const trip = currentTrip();
    return `${renderTopbar(trip.name, formatRange(trip.startDate, trip.endDate))}
      <section class="trip-hero"><img src="${safeSrc(trip.coverImage)}" alt="${esc(trip.destination)}" onerror="this.style.display='none'"><div class="trip-hero-content"><p class="eyebrow">${esc(trip.destination)}</p><h1>${esc(trip.name)}</h1><p>${esc(trip.summary)}</p></div></section>
      <nav class="tabbar" aria-label="Secciones del viaje">
        ${tabButton("info", "ℹ️", "Info")}${tabButton("horario", "🗓️", "Horario")}${tabButton("mapa", "🗺️", "Mapa")}
      </nav>
      <main class="page">${state.view === "info" ? renderInfo(trip) : state.view === "horario" ? renderSchedule(trip) : renderMap(trip)}</main>
      ${state.view === "horario" ? '<button class="fab" data-action="add-activity">＋ Añadir</button>' : ""}`;
  }

  function tabButton(view, icon, label) {
    return `<button data-action="set-view" data-view="${view}" class="${state.view === view ? "active" : ""}"><span>${icon}</span>${label}</button>`;
  }

  function renderInfo(trip) {
    const budget = tripBudget(trip);
    return `<section class="stats-grid">
      <div class="stat"><span>Duración</span><strong>${dayCount(trip.startDate, trip.endDate)} días</strong></div>
      <div class="stat"><span>Actividades</span><strong>${trip.activities.length}</strong></div>
      <div class="stat"><span>Estimado</span><strong>${money(budget.estimated, trip.currency)}</strong></div>
      <div class="stat"><span>Gastado</span><strong>${money(budget.spent, trip.currency)}</strong></div>
    </section>
    <div class="info-grid">
      <section class="panel"><div class="section-heading" style="margin-top:0"><div><h2>Información</h2><p>Datos generales del viaje.</p></div><button class="ghost-btn" data-action="edit-trip">Editar</button></div>
        <div class="info-list"><div class="info-item"><h4>Viajeros</h4><p>${esc(trip.travelers || "Sin indicar")}</p></div><div class="info-item"><h4>Notas</h4><p>${nl2br(trip.notes || "Sin notas")}</p></div></div>
      </section>
      <section class="panel"><div class="section-heading" style="margin-top:0"><div><h2>Alojamiento</h2></div></div>${renderInfoItems(trip.info.accommodation)}</section>
      <section class="panel"><div class="section-heading" style="margin-top:0"><div><h2>Transporte</h2></div></div>${renderInfoItems(trip.info.transport)}</section>
      <section class="panel"><div class="section-heading" style="margin-top:0"><div><h2>Práctico</h2></div></div><div class="info-list">${trip.info.practical.map(item => `<div class="info-item"><p>✓ ${esc(item)}</p></div>`).join("") || '<p>Sin información práctica.</p>'}</div></section>
      <section class="panel"><div class="section-heading" style="margin-top:0"><div><h2>Enlaces</h2></div></div><div class="link-list">${trip.info.links.map(link => `<a href="${safeUrl(link.url)}" target="_blank" rel="noopener">${esc(link.label)} <span>↗</span></a>`).join("") || '<p>Sin enlaces.</p>'}</div></section>
      <section class="panel"><div class="section-heading" style="margin-top:0"><div><h2>Presupuesto</h2><p>Resumen por día.</p></div></div>${renderBudgetByDay(trip)}</section>
    </div>`;
  }

  function renderInfoItems(items) {
    return `<div class="info-list">${items.map(item => `<div class="info-item"><h4>${esc(item.name)}</h4><p>${esc(item.detail)}</p><div class="detail-top" style="margin-top:8px"><span class="status-badge ${slug(item.status)}">${esc(item.status)}</span>${item.mapQuery ? `<a href="${mapLink(item.mapQuery)}" target="_blank" rel="noopener">Ver mapa ↗</a>` : ""}</div></div>`).join("") || '<p>Sin datos.</p>'}</div>`;
  }

  function renderBudgetByDay(trip) {
    return `<div class="info-list">${datesForTrip(trip).map(date => {
      const activities = trip.activities.filter(a => a.date === date);
      const estimated = sum(activities, "estimated");
      const spent = sum(activities, "spent");
      return `<div class="info-item"><h4>${formatDate(date)}</h4><p>Estimado: <strong>${money(estimated, trip.currency)}</strong> · Gastado: <strong>${money(spent, trip.currency)}</strong></p></div>`;
    }).join("")}</div>`;
  }

  function renderSchedule(trip) {
    return `<section class="section-heading"><div><h2>Horario</h2><p>Toca una actividad para ver todos sus detalles.</p></div></section>
      ${datesForTrip(trip).map(date => renderDay(trip, date)).join("")}`;
  }

  function renderDay(trip, date) {
    const activities = trip.activities.filter(a => a.date === date);
    return `<section class="day"><div class="day-head"><div><h2>${formatDate(date)}</h2><p>${activities.length} ${activities.length === 1 ? "actividad" : "actividades"} · ${money(sum(activities,"estimated"),trip.currency)} estimado · ${money(sum(activities,"spent"),trip.currency)} gastado</p></div><button class="secondary-btn" data-action="edit-day" data-date="${date}">Tabla</button></div>
      <div class="activities">${activities.map(activity => renderActivity(activity, trip.currency)).join("") || '<div class="empty-state">Día libre. Añade una actividad cuando quieras.</div>'}</div></section>`;
  }

  function renderActivity(activity, currency) {
    const category = CATEGORIES[activity.category] || CATEGORIES.Otro;
    const expanded = state.expanded.has(activity.id);
    return `<article class="activity category-${category.className} ${activity.completed ? "completed" : ""} ${expanded ? "expanded" : ""}" data-activity-id="${attr(activity.id)}">
      <div class="activity-summary">
        <button class="complete-check" data-action="toggle-complete" data-id="${attr(activity.id)}" aria-label="${activity.completed ? "Marcar como pendiente" : "Marcar como completada"}">${activity.completed ? "✓" : ""}</button>
        <button data-action="toggle-activity" data-id="${attr(activity.id)}" style="display:block;width:100%;padding:0;border:0;background:transparent;text-align:left;min-width:0">
          <span class="activity-main"><span class="activity-line"><span class="activity-time">${esc(activity.time || "--:--")}</span><span class="activity-title">${category.icon} ${esc(activity.title)}</span></span><span class="activity-subline">${esc(activity.location || activity.category)}</span></span>
        </button>
        <button class="expand-btn" data-action="toggle-activity" data-id="${attr(activity.id)}" aria-label="${expanded ? "Contraer" : "Expandir"}">${expanded ? "⌃" : "⌄"}</button>
      </div>
      <div class="activity-details">
        <div class="detail-top"><span class="category-badge">${category.icon} ${esc(activity.category)}</span><span class="status-badge ${slug(activity.status)}">${esc(activity.status)}</span></div>
        ${activity.notes ? `<p>${nl2br(activity.notes)}</p>` : ""}
        <div class="budget-line"><div class="budget-pill"><span>Estimado</span><strong>${money(activity.estimated,currency)}</strong></div><div class="budget-pill"><span>Gastado</span><strong>${money(activity.spent,currency)}</strong></div></div>
        ${activity.image?.src ? `<img class="activity-image" src="${safeSrc(activity.image.src)}" alt="${esc(activity.image.alt || activity.title)}" loading="lazy">` : ""}
        <div class="activity-actions">${activity.mapQuery ? `<a href="${mapLink(activity.mapQuery)}" target="_blank" rel="noopener">📍 Google Maps</a>` : ""}${activity.links.map(link => `<a href="${safeUrl(link.url)}" target="_blank" rel="noopener">${esc(link.label)} ↗</a>`).join("")}<button data-action="edit-activity" data-id="${attr(activity.id)}">✏️ Editar</button><button data-action="delete-activity" data-id="${attr(activity.id)}">🗑️ Eliminar</button></div>
      </div>
    </article>`;
  }

  function renderMap(trip) {
    const places = trip.activities.filter(a => a.mapQuery).filter((activity, index, all) => all.findIndex(x => x.mapQuery === activity.mapQuery) === index);
    const query = places[0]?.mapQuery || trip.destination;
    return `<section class="section-heading"><div><h2>Mapa</h2><p>Mapa incrustado sin clave y enlaces directos a Google Maps.</p></div></section>
      <div class="map-wrap"><iframe class="map-frame" title="Mapa de ${esc(trip.destination)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${mapEmbed(query)}"></iframe>
      <div class="map-list">${places.map(activity => `<a class="map-place" href="${mapLink(activity.mapQuery)}" target="_blank" rel="noopener"><span>${CATEGORIES[activity.category]?.icon || "📍"}</span><span><strong>${esc(activity.title)}</strong><small>${esc(activity.location)}</small></span></a>`).join("")}</div></div>`;
  }

  function renderModal() {
    if (!state.modal) return "";
    if (state.modal.type === "activity") return activityModal(state.modal.activity);
    if (state.modal.type === "day") return dayTableModal(state.modal.date);
    if (state.modal.type === "trip") return tripEditModal();
    if (state.modal.type === "settings") return settingsModal();
    return "";
  }

  function modalShell(title, body, wide = false) {
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal ${wide ? "modal-wide" : ""}" role="dialog" aria-modal="true" aria-label="${attr(title)}" data-modal-body><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Cerrar">×</button></div>${body}</section></div>`;
  }

  function activityModal(activity) {
    const trip = currentTrip();
    const isNew = !activity?.id;
    const a = { id: "", date: trip.startDate, time: "09:00", endTime: "10:00", title: "", category: "Otro", location: "", mapQuery: "", status: "Pendiente", notes: "", links: [], estimated: 0, spent: 0, completed: false, image: null, ...(activity || {}) };
    const linksText = a.links.map(link => `${link.label}|${link.url}`).join("\n");
    return modalShell(isNew ? "Añadir actividad" : "Editar actividad", `<form data-form="activity" class="modal-grid cols-2">
      <input type="hidden" name="id" value="${attr(a.id)}">
      <div class="field"><label>Fecha</label><input name="date" type="date" min="${trip.startDate}" max="${trip.endDate}" required value="${attr(a.date)}"></div>
      <div class="field"><label>Categoría</label><select name="category">${Object.keys(CATEGORIES).map(name => `<option ${name === a.category ? "selected" : ""}>${name}</option>`).join("")}</select></div>
      <div class="field"><label>Hora de inicio</label><input name="time" type="time" required value="${attr(a.time)}"></div>
      <div class="field"><label>Hora de fin</label><input name="endTime" type="time" value="${attr(a.endTime || "")}"></div>
      <div class="field span-2"><label>Título</label><input name="title" required value="${attr(a.title)}"></div>
      <div class="field"><label>Lugar</label><input name="location" value="${attr(a.location || "")}"></div>
      <div class="field"><label>Búsqueda para Google Maps</label><input name="mapQuery" value="${attr(a.mapQuery || "")}" placeholder="Museo, dirección o coordenadas"></div>
      <div class="field"><label>Estado</label><select name="status">${STATUSES.map(status => `<option ${status === a.status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
      <div class="field"><label>Completada</label><select name="completed"><option value="false" ${!a.completed ? "selected" : ""}>No</option><option value="true" ${a.completed ? "selected" : ""}>Sí</option></select></div>
      <div class="field"><label>Presupuesto estimado (${trip.currency})</label><input name="estimated" type="number" min="0" step="0.01" value="${a.estimated}"></div>
      <div class="field"><label>Gastado (${trip.currency})</label><input name="spent" type="number" min="0" step="0.01" value="${a.spent}"></div>
      <div class="field span-2"><label>Notas</label><textarea name="notes">${esc(a.notes || "")}</textarea></div>
      <div class="field span-2"><label>Enlaces (uno por línea: etiqueta|URL)</label><textarea name="links">${esc(linksText)}</textarea></div>
      <div class="field"><label>Tipo de imagen</label><select name="imageType"><option value="url" ${a.image?.type !== "local" ? "selected" : ""}>URL</option><option value="local" ${a.image?.type === "local" ? "selected" : ""}>Local</option></select></div>
      <div class="field"><label>Imagen por URL o ruta local</label><input id="activity-image-src" name="imageSrc" value="${attr(a.image?.src || "")}" placeholder="https://… o assets/img/foto.jpg"></div>
      <div class="field span-2"><label>O seleccionar imagen local</label><input type="file" accept="image/*" data-image-target="activity-image-src"><small>La imagen se guarda en este dispositivo como parte del viaje.</small></div>
      <div class="span-2 btn-row"><button type="button" class="secondary-btn" data-action="close-modal">Cancelar</button><button type="submit" class="primary-btn">${isNew ? "Añadir" : "Guardar"}</button></div>
    </form>`);
  }

  function dayTableModal(date) {
    const trip = currentTrip();
    const activities = trip.activities.filter(a => a.date === date);
    const rows = activities.map(a => `<tr data-row-id="${attr(a.id)}">
      <td><input class="mini" name="time" type="time" value="${attr(a.time)}"></td>
      <td><input name="title" value="${attr(a.title)}"></td>
      <td><select name="category">${Object.keys(CATEGORIES).map(c => `<option ${c === a.category ? "selected" : ""}>${c}</option>`).join("")}</select></td>
      <td><input name="location" value="${attr(a.location || "")}"></td>
      <td><select name="status">${STATUSES.map(s => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
      <td><input class="mini" name="estimated" type="number" min="0" step=".01" value="${a.estimated}"></td>
      <td><input class="mini" name="spent" type="number" min="0" step=".01" value="${a.spent}"></td>
      <td><select name="completed"><option value="false" ${!a.completed ? "selected" : ""}>No</option><option value="true" ${a.completed ? "selected" : ""}>Sí</option></select></td>
    </tr>`).join("");
    return modalShell(`Editar ${formatDate(date)}`, `<form data-form="day-table"><input type="hidden" name="date" value="${date}"><div class="table-scroll"><table class="edit-table"><thead><tr><th>Hora</th><th>Actividad</th><th>Categoría</th><th>Lugar</th><th>Estado</th><th>Estimado</th><th>Gastado</th><th>Hecha</th></tr></thead><tbody>${rows}</tbody></table></div><div class="btn-row" style="margin-top:14px"><button type="button" class="secondary-btn" data-action="add-activity-date" data-date="${date}">＋ Añadir</button><button class="primary-btn" type="submit">Guardar tabla</button></div></form>`, true);
  }

  function tripEditModal() {
    const trip = currentTrip();
    return modalShell("Editar viaje", `<form data-form="trip" class="modal-grid cols-2">
      <div class="field"><label>Nombre</label><input name="name" required value="${attr(trip.name)}"></div>
      <div class="field"><label>Destino</label><input name="destination" required value="${attr(trip.destination)}"></div>
      <div class="field"><label>Inicio</label><input name="startDate" type="date" required value="${trip.startDate}"></div>
      <div class="field"><label>Fin</label><input name="endDate" type="date" required value="${trip.endDate}"></div>
      <div class="field"><label>Moneda</label><input name="currency" maxlength="3" required value="${attr(trip.currency)}" placeholder="EUR"></div>
      <div class="field"><label>Viajeros</label><input name="travelers" value="${attr(trip.travelers)}"></div>
      <div class="field span-2"><label>Resumen</label><textarea name="summary">${esc(trip.summary)}</textarea></div>
      <div class="field span-2"><label>Notas generales</label><textarea name="notes">${esc(trip.notes)}</textarea></div>
      <div class="field span-2"><label>Imagen de portada (URL o ruta local)</label><input id="trip-cover-src" name="coverImage" value="${attr(trip.coverImage)}"></div>
      <div class="field span-2"><label>O seleccionar imagen local</label><input type="file" accept="image/*" data-image-target="trip-cover-src"></div>
      <div class="span-2 btn-row"><button type="button" class="secondary-btn" data-action="close-modal">Cancelar</button><button type="submit" class="primary-btn">Guardar</button></div>
    </form>`);
  }

  function settingsModal() {
    const trip = currentTrip();
    return modalShell("Configuración", `<div class="settings-list">
      <div class="setting"><h3>Datos</h3><p>Importa o exporta copias completas en JSON. La importación conserva los viajes publicados y sustituye viajes con el mismo identificador.</p><div class="btn-row"><button class="secondary-btn" data-action="import">Importar JSON</button><button class="secondary-btn" data-action="export-all">Exportar todo</button>${trip ? '<button class="secondary-btn" data-action="export-trip">Exportar este viaje</button>' : ""}</div></div>
      <div class="setting"><h3>Moneda predeterminada</h3><p>Se aplicará al crear nuevos viajes.</p><form data-form="default-currency" class="btn-row"><input aria-label="Código de moneda" name="currency" maxlength="3" value="${attr(state.settings.defaultCurrency || "EUR")}" style="min-height:44px;padding:8px 10px;border:1px solid var(--line);border-radius:12px"><button class="primary-btn">Guardar</button></form></div>
      ${trip && state.published.has(trip.id) ? '<div class="setting"><h3>Versión publicada</h3><p>La versión local tiene prioridad. Restaurar elimina los cambios locales de este viaje y vuelve al JSON publicado.</p><button class="danger-btn" data-action="restore-published">Restaurar versión publicada</button></div>' : ""}
      ${trip ? '<div class="setting"><h3>Eliminar viaje</h3><p>Elimina la copia local de este viaje. Un viaje publicado reaparecerá en su versión original al recargar.</p><button class="danger-btn" data-action="delete-trip">Eliminar</button></div>' : ""}
      <div class="setting"><h3>Instalación</h3><p>WanderLog ${APP_VERSION} puede instalarse y conserva una caché básica para funcionar sin conexión.</p>${state.deferredInstall ? '<button class="primary-btn" data-action="install">Instalar aplicación</button>' : '<p><strong>Usa “Añadir a pantalla de inicio” en el menú del navegador si la opción está disponible.</strong></p>'}</div>
    </div>`);
  }

  function handleClick(event) {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.action;
    if (action === "close-modal" && event.target.closest("[data-modal-body]") && !event.target.closest("button[data-action='close-modal']")) return;

    if (action === "home") location.hash = "";
    if (action === "open-trip") location.hash = `#viaje/${encodeURIComponent(actionElement.dataset.id)}?vista=info`;
    if (action === "set-view") {
      state.view = actionElement.dataset.view;
      location.hash = `#viaje/${encodeURIComponent(state.currentTripId)}?vista=${state.view}`;
      render();
    }
    if (action === "settings") { state.modal = { type: "settings" }; render(); }
    if (action === "close-modal") { state.modal = null; render(); }
    if (action === "add-activity") { state.modal = { type: "activity", activity: null }; render(); }
    if (action === "add-activity-date") { state.modal = { type: "activity", activity: { date: actionElement.dataset.date } }; render(); }
    if (action === "edit-activity") {
      const activity = currentTrip().activities.find(a => a.id === actionElement.dataset.id);
      state.modal = { type: "activity", activity: clone(activity) }; render();
    }
    if (action === "toggle-activity") {
      const id = actionElement.dataset.id;
      state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
      render();
    }
    if (action === "toggle-complete") {
      const activity = currentTrip().activities.find(a => a.id === actionElement.dataset.id);
      activity.completed = !activity.completed; saveCurrent(); render();
    }
    if (action === "delete-activity") {
      if (confirm("¿Eliminar esta actividad?")) {
        const trip = currentTrip();
        trip.activities = trip.activities.filter(a => a.id !== actionElement.dataset.id);
        saveCurrent(); render(); toast("Actividad eliminada");
      }
    }
    if (action === "edit-day") { state.modal = { type: "day", date: actionElement.dataset.date }; render(); }
    if (action === "edit-trip") { state.modal = { type: "trip" }; render(); }
    if (action === "import") { importInput.value = ""; importInput.click(); }
    if (action === "export-all") exportData({ wanderlogExport: 1, exportedAt: new Date().toISOString(), trips: [...state.trips.values()] }, "wanderlog-todos-los-viajes.json");
    if (action === "export-trip") exportData(currentTrip(), `${slug(currentTrip().name)}.json`);
    if (action === "restore-published") restorePublished();
    if (action === "delete-trip") deleteCurrentTrip();
    if (action === "install") installApp();
  }

  function handleSubmit(event) {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    if (form.dataset.form === "new-trip") {
      if (data.endDate < data.startDate) return toast("La fecha final no puede ser anterior a la inicial");
      const id = uniqueTripId(slug(data.name));
      const trip = normalizeTrip({ id, name: data.name.trim(), destination: data.destination.trim(), startDate: data.startDate, endDate: data.endDate, currency: state.settings.defaultCurrency || "EUR", coverImage: data.coverImage.trim() || "assets/icons/icon.svg", summary: "", travelers: "", notes: "", info: { accommodation: [], transport: [], practical: [], links: [] }, activities: [] });
      state.trips.set(id, trip); addCustomId(id); saveTrip(trip); syncCatalog(); toast("Viaje creado"); location.hash = `#viaje/${encodeURIComponent(id)}?vista=info`; return;
    }

    if (form.dataset.form === "activity") {
      const trip = currentTrip();
      const existing = trip.activities.find(a => a.id === data.id);
      const fallbackDate = state.modal?.activity?.date || trip.startDate;
      const activity = normalizeActivity({
        id: data.id || uid("act"), date: data.date || fallbackDate, time: data.time, endTime: data.endTime, title: data.title.trim(), category: data.category, location: data.location.trim(), mapQuery: data.mapQuery.trim(), status: data.status, completed: data.completed === "true", notes: data.notes.trim(), links: parseLinks(data.links), estimated: Number(data.estimated) || 0, spent: Number(data.spent) || 0, image: data.imageSrc.trim() ? { type: data.imageType, src: data.imageSrc.trim(), alt: data.title.trim() } : null
      });
      if (existing) Object.assign(existing, activity); else trip.activities.push(activity);
      sortActivities(trip); saveCurrent(); state.modal = null; state.expanded.add(activity.id); render(); toast(existing ? "Actividad actualizada" : "Actividad añadida"); return;
    }

    if (form.dataset.form === "day-table") {
      const trip = currentTrip();
      form.querySelectorAll("tbody tr").forEach(row => {
        const activity = trip.activities.find(a => a.id === row.dataset.rowId);
        if (!activity) return;
        row.querySelectorAll("input,select").forEach(input => {
          if (["estimated", "spent"].includes(input.name)) activity[input.name] = Number(input.value) || 0;
          else if (input.name === "completed") activity.completed = input.value === "true";
          else activity[input.name] = input.value;
        });
      });
      sortActivities(trip); saveCurrent(); state.modal = null; render(); toast("Día actualizado y ordenado por hora"); return;
    }

    if (form.dataset.form === "trip") {
      const trip = currentTrip();
      if (data.endDate < data.startDate) return toast("La fecha final no puede ser anterior a la inicial");
      Object.assign(trip, { name: data.name.trim(), destination: data.destination.trim(), startDate: data.startDate, endDate: data.endDate, currency: data.currency.trim().toUpperCase(), travelers: data.travelers.trim(), summary: data.summary.trim(), notes: data.notes.trim(), coverImage: data.coverImage.trim() || "assets/icons/icon.svg" });
      sortActivities(trip); saveCurrent(); syncCatalog(); state.modal = null; render(); toast("Viaje actualizado"); return;
    }

    if (form.dataset.form === "default-currency") {
      state.settings.defaultCurrency = data.currency.trim().toUpperCase() || "EUR";
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      toast("Moneda predeterminada guardada"); render();
    }
  }

  function handleChange(event) {
    const input = event.target.closest("input[data-image-target]");
    if (!input || !input.files?.[0]) return;
    const file = input.files[0];
    if (file.size > 2_500_000) return toast("La imagen es demasiado grande. Usa una de menos de 2,5 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const target = document.getElementById(input.dataset.imageTarget);
      if (target) target.value = reader.result;
      toast("Imagen local preparada");
    };
    reader.readAsDataURL(file);
  }

  async function importJSONFile() {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const trips = Array.isArray(payload.trips) ? payload.trips : [payload];
      if (!trips.length || trips.some(trip => !trip.id || !trip.name || !trip.startDate || !trip.endDate)) throw new Error("Formato no reconocido");
      trips.forEach(raw => {
        const trip = normalizeTrip(raw);
        state.trips.set(trip.id, trip);
        saveTrip(trip);
        if (!state.published.has(trip.id)) addCustomId(trip.id);
      });
      syncCatalog(); state.modal = null; render(); toast(`${trips.length} ${trips.length === 1 ? "viaje importado" : "viajes importados"}`);
    } catch (error) {
      console.error(error); toast("No se pudo importar: JSON no válido");
    }
  }

  function restorePublished() {
    const trip = currentTrip();
    const published = state.published.get(trip.id);
    if (!published || !confirm("¿Restaurar la versión publicada? Se perderán los cambios locales de este viaje.")) return;
    localStorage.removeItem(STORAGE_PREFIX + trip.id);
    state.trips.set(trip.id, clone(published));
    state.modal = null; syncCatalog(); render(); toast("Versión publicada restaurada");
  }

  function deleteCurrentTrip() {
    const trip = currentTrip();
    if (!confirm(`¿Eliminar “${trip.name}” de este dispositivo?`)) return;
    localStorage.removeItem(STORAGE_PREFIX + trip.id);
    const custom = loadJSON(CUSTOM_KEY, []).filter(id => id !== trip.id);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    state.trips.delete(trip.id);
    if (state.published.has(trip.id)) state.trips.set(trip.id, clone(state.published.get(trip.id)));
    syncCatalog(); state.modal = null; location.hash = ""; toast("Viaje eliminado");
  }

  async function installApp() {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall = null;
    render();
  }

  function saveCurrent() { saveTrip(currentTrip()); syncCatalog(); }
  function saveTrip(trip) {
    try { localStorage.setItem(STORAGE_PREFIX + trip.id, JSON.stringify(trip)); }
    catch (error) { console.error(error); toast("No se pudo guardar. Reduce el tamaño de las imágenes locales."); }
  }
  function addCustomId(id) {
    const ids = loadJSON(CUSTOM_KEY, []);
    if (!ids.includes(id)) { ids.push(id); localStorage.setItem(CUSTOM_KEY, JSON.stringify(ids)); }
  }

  function exportData(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("JSON exportado");
  }

  function normalizeActivity(activity) {
    activity.category = CATEGORIES[activity.category] ? activity.category : "Otro";
    activity.status = STATUSES.includes(activity.status) ? activity.status : "Pendiente";
    activity.links = Array.isArray(activity.links) ? activity.links : [];
    return activity;
  }
  function sortActivities(trip) { trip.activities.sort((a, b) => `${a.date || ""} ${a.time || "99:99"}`.localeCompare(`${b.date || ""} ${b.time || "99:99"}`)); }
  function currentTrip() { return state.trips.get(state.currentTripId); }
  function totalActivities() { return [...state.trips.values()].reduce((n, trip) => n + trip.activities.length, 0); }
  function completedActivities() { return [...state.trips.values()].reduce((n, trip) => n + trip.activities.filter(a => a.completed).length, 0); }
  function tripBudget(trip) { return { estimated: sum(trip.activities, "estimated"), spent: sum(trip.activities, "spent") }; }
  function sum(items, key) { return items.reduce((total, item) => total + (Number(item[key]) || 0), 0); }

  function datesForTrip(trip) {
    const dates = [];
    const start = new Date(`${trip.startDate}T12:00:00`);
    const end = new Date(`${trip.endDate}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [...new Set(trip.activities.map(a => a.date))].sort();
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) dates.push(localISO(date));
    return dates;
  }
  function dayCount(start, end) {
    const a = new Date(`${start}T12:00:00`), b = new Date(`${end}T12:00:00`);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }
  function localISO(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
  function formatDate(date) { return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`)).replace(/^./, c => c.toUpperCase()); }
  function formatRange(start, end) {
    if (!start || !end) return "Fechas por confirmar";
    const fmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt.format(new Date(`${start}T12:00:00`))} – ${fmt.format(new Date(`${end}T12:00:00`))}`;
  }
  function money(value, currency) {
    try { return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency || "EUR", maximumFractionDigits: 2 }).format(Number(value) || 0); }
    catch { return `${(Number(value) || 0).toFixed(2)} ${currency || "EUR"}`; }
  }
  function parseLinks(text) {
    return String(text || "").split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
      const separator = line.indexOf("|");
      return separator > -1 ? { label: line.slice(0, separator).trim() || "Enlace", url: line.slice(separator + 1).trim() } : { label: "Enlace", url: line };
    }).filter(link => safeUrl(link.url) !== "#");
  }
  function mapLink(query) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`; }
  function mapEmbed(query) { return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`; }
  function safeUrl(url) { try { const parsed = new URL(url, location.href); return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "#"; } catch { return "#"; } }
  function safeSrc(src) { if (!src) return "assets/icons/icon.svg"; if (/^data:image\//.test(src)) return src; try { const parsed = new URL(src, location.href); return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "assets/icons/icon.svg"; } catch { return "assets/icons/icon.svg"; } }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char])); }
  function attr(value) { return esc(value); }
  function nl2br(value) { return esc(value).replace(/\n/g, "<br>"); }
  function slug(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "viaje"; }
  function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
  function uniqueTripId(base) { let id = base || "viaje"; let index = 2; while (state.trips.has(id)) id = `${base}-${index++}`; return id; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function loadJSON(key, fallback) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
  function toast(message) {
    const region = document.querySelector("#toast-region");
    if (!region) return;
    const element = document.createElement("div"); element.className = "toast"; element.textContent = message; region.appendChild(element);
    setTimeout(() => element.remove(), 3200);
  }
  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(error => console.warn("Service worker", error));
  }
})();
