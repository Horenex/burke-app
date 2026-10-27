/* BURKE APP · conexión directa con la hoja de Google (Sheets API) + inicio de sesión con Google.
   Misma estructura de pestañas y columnas que el servidor de Apps Script. */
(function(){
const CFG = window.BURKE_CFG; // {clientId, sheetId}
const SCOPE = "https://www.googleapis.com/auth/spreadsheets email";
const API = "https://sheets.googleapis.com/v4/spreadsheets/" + CFG.sheetId;
const LS = { tok:"burke-tok", email:"burke-email", q:"burke-q", silent:"burke-silent" };
const ls = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }, del(k){ try{ localStorage.removeItem(k); }catch(e){} } };
const ss = { get(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} }, del(k){ try{ sessionStorage.removeItem(k); }catch(e){} } };

// Tipos: "" texto · "n" número · "b" sí/no · "j" JSON
const ENT = () => [["id","ID"],["nombre","Nombre"],["tipo","Tipo"],["cif","CIF / NIF"],["tel","Teléfono"],["email","Correo"],["direccion","Dirección"],
  ["web","Web"],["zona","Zona"],["comision","Comisión"],["suministra","Qué suministra"],["pago","Condiciones de pago"],["notas","Notas"],["contactos","Contactos (JSON)","j"]];
