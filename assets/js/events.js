"use strict";
// WanderLog · events.js — clics, cambios y guardado de formularios
const tripHash=(view,extra="")=>`#viaje/${encodeURIComponent(state.currentTripId)}?vista=${view}${extra}`;
const focusSoon=sel=>setTimeout(()=>document.querySelector(sel)?.focus(),60);
const ACTIONS={
 home:()=>location.hash="",
 "open-trip":x=>location.hash=`#viaje/${encodeURIComponent(x.dataset.id)}?vista=info`,
 "set-view":x=>{state.view=x.dataset.view;state.infoApp=null;location.hash=tripHash(state.view);render()},
 settings:()=>openModal("settings"),
 "open-app":x=>location.hash=tripHash("info",`&app=${x.dataset.key}`),
 "close-app":()=>location.hash=tripHash("info"),
 "reload-app":()=>location.reload(),
 "close-modal":()=>{if(["import-conflict","import-new"].includes(state.modal?.type))nextImport();else{state.modal=null;render()}},
 "import-replace":()=>{storeImported(state.modal.trip);nextImport()},
 "import-as-new":()=>openModal("import-new",{trip:state.modal.trip}),
 "import-back":()=>openModal("import-conflict",{trip:state.modal.trip}),
 "add-menu":()=>openModal("add-menu"),
 "add-kind":x=>{const t=currentTrip(),k=x.dataset.kind,day=state.currentDayId||t.days[0]?.id;if(k==="Transporte"){state.modal={type:"journey",journeyId:"",ttype:"Avión",kind:"oneway",legs:[newLeg(dayDate(t,day))],status:"Reservado",locator:"",bookingUrl:"",estimated:0,spent:0,currency:t.currency,participants:[]};render()}else openModal("activity",{preset:k==="Alojamiento"?"stay":k,dayId:day})},
 "add-day":()=>openModal("day",{isNew:true}),
 "add-traveler":()=>openModal("traveler"),
 "add-insurance":()=>openModal("insurance"),
 "add-link":()=>openModal("link",{index:-1}),
 "add-task":()=>{state.modal=null;location.hash=tripHash("info","&app=tasks");focusSoon('form[data-form="task-add"] input[name="text"]')},
 "add-packing":()=>{state.modal=null;location.hash=tripHash("info","&app=packing");focusSoon('form[data-form="packing-add"] input[name="text"]')},
 "edit-traveler":x=>openModal("traveler",{id:x.dataset.id}),
 "delete-traveler":x=>deleteTraveler(x.dataset.id),
 "edit-insurance":x=>openModal("insurance",{id:x.dataset.id}),
 "delete-insurance":x=>{if(!confirm("¿Eliminar este seguro?"))return;const t=currentTrip();t.insurances=t.insurances.filter(i=>i.id!==x.dataset.id);finishSave("Seguro eliminado")},
 "delete-packing":x=>{const t=currentTrip();t.packing=t.packing.filter(i=>i.id!==x.dataset.id);saveCurrent();render()},
 "delete-task":x=>{const t=currentTrip();t.tasks=t.tasks.filter(i=>i.id!==x.dataset.id);saveCurrent();render()},
 "load-packing":()=>{const t=currentTrip(),have=new Set(t.packing.map(i=>`${i.category}|${i.text}`.toLowerCase())),add=packingTemplate(t).filter(i=>!have.has(`${i.category}|${i.text}`.toLowerCase()));t.packing.push(...add);saveCurrent();render();toast(add.length?`${add.length} elementos añadidos`:"Ya tienes toda la lista base")},
 "go-day":x=>{state.currentDayId=x.dataset.id;state.view="horario";state.dayView="plan";location.hash=tripHash("horario");render()},
 "goto-activity":x=>gotoActivity(x.dataset.id),
 "stay-choice":x=>{state.stayChoice[x.dataset.dayId]=+x.dataset.idx;render()},
 "toggle-res-group":(x,e)=>{e.preventDefault();const s=state.settings;s.resGroups||={};s.resGroups[state.currentTripId]||={};s.resGroups[state.currentTripId][x.dataset.cat]=!resGroupOpen(x.dataset.cat);localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));render()},
 "export-ics":()=>{const t=currentTrip();downloadFile(buildICS(t),`${slug(t.name)}.ics`,"text/calendar;charset=utf-8");toast("Calendario exportado")},
 "print-trip":()=>printTrip(),
 "new-trip":()=>openModal("new-trip"),
 "edit-trip":()=>openModal("trip"),
 "select-day":x=>{state.currentDayId=x.dataset.id;state.dayView="plan";render()},
 "day-view":x=>{state.dayView=x.dataset.view;render()},
 "edit-day":x=>openModal("day",{id:x.dataset.id}),
 "edit-activity":x=>openModal("activity",{id:x.dataset.id}),
 "edit-journey":x=>{const a=findActivity(x.dataset.id);if(a){state.modal=journeyFromActivity(currentTrip(),a);render()}},
 "journey-add-leg":x=>{const m=syncJourney(x.closest("form")),last=m.legs.at(-1);m.legs.push(newLeg(last?.arrDate||last?.depDate||"",last?.destination||"",""));render()},
 "journey-remove-leg":x=>{const m=syncJourney(x.closest("form"));m.legs.splice(+x.dataset.index,1);render()},
 "night-lodging":x=>openModal("night-lodging",{dayId:x.dataset.dayId}),
 "night-new":x=>openModal("activity",{preset:"stay",dayId:x.dataset.dayId}),
 "night-use":x=>useStayForNight(x.dataset.dayId,x.dataset.id),
 "night-home":x=>{const d=currentTrip().days.find(y=>y.id===x.dataset.dayId);if(d){d.lodging="home";finishSave("Noche en casa")}},
 "night-clear":x=>{const d=currentTrip().days.find(y=>y.id===x.dataset.dayId);if(d){delete d.lodging;finishSave("«Casa» quitada")}},
 "toggle-activity":x=>{state.expanded.has(x.dataset.id)?state.expanded.delete(x.dataset.id):state.expanded.add(x.dataset.id);render()},
 "toggle-complete":x=>{const y=findActivity(x.dataset.id);if(!y)return;y.completed=!y.completed;state.expanded.delete(y.id);saveCurrent();render()},
 "duplicate-activity":x=>duplicateActivity(x.dataset.id),
 "delete-activity":x=>deleteActivity(x.dataset.id),
 "delete-day":x=>deleteDay(x.dataset.id),
 "edit-practical":x=>openModal("practical",{key:x.dataset.key}),
 "edit-link":x=>openModal("link",{index:+x.dataset.index}),
 "delete-link":x=>deleteLink(+x.dataset.index),
 import:()=>{importInput.value="";importInput.click()},
 "export-trip":()=>{exportData(currentTrip(),`${slug(currentTrip().name)}.json`);toast("Viaje exportado")},
 "restore-published":()=>restorePublished(),
 "delete-trip":()=>deleteTrip(),
 install:()=>installApp()
};
ACTIONS["import-cancel"]=ACTIONS["close-modal"];
function handleClick(e){const x=e.target.closest("[data-action]");if(!x)return;const a=x.dataset.action;if(a==="close-modal"&&e.target.closest("[data-modal-body]")&&!e.target.closest("button[data-action='close-modal']"))return;ACTIONS[a]?.(x,e)}
function handleChange(e){const x=e.target;
 if(x.dataset.check){const t=currentTrip(),item=(x.dataset.check==="packing"?t.packing:t.tasks).find(i=>i.id===x.dataset.id);if(item){item.done=x.checked;saveCurrent();render()}return}
 if(x.dataset.packField){const item=currentTrip().packing.find(i=>i.id===x.dataset.id);if(!item)return;if(x.dataset.packField==="qty")item.qty=x.value===""?null:Math.max(0,Math.round(+x.value)||0);else item.notes=x.value.trim();saveCurrent();render();return}
 const f=x.closest("form[data-form]");if(!f)return;
 if(f.dataset.form==="activity"&&["category","dayId"].includes(x.name))updateActivityForm(f,x.name);
 if(f.dataset.form==="journey"&&x.name==="kind"){applyJourneyKind(syncJourney(f));render()}}
