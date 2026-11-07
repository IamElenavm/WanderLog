"use strict";
// WanderLog · model.js — normalización, migraciones y reglas del modelo de datos (modelo 5)
function normalizeTrip(t){
 if(!t||typeof t!=="object")throw Error("Viaje no válido");
 t.schemaVersion=5;if(typeof t.updatedAt!=="string")delete t.updatedAt;t.id||=uid("viaje");t.name||="Viaje";t.destination||="";t.icon||=destinationIcon(t.destination);t.currency=(t.currency||state.settings.defaultCurrency||"EUR").toUpperCase();
 if(!Array.isArray(t.days)||!t.days.length){const dates=[...new Set((t.activities||[]).map(a=>a.date).filter(Boolean))].sort();t.days=dates.map((date,i)=>({id:`day-${i+1}`,date,name:`Día ${i+1}`}));if(!t.days.length&&t.startDate)t.days=[{id:"day-1",date:t.startDate,name:"Día 1"}]}
 t.days.forEach((d,i)=>{d.id||=uid("day");d.name||=`Día ${i+1}`;if(d.weatherPlace)d.weatherPlace=String(d.weatherPlace).trim();if(!d.weatherPlace)delete d.weatherPlace;if(d.lodging!=="home")delete d.lodging});t.days.sort((a,b)=>a.date.localeCompare(b.date));
 t.travelers=(Array.isArray(t.travelers)?t.travelers:[]).map(p=>typeof p==="string"?{name:p}:p).filter(p=>p&&String(p.name||"").trim()).map(p=>({id:p.id||uid("per"),name:String(p.name).trim()}));
 t.timeZone=typeof t.timeZone==="string"&&t.timeZone&&validTZ(t.timeZone)?t.timeZone:"";
 t.rates=Object.fromEntries(Object.entries(t.rates&&typeof t.rates==="object"?t.rates:{}).map(([k,v])=>[String(k).toUpperCase(),+v]).filter(([k,v])=>/^[A-Z]{3}$/.test(k)&&k!=="EUR"&&v>0));
 t.insurances=(Array.isArray(t.insurances)?t.insurances:[]).filter(i=>i&&typeof i==="object").map(i=>({id:i.id||uid("seg"),insurer:String(i.insurer||"Seguro"),policyNumber:String(i.policyNumber||""),phone:String(i.phone||""),startDate:i.startDate||"",endDate:i.endDate||"",documentUrl:String(i.documentUrl||""),notes:String(i.notes||"")}));
 t.packing=(Array.isArray(t.packing)?t.packing:[]).filter(x=>x&&x.text).map(x=>{let c=String(x.category||"Otros");if(c.startsWith("Ropa"))c="Ropa";return{id:x.id||uid("eq"),category:c,text:String(x.text),qty:x.qty===""||x.qty==null?null:Math.max(0,Math.round(+x.qty)||0),notes:String(x.notes||""),done:!!x.done}});
 t.tasks=(Array.isArray(t.tasks)?t.tasks:[]).filter(x=>x&&x.text).map(x=>({id:x.id||uid("tar"),text:String(x.text),done:!!x.done,dueDate:x.dueDate||""}));
 const byDate=Object.fromEntries(t.days.map(d=>[d.date,d.id])),dateOf=Object.fromEntries(t.days.map(d=>[d.id,d.date]));t.activities=Array.isArray(t.activities)?t.activities:[];t.activities.forEach(a=>{a.id||=uid("act");if(!dateOf[a.dayId])a.dayId=byDate[a.date]||t.days[0]?.id});
 migrateBookings(t,dateOf);splitReturnTrips(t,dateOf);
 const ids=new Set(t.activities.map(a=>a.id)),ctx={currency:t.currency,people:new Set(t.travelers.map(p=>p.id))};t.activities.forEach(a=>normalizeActivity(a,dateOf,ids,ctx));
 const byId=new Map(t.activities.map(a=>[a.id,a]));t.activities.forEach(a=>a.related.forEach(id=>{const b=byId.get(id);if(b&&!b.related.includes(a.id))b.related.push(a.id)}));t.days.forEach(d=>delete d.accommodationId);
 if(!t.practical||Array.isArray(t.practical)){const old=Array.isArray(t.practical)?t.practical:(t.info?.practical||[]);t.practical=Object.fromEntries(PRACTICAL.map((k,i)=>[k,old[i]||""]))}PRACTICAL.forEach(k=>t.practical[k]??="");
 t.links=Array.isArray(t.links)?t.links:Array.isArray(t.info?.links)?t.info.links:[];delete t.info;delete t.coverImage;delete t.summary;delete t.notes;
 t.startDate=t.days[0]?.date||t.startDate;t.endDate=t.days.at(-1)?.date||t.endDate;sortActivities(t);return t;
}
function migrateBookings(t,dateOf){
 const accs=Array.isArray(t.accommodations)?t.accommodations:(t.info?.accommodation||[]).map((a,i)=>({id:`acc-${i+1}`,name:a.name||"Alojamiento",address:a.detail||"",dayIds:t.days.map(d=>d.id),status:a.status,mapUrl:a.mapQuery?mapSearch(a.mapQuery):""}));
 const ress=Array.isArray(t.reservations)?t.reservations:(t.info?.transport||[]).map((r,i)=>({id:`res-${i+1}`,name:r.name||"Reserva",category:"Transporte",dayId:t.days[0]?.id,time:"",status:r.status,location:r.detail||"",mapUrl:r.mapQuery?mapSearch(r.mapQuery):""}));
 accs.forEach(a=>{const ids=(Array.isArray(a.dayIds)?a.dayIds:[]).filter(id=>dateOf[id]).sort((x,y)=>dateOf[x].localeCompare(dateOf[y])),first=ids[0]||t.days[0]?.id,last=dateOf[ids.at(-1)]||dateOf[first],s={id:a.id||uid("acc"),dayId:first,time:a.checkInTime||"15:00",endDate:a.checkOutDate||addDays(last,1),endTime:a.checkOutTime||"11:00",title:a.name||"Alojamiento",category:"Alojamiento",location:a.address||"",mapQuery:a.address||a.mapUrl||"",status:a.status,completed:false,notes:a.notes||"",links:a.mapUrl&&a.address?[{label:"Mapa",url:a.mapUrl}]:[],estimated:a.estimated,spent:a.spent,_res:a.reservationId||null};if(a.lat!=null&&a.lng!=null){s.lat=a.lat;s.lng=a.lng}t.activities.push(s)});
 const primaries=new Set();
 ress.forEach(r=>{const linked=t.activities.filter(a=>a.reservationId===r.id||a._res===r.id);let p=(r.category==="Alojamiento"&&linked.find(a=>a._res===r.id))||t.activities.find(a=>r.activityId&&a.id===r.activityId)||linked.find(a=>!a._res)||linked[0];if(!p){p={id:r.id||uid("act"),dayId:dateOf[r.dayId]?r.dayId:t.days[0]?.id,time:r.time||"",endDate:r.endDate||"",endTime:r.endTime||"",title:r.name||"Reserva",category:r.category,location:r.location||"",mapQuery:r.location||r.mapUrl||"",status:r.status,completed:false,notes:r.notes||"",links:[]};t.activities.push(p)}mergeBooking(p,r,primaries.has(p.id));primaries.add(p.id);linked.forEach(a=>{if(a!==p)a._link||=p.id})});
 // En el modelo 2 el importe de las actividades vinculadas lo cubría la reserva: se pasa a notas para no contarlo dos veces
 t.activities.forEach(a=>{if(a._link&&!primaries.has(a.id)){a.related=[...(Array.isArray(a.related)?a.related:[]),a._link];if(+a.estimated||+a.spent){const p=t.activities.find(x=>x.id===a._link);a.notes=[a.notes,`Importe incluido en «${p?.title||"la reserva"}»: ${+a.estimated||0} estimado, ${+a.spent||0} gastado.`].filter(Boolean).join("\n\n");a.estimated=0;a.spent=0}}delete a._link;delete a._res;delete a.reservationId});delete t.accommodations;delete t.reservations;
}
function mergeBooking(p,r,again){
 const same=(x,y)=>String(x||"").trim().toLowerCase()===String(y||"").trim().toLowerCase(),extra=[];p.links=Array.isArray(p.links)?p.links:[];const hasUrl=u=>p.links.some(l=>l.url===u);
 if(STATUSES.includes(r.status))p.status=r.status;p.estimated=(again?+p.estimated||0:0)+(+r.estimated||0);p.spent=(again?+p.spent||0:0)+(+r.spent||0);
 if(r.locator&&!String(p.locator||"").includes(r.locator))p.locator=[p.locator,r.locator].filter(Boolean).join(" · ");
 if(r.bookingUrl){if(isDriveUrl(r.bookingUrl)&&!p.bookingUrl)p.bookingUrl=r.bookingUrl;else if(!hasUrl(r.bookingUrl))p.links.push({label:"Reserva",url:r.bookingUrl})}
 if(r.location){if(!p.location)p.location=r.location;else if(!same(r.location,p.location))extra.push(`Ubicación: ${r.location}`)}
 if(r.mapUrl){const q=stripMapUrl(r.mapUrl);if(!p.mapQuery&&!p.location)p.mapQuery=r.mapUrl;else if(![p.mapQuery,p.location,r.location].some(x=>same(stripMapUrl(x),q))&&!hasUrl(r.mapUrl))p.links.push({label:"Mapa de la reserva",url:r.mapUrl})}
 if(r.notes&&!same(r.notes,p.notes)&&!same(r.notes,p.location)&&!same(r.notes,r.location))extra.unshift(r.notes);
 if(extra.length){const label=r.name&&!same(r.name,p.title)?`Reserva «${r.name}»`:"Reserva";p.notes=[p.notes,`${label}: ${extra.join("\n")}`].filter(Boolean).join("\n\n")}
 if(!p.time&&r.time){p.time=r.time;if(r.dayId)p.dayId=r.dayId}if(!p.endTime&&r.endTime){p.endTime=r.endTime;if(r.endDate)p.endDate=r.endDate}
}
// Modelo 3/4 → 5: cada vuelta (returnTrip) pasa a ser una actividad propia, relacionada con la ida y del mismo trayecto
function splitReturnTrips(t,dateOf){const used=new Set(t.activities.map(a=>a.id)),add=[];t.activities.forEach(a=>{const r=a.returnTrip;delete a.returnTrip;if(!r||typeof r!=="object"||!dateOf[r.dayId])return;let id=`${a.id}-vuelta`,n=2;while(used.has(id))id=`${a.id}-vuelta-${n++}`;used.add(id);const own=!!(r.location||r.mapQuery),base=String(a.title||"").replace(/^Ida · /,"");a.journeyId||=a.id;const v={id,dayId:r.dayId,time:r.time||"",endDate:r.endDate||"",endTime:r.endTime||"",title:`Vuelta · ${base}`,category:a.category,transportType:a.transportType,location:own?r.location:a.location,mapQuery:own?r.mapQuery:a.mapQuery,status:a.status,completed:!!r.completed,notes:r.notes||"",locator:a.locator||"",bookingUrl:a.bookingUrl||"",links:[],estimated:0,spent:0,currency:a.currency,participants:a.participants,related:[a.id],journeyId:a.journeyId};const lat=own?r.lat:a.lat,lng=own?r.lng:a.lng;if(lat!=null&&lng!=null){v.lat=lat;v.lng=lng}a.title=`Ida · ${base}`;a.related=[...(Array.isArray(a.related)?a.related:[]),id];add.push(v)});t.activities.push(...add)}
function guessTransport(a){const tests=[["Taxi",/taxi/],["Avión",/vuelo|avión|avion|flight/],["Ferry",/ferr|barco/],["Tren",/tren\b|train/],["Metro",/metro\b/],["Autobús",/autob|\bbus\b|tour/],["Coche",/coche|alquiler de coche/],["A pie",/a pie|caminando/]];for(const f of [a.title,a.location,a.notes]){const s=String(f||"").toLowerCase();for(const[k,re]of tests)if(re.test(s))return k}return"Otro"}
function normalizeActivity(a,dateOf,ids,ctx={currency:"EUR",people:new Set()}){
 a.currency=/^[A-Z]{3}$/.test(String(a.currency||"").toUpperCase())?String(a.currency).toUpperCase():ctx.currency||"EUR";a.participants=Array.isArray(a.participants)?a.participants.filter(id=>ctx.people.has(id)):[];if(a.participants.length===ctx.people.size)a.participants=[];
 a.category=CATEGORIES[a.category]?a.category:"Otro";a.status=STATUSES.includes(a.status)?a.status:"Pendiente";a.time=a.time||"";a.endTime=a.endTime||"";
 const start=dateOf[a.dayId]||"";a.endDate=a.endDate&&a.endDate>=start?a.endDate:start;
 ["title","location","mapQuery","notes","locator","bookingUrl"].forEach(k=>a[k]=String(a[k]??""));a.title||="Actividad";
 a.links=Array.isArray(a.links)?a.links:[];a.estimated=+a.estimated||0;a.spent=+a.spent||0;a.completed=!!a.completed;
 a.related=[...new Set([...(Array.isArray(a.related)?a.related:[]),...(a.linkedTo?[a.linkedTo]:[])])].filter(id=>id!==a.id&&ids.has(id));
 if(a.category==="Transporte"){a.transportType=TRANSPORT_TYPES[a.transportType]?a.transportType:guessTransport(a);["origin","destination","transportCode"].forEach(k=>a[k]=String(a[k]??""))}else["transportType","origin","destination","transportCode"].forEach(k=>delete a[k]);
 if(a.journeyId)a.journeyId=String(a.journeyId);else delete a.journeyId;
 delete a.date;delete a.image;delete a.reservationId;delete a.linkedTo;delete a.returnTrip;
}
function dayDate(t,dayId){return t.days.find(d=>d.id===dayId)?.date||""}
function isStay(t,a){return a.category==="Alojamiento"&&!!a.endDate&&a.endDate>dayDate(t,a.dayId)}
function stays(t){return t.activities.filter(a=>isStay(t,a))}
function stayForDay(t,d){return stays(t).filter(a=>dayDate(t,a.dayId)<=d.date&&d.date<a.endDate).sort((x,y)=>(dayDate(t,y.dayId)+y.time).localeCompare(dayDate(t,x.dayId)+x.time))[0]||null}
function isHomeNight(t,d){return d.lodging==="home"&&!stayForDay(t,d)}
function isBooking(a){return BOOKING_STATUSES.includes(a.status)}
function legView(t,a){return{key:a.id,date:dayDate(t,a.dayId),time:a.time,endDate:a.endDate,endTime:a.endTime,notes:a.notes,location:a.location,mapQuery:a.mapQuery,lat:a.lat,lng:a.lng,completed:a.completed}}
function dayEntries(t,d){return t.activities.filter(a=>!isStay(t,a)&&a.dayId===d.id).map(a=>({a,v:legView(t,a)})).sort((x,y)=>String(x.v.time||"99:99").localeCompare(String(y.v.time||"99:99")))}
function actIcon(a){return a.category==="Transporte"&&TRANSPORT_TYPES[a.transportType]?TRANSPORT_TYPES[a.transportType]:CATEGORIES[a.category]?.icon||"📍"}
function relatedOf(t,a){return(a.related||[]).map(id=>t.activities.find(x=>x.id===id)).filter(Boolean)}
function journeyLegs(t,a){return a?.journeyId?t.activities.filter(x=>x.journeyId===a.journeyId).sort((x,y)=>(dayDate(t,x.dayId)+x.time).localeCompare(dayDate(t,y.dayId)+y.time)):[]}
function setRelated(t,a,ids){const want=new Set(ids.filter(id=>id!==a.id&&t.activities.some(x=>x.id===id)));t.activities.forEach(x=>{if(x===a)return;const has=x.related.includes(a.id);if(want.has(x.id)&&!has)x.related.push(a.id);if(!want.has(x.id)&&has)x.related=x.related.filter(id=>id!==a.id)});a.related=[...want]}
function unlinkActivity(t,id){t.activities.forEach(x=>{x.related=(x.related||[]).filter(r=>r!==id)})}
function packingTemplate(t){const days=Math.max(1,t.days.length);return PACKING_TEMPLATE.map(([category,text,qty,notes])=>({id:uid("eq"),category,text,qty:qty==="d"?days:qty,notes:notes||"",done:false}))}
// ---- Modelo 4: personas, dinero, alojamiento activo ----
function validTZ(z){try{new Intl.DateTimeFormat("es-ES",{timeZone:z});return true}catch{return false}}
function travelerNames(t){return t.travelers.map(p=>p.name)}
function peopleLabel(t){const n=t.travelers.length;return!n?"":n<=3?travelerNames(t).join(", "):`${n} personas`}
function toEUR(t,v,cur){cur=cur||t.currency||"EUR";v=+v||0;if(cur==="EUR")return v;const r=t.rates?.[cur];return r?v*r:null}
function amount(t,a,v){const cur=a.currency||t.currency||"EUR";if(cur==="EUR")return money(v,"EUR");const e=toEUR(t,v,cur);return`${money(v,cur)} <small class="muted">${e==null?"(sin tipo de cambio)":"≈ "+money(e,"EUR")}</small>`}
function departingStay(t,d){const night=stayForDay(t,d);return stays(t).filter(a=>a.endDate===d.date&&a!==night).sort((x,y)=>(y.endTime||"").localeCompare(x.endTime||""))[0]||null}
function activeStay(t,d,time){const dep=departingStay(t,d),night=stayForDay(t,d);if(dep&&time&&time<(dep.endTime||"12:00"))return dep;return night||(dep&&!time?dep:null)}
function shownStay(t,d){const dep=departingStay(t,d),night=stayForDay(t,d);if(dep&&night)return(state.stayChoice[d.id]??1)===0?dep:night;return night}
function budget(t){const out={estimated:0,spent:0,byCategory:{},byDay:{},byPerson:{},missing:[]},miss=new Set(),people=(t.travelers||[]).map(p=>p.id);Object.keys(CATEGORIES).forEach(c=>out.byCategory[c]={estimated:0,spent:0});t.days.forEach(d=>out.byDay[d.id]={estimated:0,spent:0});people.forEach(id=>out.byPerson[id]={estimated:0,spent:0});
 t.activities.forEach(a=>{const cur=a.currency||t.currency||"EUR",e=toEUR(t,a.estimated,cur),s=toEUR(t,a.spent,cur);if(e==null||s==null){if(+a.estimated||+a.spent)miss.add(cur);return}out.estimated+=e;out.spent+=s;const c=out.byCategory[a.category]||out.byCategory.Otro;c.estimated+=e;c.spent+=s;if(out.byDay[a.dayId]){out.byDay[a.dayId].estimated+=e;out.byDay[a.dayId].spent+=s}const who=(a.participants?.length?a.participants:people).filter(id=>out.byPerson[id]);who.forEach(id=>{out.byPerson[id].estimated+=e/who.length;out.byPerson[id].spent+=s/who.length})});
 out.missing=[...miss];return out}
function saveCurrent(){const t=currentTrip();t.updatedAt=new Date().toISOString();sortDays(t);sortActivities(t);saveTrip(t);syncCatalog()}function saveTrip(t){try{localStorage.setItem(STORAGE_PREFIX+t.id,JSON.stringify(t))}catch{toast("No se pudo guardar")}}function addCustomId(id){const a=loadJSON(CUSTOM_KEY,[]);if(!a.includes(id)){a.push(id);localStorage.setItem(CUSTOM_KEY,JSON.stringify(a))}}
function sortDays(t){t.days.sort((a,b)=>a.date.localeCompare(b.date));t.startDate=t.days[0]?.date;t.endDate=t.days.at(-1)?.date}function sortActivities(t){const order=Object.fromEntries(t.days.map((d,i)=>[d.id,i]));t.activities.sort((a,b)=>(order[a.dayId]??999)-(order[b.dayId]??999)||String(a.time||"99:99").localeCompare(String(b.time||"99:99")))}