const SCHEMA = {
  personal:{tab:"Personal", cols:[["id","ID"],["nombre","Nombre"],["rol","Qué hace"],["tel","Teléfono"],["email","Correo"],["zona","Dónde vive"],
    ["tallas","Tallas"],["autonomo","Autónomo","b"],["coche","Coche propio","b"],["modo","Cobra (cache/hora)"],["imp","Importe €","n"],
    ["ss","En nómina","b"],["notas","Notas"],["foto","Foto (no tocar)"]]},
  clientes:{tab:"Clientes", cols:ENT()}, agentes:{tab:"Agentes", cols:ENT()}, proveedores:{tab:"Proveedores", cols:ENT()},
  eventos:{tab:"Eventos", cols:[["id","ID"],["fecha","Fecha"],["nombre","Evento"],["ini","Empieza"],["fin","Termina"],["lugar","Lugar"],
    ["cliente","Cliente"],["agente","Agente"],["precio","Precio calculado €","n"],["coste","Nos cuesta €","n"],["limpio","Queda limpio €","n"],
    ["objetivo","Beneficio objetivo","n"],["oferta","Oferta del cliente €","n"],["equipo","Equipo (JSON)","j"],["gastos","Gastos (JSON)","j"],["amort","Amortización (JSON)","j"],
    ["clienteId","ID cliente"],["contactoId","ID contacto"],["agenteId","ID agente"],["agenteCtId","ID contacto agente"]]},
  largos:{tab:"Eventos largos", cols:[["id","ID"],["ini","Desde"],["fin","Hasta"],["nombre","Evento"],["lugar","Lugar"],["cliente","Cliente"],["agente","Agente"],["notas","Notas"],
    ["acts","Programa (JSON)","j"],["clienteId","ID cliente"],["contactoId","ID contacto"],["agenteId","ID agente"],["agenteCtId","ID contacto agente"]]}
};
const CONFIG_TAB = "Config";
const q = t => "'" + t.replace(/'/g,"''") + "'";
const colL = n => { let s=""; n++; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; };
const pad = n => String(n).padStart(2,"0");

/* ---------- celdas ---------- */
function toCell(c,v){
  if(v===undefined || v===null) return "";
  if(c[2]==="j") return JSON.stringify(v);
  if(c[2]==="b") return v ? "Sí" : "No";
  if(c[2]==="n") return v==="" ? "" : Number(v);
  return String(v);
}
function serialToDate(n){ const d=new Date(Math.round((n-25569)*864e5)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`; }
function serialToTime(n){ const m=Math.round((n%1)*1440); return `${pad(Math.floor(m/60)%24)}:${pad(m%60)}`; }
function fromCell(c,v,coll){
  const empty = v===undefined || v===null || v==="";
  if(c[2]==="j"){ const def = c[0]==="amort" ? {} : []; if(empty) return def; try{ return JSON.parse(v); }catch(e){ return def; } }
  if(c[2]==="b") return String(v??"").trim().toLowerCase().startsWith("s") || v===true;
  if(c[2]==="n") return empty ? (c[0]==="oferta" ? null : 0) : Number(v);
  if(typeof v==="number"){
    if(c[0]==="fecha" || (coll==="largos" && (c[0]==="ini"||c[0]==="fin"))) return serialToDate(v);
    if(c[0]==="ini" || c[0]==="fin") return serialToTime(v);
  }
  return empty ? "" : String(v);
}

/* ---------- inicio de sesión ---------- */
let TOKEN = null;
function readToken(){ try{ const t=JSON.parse(ls.get(LS.tok)||"null"); if(t && t.exp > Date.now()+60000) return t.t; }catch(e){} return null; }
function authUrl(silent){
  const p = new URLSearchParams({ client_id:CFG.clientId, redirect_uri:location.origin+location.pathname, response_type:"token", scope:SCOPE,
    include_granted_scopes:"true", state:silent?"s":"i" });
  const em = ls.get(LS.email); if(em) p.set("login_hint", em);
  if(silent) p.set("prompt","none");
  return "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
}
function login(silent){ if(silent) ss.set(LS.silent,"1"); location.assign(authUrl(silent)); }
function handleRedirect(){
  const h = location.hash.slice(1); if(!h) return;
  const p = new URLSearchParams(h);
  if(p.get("access_token")){
    ls.set(LS.tok, JSON.stringify({t:p.get("access_token"), exp:Date.now()+(+p.get("expires_in")||3600)*1000}));
    ss.del(LS.silent); history.replaceState(null,"",location.pathname+location.search);
  } else if(p.get("error")){
    history.replaceState(null,"",location.pathname+location.search);
    if(p.get("state")!=="s") showLogin("No se ha podido entrar con Google. Inténtalo otra vez.");
  }
}
function showLogin(msg){
  if(document.getElementById("burkeLogin")) return;
  const d=document.createElement("div"); d.id="burkeLogin"; d.className="loginwrap";
  d.innerHTML = `<div class="loginbox"><h2>BURKE APP</h2><p>${msg||"Entra con tu cuenta de Google para ver y guardar los datos de la compañía."}</p>
  <button class="btn pri block" id="burkeLoginBtn">Entrar con Google</button></div>`;
  document.body.appendChild(d);
  document.getElementById("burkeLoginBtn").addEventListener("click", ()=>login(false));
}
async function fetchEmail(){
  try{ const r=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+TOKEN}}); if(r.ok){ const j=await r.json(); if(j.email) ls.set(LS.email,j.email); } }catch(e){}
}
// Devuelve true si ya hay sesión; si no, redirige (silencioso) o muestra el botón de entrar.
function ensureAuth(){
  TOKEN = readToken(); if(TOKEN) return true;
  if(ls.get(LS.email) && !ss.get(LS.silent)) { login(true); return false; }
  showLogin(); return false;
}

/* ---------- llamadas a la API ---------- */
class AuthError extends Error {}
async function api(path, opt={}){
  TOKEN = readToken(); if(!TOKEN) throw new AuthError("sin sesión");
  const r = await fetch(API+path, {...opt, headers:{Authorization:"Bearer "+TOKEN, "Content-Type":"application/json", ...(opt.headers||{})}});
  if(r.status===401){ ls.del(LS.tok); throw new AuthError("sesión caducada"); }
  if(r.status===403){ const t=await r.text(); throw Object.assign(new Error("Sin permiso para la hoja"), {code:"forbidden", detail:t}); }
  if(!r.ok) throw new Error("Error "+r.status+": "+(await r.text()).slice(0,200));
  return r.status===204 ? null : r.json();
}
let META=null;
async function meta(force){
  if(META && !force) return META;
  const j = await api("?fields=sheets.properties(sheetId,title)");
  META = {}; j.sheets.forEach(s=>META[s.properties.title]=s.properties.sheetId); return META;
}
async function ensureTabs(){
  const m = await meta();
  const req=[], heads=[];
  Object.values(SCHEMA).forEach(d=>{ if(m[d.tab]===undefined){ req.push({addSheet:{properties:{title:d.tab, gridProperties:{frozenRowCount:1}}}}); heads.push({range:q(d.tab)+"!A1", values:[d.cols.map(c=>c[1])]}); } });
  if(m[CONFIG_TAB]===undefined){ req.push({addSheet:{properties:{title:CONFIG_TAB}}}); heads.push({range:q(CONFIG_TAB)+"!A1", values:[["Clave","Valor (JSON)"]]}); }
  if(!req.length) return;
  await api(":batchUpdate",{method:"POST", body:JSON.stringify({requests:req})});
  await api("/values:batchUpdate",{method:"POST", body:JSON.stringify({valueInputOption:"RAW", data:heads})});
  await meta(true);
}
// Mapa columna→posición según la fila de cabecera (por si alguien reordena columnas en la hoja)
function colIndex(def, header){
  const idx = {}; def.cols.forEach((c,i)=>{ const k=(header||[]).indexOf(c[1]); idx[c[0]] = k>=0 ? k : i; });
  return idx;
}

async function getAll(){
  await ensureTabs();
  const colls = Object.keys(SCHEMA);
  const ranges = colls.map(k=>q(SCHEMA[k].tab)+"!A1:AZ").concat([q(CONFIG_TAB)+"!A2:B"]);
  const j = await api("/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&"+ranges.map(r=>"ranges="+encodeURIComponent(r)).join("&"));
  const out = {};
  colls.forEach((k,i)=>{
    const def=SCHEMA[k], rows=(j.valueRanges[i].values||[]), idx=colIndex(def, rows[0]);
    out[k] = rows.slice(1).filter(r=>String(r[idx.id]??"").trim()).map(r=>{ const o={}; def.cols.forEach(c=>{ o[c[0]]=fromCell(c, r[idx[c[0]]], k); }); return o; });
  });
  const cfg={}; (j.valueRanges[colls.length].values||[]).forEach(r=>{ if(r[0]){ try{ cfg[r[0]]=JSON.parse(r[1]); }catch(e){} } });
  out.config = cfg;
  return out;
}
async function findRow(tab){
  const j = await api("/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&ranges="+encodeURIComponent(q(tab)+"!1:1")+"&ranges="+encodeURIComponent(q(tab)+"!A:A"));
  return { header:(j.valueRanges[0].values||[[]])[0], ids:(j.valueRanges[1].values||[]).map(r=>String(r[0]??"")) };
}
async function doPut(coll,obj){
  const def=SCHEMA[coll]; if(!def) throw new Error("Colección desconocida: "+coll);
  await ensureTabs();
  const {header, ids} = await findRow(def.tab), idx=colIndex(def, header);
  const width = Math.max(def.cols.length, ...Object.values(idx).map(n=>n+1));
  const row = Array(width).fill("");
  def.cols.forEach(c=>{ const v=toCell(c,obj[c[0]]); if(typeof v==="string" && v.length>49000) throw new Error("Un dato es demasiado largo para la hoja ("+c[1]+")"); row[idx[c[0]]]=v; });
  const at = ids.indexOf(String(obj.id));
  if(at>0){ await api("/values/"+encodeURIComponent(q(def.tab)+"!A"+(at+1)+":"+colL(width-1)+(at+1))+"?valueInputOption=RAW",{method:"PUT", body:JSON.stringify({values:[row]})}); }
  else { await api("/values/"+encodeURIComponent(q(def.tab)+"!A1")+":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",{method:"POST", body:JSON.stringify({values:[row]})}); }
}
async function doDrop(coll,id){
  const def=SCHEMA[coll]; const m=await meta(); const {ids}=await findRow(def.tab); const at=ids.indexOf(String(id));
  if(at<=0) return;
  await api(":batchUpdate",{method:"POST", body:JSON.stringify({requests:[{deleteDimension:{range:{sheetId:m[def.tab], dimension:"ROWS", startIndex:at, endIndex:at+1}}}]})});
}
async function doPutConfig(cfg){
  await ensureTabs();
  const j = await api("/values/"+encodeURIComponent(q(CONFIG_TAB)+"!A:A")+"?valueRenderOption=UNFORMATTED_VALUE");
  const keys=(j.values||[]).map(r=>String(r[0]??""));
  for(const k of Object.keys(cfg)){
    const val=JSON.stringify(cfg[k]), at=keys.indexOf(k);
    if(at>0) await api("/values/"+encodeURIComponent(q(CONFIG_TAB)+"!B"+(at+1))+"?valueInputOption=RAW",{method:"PUT", body:JSON.stringify({values:[[val]]})});
    else { await api("/values/"+encodeURIComponent(q(CONFIG_TAB)+"!A1")+":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",{method:"POST", body:JSON.stringify({values:[[k,val]]})}); keys.push(k); }
  }
}

/* ---------- cola de cambios: nada se pierde si caduca la sesión o no hay conexión ---------- */
const readQ = () => { try{ return JSON.parse(ls.get(LS.q)||"[]"); }catch(e){ return []; } };
const writeQ = a => ls.set(LS.q, JSON.stringify(a));
let flushing = null;
function enqueue(op){ const a=readQ(); a.push(op); writeQ(a); return flush(); }
function flush(){
  if(flushing) return flushing.then(()=>readQ().length ? flush() : undefined);
  flushing = (async()=>{
    let a=readQ();
    while(a.length){
      const op=a[0];
      try{
        if(op.fn==="put") await doPut(op.coll, op.obj);
        else if(op.fn==="drop") await doDrop(op.coll, op.id);
        else if(op.fn==="putConfig") await doPutConfig(op.cfg);
      }catch(e){
        // Sin sesión o sin conexión: se queda en la cola y se reintenta. Cualquier otro error: se descarta para no bloquear la cola.
        if(!(e instanceof AuthError) && !(e instanceof TypeError) && !/Error (429|5\d\d)/.test(e.message)){ a=readQ(); a.shift(); writeQ(a); }
        throw e;
      }
      a=readQ(); a.shift(); writeQ(a);
    }
  })().catch(e=>{
    if(e instanceof AuthError){ login(true); return new Promise(()=>{}); } // vuelve tras renovar la sesión y se reintenta
    throw e;
  }).finally(()=>{ flushing=null; });
  return flushing;
}

window.SHEETS = {
  pending: () => readQ().length,
  async start(){
    handleRedirect();
    if(!ensureAuth()) return new Promise(()=>{}); // esperando a Google
    if(!ls.get(LS.email)) fetchEmail();
    window.addEventListener("online", ()=>{ flush().catch(()=>{}); });
    if(readQ().length){ try{ await flush(); }catch(e){} }
    return true;
  },
  async getAll(){
    try{ return await getAll(); }
    catch(e){ if(e instanceof AuthError){ login(true); return new Promise(()=>{}); } throw e; }
  },
  put:(coll,obj)=>enqueue({fn:"put", coll, obj}),
  drop:(coll,id)=>enqueue({fn:"drop", coll, id}),
  putConfig:(cfg)=>enqueue({fn:"putConfig", cfg}),
  email:()=>ls.get(LS.email),
  logout(){ ls.del(LS.tok); ls.del(LS.email); location.reload(); }
};
})();