const badRange=(s,st,e,et)=>e<s||(e===s&&st&&et&&et<st);
function handleSubmit(e){const f=e.target.closest("form[data-form]");if(!f)return;e.preventDefault();const fd=new FormData(f),v=Object.fromEntries(fd.entries()),t=currentTrip(),kind=f.dataset.form;
 if(kind==="new-trip"){if(v.endDate<v.startDate)return toast("Fechas no válidas");const id=uniqueId(slug(v.name)),days=datesBetween(v.startDate,v.endDate).map((date,i)=>({id:uid("day"),date,name:`Día ${i+1}`})),trip=normalizeTrip({id,name:v.name.trim(),destination:v.destination.trim(),icon:destinationIcon(v.destination),currency:state.settings.defaultCurrency,days,activities:[],practical:Object.fromEntries(PRACTICAL.map(k=>[k,""])),links:[]});if(v.packing)trip.packing=packingTemplate(trip);state.trips.set(id,trip);addCustomId(id);saveTrip(trip);syncCatalog();location.hash=`#viaje/${id}?vista=info`;return}
 if(kind==="activity")return saveActivityForm(f,fd,v,t);
 if(kind==="journey")return saveJourney(f,fd,t);
 if(kind==="day"){let d=t.days.find(d=>d.id===v.id);if(d){const oldDate=d.date;f.querySelectorAll(".edit-row").forEach(row=>{const a=findActivity(row.dataset.rowId),prev=dayDate(t,a.dayId);row.querySelectorAll("input,select").forEach(i=>a[i.name]=i.value);const now=dayDate(t,a.dayId);if(prev!==now&&(a.endDate===prev||a.endDate<now))a.endDate=now});Object.assign(d,{date:v.date,name:v.name.trim()});if(v.date!==oldDate)t.activities.forEach(a=>{if(a.dayId===d.id&&a.endDate===oldDate)a.endDate=v.date})}else{d={id:uid("day"),date:v.date,name:v.name.trim()};t.days.push(d);state.currentDayId=d.id}const wp=String(v.weatherPlace||"").trim();if(wp)d.weatherPlace=wp;else delete d.weatherPlace;Object.keys(state.wx).forEach(k=>{if(k.endsWith("|"+d.id))delete state.wx[k]});sortDays(t);sortActivities(t);finishSave("Día guardado");return}
 if(kind==="trip"){if(!v.startDate||!v.endDate||v.endDate<v.startDate)return toast("Fechas no válidas");const tz=v.timeZone.trim(),cur=v.currency.trim().toUpperCase();if(tz&&!validTZ(tz))return toast("Zona horaria no válida (ejemplo: Europe/Athens)");if(!/^[A-Z]{3}$/.test(cur))return toast("Moneda no válida: usa un código de 3 letras");
  const range=new Set(datesBetween(v.startDate,v.endDate)),drop=t.days.filter(d=>!range.has(d.date));if(drop.length){const ids=new Set(drop.map(d=>d.id)),acts=t.activities.filter(a=>ids.has(a.dayId));if(acts.length&&!confirm(`Se eliminarán ${drop.length} día(s) (${drop.map(d=>shortDay(d.date)).join(", ")}) y ${acts.length} actividad(es):\n${acts.slice(0,12).map(a=>"• "+a.title).join("\n")}${acts.length>12?"\n…":""}\n\n¿Continuar?`))return;t.days=t.days.filter(d=>range.has(d.date));t.activities=t.activities.filter(a=>!ids.has(a.dayId));acts.forEach(a=>unlinkActivity(t,a.id))}
  const added=extendDays(t,[...range]);if(!t.days.some(d=>d.id===state.currentDayId))state.currentDayId=t.days[0]?.id;
  if(tz!==t.timeZone||v.destination.trim()!==t.destination)state.tzTried?.delete(t.id);Object.assign(t,{name:v.name.trim(),destination:v.destination.trim(),icon:v.icon.trim()||destinationIcon(v.destination),currency:cur,timeZone:tz});finishSave(added||drop.length?`Viaje guardado: ${added} día(s) añadidos, ${drop.length} eliminados`:"Viaje guardado");return}
 if(kind==="traveler"){const name=v.name.trim();if(!name)return toast("Escribe un nombre");if(t.travelers.some(p=>p.id!==v.id&&p.name.toLowerCase()===name.toLowerCase()))return toast("Esa persona ya está en el viaje");const p=t.travelers.find(x=>x.id===v.id);p?p.name=name:t.travelers.push({id:uid("per"),name});finishSave("Persona guardada");return}
 if(kind==="insurance"){if(v.startDate&&v.endDate&&v.endDate<v.startDate)return toast("Fechas de cobertura no válidas");const obj={id:v.id||uid("seg"),insurer:v.insurer.trim(),policyNumber:v.policyNumber.trim(),phone:v.phone.trim(),startDate:v.startDate,endDate:v.endDate,documentUrl:v.documentUrl.trim(),notes:v.notes.trim()},old=t.insurances.find(i=>i.id===v.id);old?Object.assign(old,obj):t.insurances.push(obj);finishSave("Seguro guardado");return}
 if(kind==="packing-add"||kind==="task-add"){const text=v.text.trim();if(!text)return;if(kind==="packing-add"){state.lastPackCat=v.category;t.packing.push({id:uid("eq"),category:v.category,text,qty:v.qty===""||v.qty==null?null:Math.max(0,Math.round(+v.qty)||0),notes:"",done:false})}else t.tasks.push({id:uid("tar"),text,done:false,dueDate:v.dueDate||""});saveCurrent();render();focusSoon(`form[data-form="${kind}"] input[name="text"]`);return}
 if(kind==="rates"){const rates={};Object.entries(v).forEach(([k,val])=>{if(k.startsWith("rate-")&&+val>0)rates[k.slice(5)]=+val});const nc=String(v.newCurrency||"").trim().toUpperCase();if(nc){if(!/^[A-Z]{3}$/.test(nc)||nc==="EUR")return toast("Código de moneda no válido");if(!(+v.newRate>0))return toast("Indica el valor en euros de 1 "+nc);rates[nc]=+v.newRate}t.rates=rates;finishSave("Tipos de cambio guardados");return}
 if(kind==="import-new"){const name=v.name.trim(),inc=state.modal?.trip;if(!inc)return;if(!name)return toast("Escribe un nombre");if([...state.trips.values()].some(x=>x.name.trim().toLowerCase()===name.toLowerCase()))return toast("Ya hay un viaje con ese nombre");inc.id=uniqueId(slug(name));inc.name=name;delete inc.publishedVersion;storeImported(inc);nextImport();return}
 if(kind==="practical"){t.practical[v.key]=v.value.trim();finishSave("Nota guardada");return}
 if(kind==="link"){const obj={id:t.links[+v.index]?.id||uid("link"),label:v.label.trim(),url:v.url.trim()};+v.index>=0?t.links[+v.index]=obj:t.links.push(obj);finishSave("Enlace guardado");return}
 if(kind==="default-currency"){state.settings.defaultCurrency=v.currency.trim().toUpperCase()||"EUR";localStorage.setItem(SETTINGS_KEY,JSON.stringify(state.settings));state.modal=null;render();toast("Moneda guardada")}}
