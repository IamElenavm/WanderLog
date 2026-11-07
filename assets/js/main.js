"use strict";
// WanderLog · main.js
document.addEventListener("DOMContentLoaded",init);
async function init(){
 addEventListener("online",()=>{state.online=true;render();toast("Conexión recuperada")});addEventListener("offline",()=>{state.online=false;render();toast("Sin conexión")});
 addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.deferredInstall=e;render()});addEventListener("hashchange",applyRoute);
 app.addEventListener("click",handleClick);app.addEventListener("submit",handleSubmit);app.addEventListener("change",handleChange);importInput.addEventListener("change",importJSONFile);
 setInterval(()=>document.querySelectorAll("[data-tz]").forEach(el=>el.textContent=clockText(el.dataset.tz)),30000);
 await loadTrips();applyRoute();registerServiceWorker();
}
async function loadTrips(){
 let catalog={trips:[]};try{const r=await fetch("data/catalog.json",{cache:"no-cache"});if(!r.ok)throw 0;catalog=await r.json()}catch{toast("Catálogo no disponible")}
 const loaded=await Promise.all((catalog.trips||[]).map(async e=>{try{const r=await fetch(e.file,{cache:"no-cache"});return r.ok?await r.json():null}catch{return null}}));
 loaded.filter(Boolean).forEach(raw=>{const published=normalizeTrip(raw);state.published.set(published.id,clone(published));const local=loadJSON(STORAGE_PREFIX+published.id,null);state.trips.set(published.id,local?normalizeTrip(local):clone(published))});
 loadJSON(CUSTOM_KEY,[]).forEach(id=>{const local=loadJSON(STORAGE_PREFIX+id,null);if(local)state.trips.set(id,normalizeTrip(local))});syncCatalog();
}
function syncCatalog(){state.catalog=[...state.trips.values()].sort((a,b)=>(a.startDate||"").localeCompare(b.startDate||""))}
function applyRoute(){const m=location.hash.match(/^#viaje\/([^/?]+)/);if(m&&state.trips.has(decodeURIComponent(m[1]))){state.currentTripId=decodeURIComponent(m[1]);const p=new URLSearchParams(location.hash.split("?")[1]||"");state.view=["info","horario"].includes(p.get("vista"))?p.get("vista"):"info";state.printing=p.get("imprimir")==="1";state.infoApp=state.view==="info"&&infoApp(p.get("app"))?p.get("app"):null;const t=currentTrip();if(!t.days.some(d=>d.id===state.currentDayId))state.currentDayId=t.days[0]?.id||null}else state.currentTripId=null;state.modal=null;render()}
function render(){const printing=state.printing&&state.currentTripId;app.classList.toggle("printing",!!printing);if(printing){app.innerHTML=renderPrint(currentTrip());app.querySelectorAll("details").forEach(x=>x.open=true);return}app.innerHTML=`${state.updateReady?'<div class="update-banner">Hay una versión nueva de WanderLog <button data-action="reload-app">Recargar</button></div>':""}${state.online?"":'<div class="offline-banner">Sin conexión</div>'}${state.currentTripId?renderTrip():renderHome()}${renderModal()}`;scheduleLeafletMaps()}
function topbar(title="",sub=""){return `<header class="topbar"><div class="topbar-inner">${state.currentTripId?iconButton("home","←","Mis viajes"):`<a class="brand" href="#"><img class="brand-logo" src="assets/icons/icon.svg" alt=""><span>WanderLog</span></a>`}${state.currentTripId?`<div class="topbar-title"><strong>${esc(title)}</strong><small>${esc(sub)}</small></div>`:'<div style="flex:1"></div>'}${iconButton("settings","⚙️","Configuración")}</div></header>`}
function iconButton(action,icon,label,extra=""){return `<button class="icon-btn" data-action="${action}" ${extra} aria-label="${attr(label)}" title="${attr(label)}">${icon}</button>`}
function renderHome(){return `${topbar()}<main class="page"><div class="title-row"><h1>Mis viajes</h1></div><div class="icon-grid">${state.catalog.map(renderTripTile).join("")}<button class="trip-tile add-tile" data-action="new-trip"><span class="trip-icon">＋</span><span class="trip-name">Nuevo viaje</span></button></div></main>`}
function renderTripTile(t){return `<button class="trip-tile" data-action="open-trip" data-id="${attr(t.id)}"><span class="trip-icon">${esc(t.icon)}</span><span class="trip-name">${esc(t.name)}</span><span class="trip-date">${formatHomeRange(t.startDate,t.endDate)}</span></button>`}
function renderTrip(){const t=currentTrip(),people=peopleLabel(t);ensureTimeZone(t);return `${topbar(`${t.icon} ${t.name}`,`${formatTripRange(t.startDate,t.endDate)} · ${t.days.length} días${people?" · "+people:""}`)}<nav class="tabs has-add"><button class="tab-add" data-action="add-menu" aria-label="Añadir" title="Añadir">＋</button>${mainTab("info","ℹ️ Info")}${mainTab("horario","🗓️ Horario")}</nav><main class="page">${state.view==="info"?renderInfo(t):renderSchedule(t)}</main>`}
function mainTab(view,label){return `<button data-action="set-view" data-view="${view}" class="${state.view===view?"active":""}">${label}</button>`}
async function installApp(){if(state.deferredInstall){state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;render()}}
function currentTrip(){return state.trips.get(state.currentTripId)}function currentDay(t=currentTrip()){return t.days.find(d=>d.id===state.currentDayId)||t.days[0]}function findActivity(id){return currentTrip()?.activities.find(a=>a.id===id)}