function readMoney(t,fd,v){const cur=String(v.currency||t.currency).trim().toUpperCase();if(!/^[A-Z]{3}$/.test(cur)){toast("Moneda no válida: usa un código de 3 letras (EUR, USD…)");return null}let participants=fd.getAll("participants");if(participants.length===t.travelers.length)participants=[];return{currency:cur,participants,estimated:+v.estimated||0,spent:+v.spent||0}}
function saveActivityForm(f,fd,v,t){const old=t.activities.find(a=>a.id===v.id),cat=v.category,start=dayDate(t,v.dayId),endDate=v.endDate||start;if(badRange(start,v.time,endDate,v.endTime))return toast("Fechas no válidas: el fin es anterior al inicio");const m=readMoney(t,fd,v);if(!m)return;
 const obj={...m,id:v.id||uid(cat==="Alojamiento"?"acc":"act"),dayId:v.dayId,time:v.time,endDate,endTime:v.endTime,title:v.title.trim(),category:cat,location:v.location.trim(),mapQuery:v.mapQuery.trim(),status:v.status,completed:v.completed==="true",notes:v.notes.trim(),locator:v.locator.trim(),bookingUrl:v.bookingUrl.trim(),links:parseLinks(v.links)};
 if(cat==="Transporte"){Object.assign(obj,{transportType:TRANSPORT_TYPES[v.transportType]?v.transportType:"Otro",origin:v.origin.trim(),destination:v.destination.trim(),transportCode:v.transportCode.trim()});if(!obj.location&&obj.origin&&obj.destination)obj.location=`${obj.origin} → ${obj.destination}`;if(!obj.mapQuery&&obj.origin)obj.mapQuery=obj.origin}
 if(old&&(old.location!==obj.location||old.mapQuery!==obj.mapQuery)){delete old.lat;delete old.lng}const a=old?Object.assign(old,obj):(t.activities.push({...obj,related:[]}),t.activities.at(-1));if(cat!=="Transporte")["transportType","origin","destination","transportCode"].forEach(k=>delete a[k]);setRelated(t,a,fd.getAll("related"));sortActivities(t);finishSave(isStay(t,a)?"Alojamiento guardado":"Actividad guardada")}
// Añade al viaje los días que falten para cubrir las fechas indicadas; devuelve cuántos ha añadido
function extendDays(t,dates){if(!dates.length)return 0;const all=[...t.days.map(d=>d.date),...dates].filter(Boolean).sort(),have=new Set(t.days.map(d=>d.date)),added=datesBetween(all[0],all.at(-1)).filter(x=>!have.has(x)).map(date=>({id:uid("day"),date,name:""}));t.days.push(...added);sortDays(t);added.forEach(d=>d.name=`Día ${t.days.indexOf(d)+1}`);return added.length}
function saveJourney(f,fd,t){const m=syncJourney(f),legs=m.legs.map(l=>({...l,origin:l.origin.trim(),destination:l.destination.trim(),arrDate:l.arrDate||l.depDate}));if(m.kind==="round"&&legs[1]){legs[1].origin||=legs[0].destination;legs[1].destination||=legs[0].origin}
 for(const[i,l]of legs.entries()){if(!l.origin||!l.destination||!l.depDate)return toast(`Completa origen, destino y fecha del tramo ${i+1}`);if(badRange(l.depDate,l.depTime,l.arrDate,l.arrTime))return toast(`Tramo ${i+1}: la llegada es anterior a la salida`)}
 const cash=readMoney(t,fd,m);if(!cash)return;
 const outside=[...new Set(legs.map(l=>l.depDate).filter(dt=>!t.days.some(d=>d.date===dt)))];if(outside.length){if(!confirm(`${outside.map(shortDay).join(", ")} ${outside.length>1?"están":"está"} fuera de las fechas del viaje (${formatTripRange(t.startDate,t.endDate)}).\n\n¿Ampliar el viaje para incluir ${outside.length>1?"esos días":"ese día"}?`))return toast("Trayecto no guardado");extendDays(t,outside)}
 legs.sort((x,y)=>(x.depDate+x.depTime).localeCompare(y.depDate+y.depTime));const jid=m.journeyId||uid("tray"),prev=m.journeyId?t.activities.filter(x=>x.journeyId===m.journeyId):[],keep=new Set(legs.map(l=>l.id).filter(Boolean));
 prev.filter(x=>!keep.has(x.id)).forEach(x=>{t.activities=t.activities.filter(y=>y!==x);unlinkActivity(t,x.id)});
 const acts=legs.map((l,i)=>{const old=l.id&&t.activities.find(x=>x.id===l.id),route=`${l.origin} → ${l.destination}`,same=old&&((old.origin===l.origin&&old.destination===l.destination)||old.location===route),day=t.days.find(d=>d.date===l.depDate),obj={id:old?.id||uid("act"),dayId:day.id,time:l.depTime,endDate:l.arrDate,endTime:l.arrTime,title:same&&old.title?old.title:route,category:"Transporte",transportType:m.ttype,origin:l.origin,destination:l.destination,transportCode:l.code.trim(),location:same?old.location:route,mapQuery:same&&old.mapQuery?old.mapQuery:l.origin,status:m.status,locator:m.locator.trim(),bookingUrl:m.bookingUrl.trim(),currency:cash.currency,participants:cash.participants,estimated:i?0:cash.estimated,spent:i?0:cash.spent,notes:l.notes.trim(),journeyId:jid,completed:old?.completed||false,links:old?.links||[]};if(old){if(!same){delete old.lat;delete old.lng}return Object.assign(old,obj)}t.activities.push({...obj,related:[]});return t.activities.at(-1)});
 const ids=acts.map(a=>a.id);acts.forEach(a=>setRelated(t,a,[...a.related.filter(id=>!ids.includes(id)),...ids.filter(id=>id!==a.id)]));sortActivities(t);finishSave(`Trayecto guardado: ${acts.length} tramo${acts.length>1?"s":""}`)}
function useStayForNight(dayId,stayId){const t=currentTrip(),d=t.days.find(x=>x.id===dayId),s=t.activities.find(x=>x.id===stayId);if(!d||!s)return;const N=d.date,S=dayDate(t,s.dayId),E=s.endDate;
 if(S<=N&&N<E)return toast("Ese alojamiento ya cubre esta noche");
 if(E===N)s.endDate=addDays(N,1);else if(S===addDays(N,1))s.dayId=d.id;else{const c=clone(s);Object.assign(c,{id:uid("acc"),dayId:d.id,endDate:addDays(N,1),estimated:0,spent:0,completed:false,related:[]});delete c.journeyId;t.activities.push(c);setRelated(t,c,[s.id])}
 delete d.lodging;finishSave("Alojamiento asignado")}
function gotoActivity(id){const t=currentTrip(),y=t?.activities.find(a=>a.id===id);if(!y)return;state.modal=null;state.view="horario";state.dayView="plan";state.currentDayId=y.dayId;state.expanded.add(isStay(t,y)?`lodging-${y.dayId}`:y.id);location.hash=tripHash("horario");render();setTimeout(()=>document.querySelector(`[data-activity-id="${y.id}"]`)?.scrollIntoView({block:"center",behavior:"smooth"}),80)}
function openModal(type,extra={}){state.modal={type,...extra};render()}
function finishSave(msg){saveCurrent();state.modal=null;syncCatalog();render();toast(msg)}
function duplicateActivity(id){const a=findActivity(id);if(!a)return;const copy=clone(a);copy.id=uid("act");copy.title+= " (copia)";copy.related=[];delete copy.journeyId;currentTrip().activities.push(copy);sortActivities(currentTrip());saveCurrent();state.modal={type:"day",id:copy.dayId};render();toast("Actividad duplicada")}
function deleteActivity(id){if(!confirm("¿Eliminar actividad?"))return;const t=currentTrip();t.activities=t.activities.filter(a=>a.id!==id);unlinkActivity(t,id);saveCurrent();if(state.modal?.type==="day")render();else{state.modal=null;render()}toast("Actividad eliminada")}
function deleteDay(id){const t=currentTrip();if(t.days.length===1)return toast("El viaje debe tener al menos un día");if(!confirm("¿Eliminar el día y sus actividades?"))return;t.days=t.days.filter(d=>d.id!==id);const removed=t.activities.filter(a=>a.dayId===id).map(a=>a.id);t.activities=t.activities.filter(a=>a.dayId!==id);removed.forEach(r=>unlinkActivity(t,r));sortDays(t);state.currentDayId=t.days[0].id;finishSave("Día eliminado")}
function deleteTraveler(id){const t=currentTrip(),p=t.travelers.find(x=>x.id===id);if(!p||!confirm(`¿Quitar a ${p.name} del viaje?`))return;t.travelers=t.travelers.filter(x=>x.id!==id);t.activities.forEach(a=>{a.participants=(a.participants||[]).filter(x=>x!==id);if(a.participants.length===t.travelers.length)a.participants=[]});finishSave("Persona eliminada")}
function deleteLink(i){if(!confirm("¿Eliminar enlace?"))return;currentTrip().links.splice(i,1);finishSave("Enlace eliminado")}
function restorePublished(){const t=currentTrip(),p=state.published.get(t.id);if(!p||!confirm("¿Restaurar la versión publicada?"))return;localStorage.removeItem(STORAGE_PREFIX+t.id);state.trips.set(t.id,clone(p));state.currentDayId=p.days[0]?.id;state.modal=null;syncCatalog();render();toast("Versión publicada restaurada")}
function deleteTrip(){const t=currentTrip();if(!confirm(`¿Eliminar ${t.name}?`))return;localStorage.removeItem(STORAGE_PREFIX+t.id);localStorage.setItem(CUSTOM_KEY,JSON.stringify(loadJSON(CUSTOM_KEY,[]).filter(id=>id!==t.id)));state.trips.delete(t.id);if(state.published.has(t.id))state.trips.set(t.id,clone(state.published.get(t.id)));syncCatalog();location.hash=""}
