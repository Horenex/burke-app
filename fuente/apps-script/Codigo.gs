/**
 * BURKE APP · servidor (Google Apps Script)
 * Lee y escribe los datos de la app en esta hoja de cálculo.
 * Cada pestaña es una colección; cada fila, un registro.
 * Las columnas marcadas como "JSON" guardan listas (equipo, gastos, contactos...).
 */

// Tipos: "" texto · "n" número · "b" sí/no · "j" JSON
const SCHEMA = {
  personal: { tab: "Personal", cols: [
    ["id","ID"],["nombre","Nombre"],["rol","Qué hace"],["tel","Teléfono"],["email","Correo"],["zona","Dónde vive"],
    ["tallas","Tallas"],["autonomo","Autónomo","b"],["coche","Coche propio","b"],["modo","Cobra (cache/hora)"],["imp","Importe €","n"],
    ["ss","En nómina","b"],["notas","Notas"],["foto","Foto (no tocar)"]
  ]},
  clientes: { tab: "Clientes", cols: ENT_COLS_() },
  agentes: { tab: "Agentes", cols: ENT_COLS_() },
  proveedores: { tab: "Proveedores", cols: ENT_COLS_() },
  eventos: { tab: "Eventos", cols: [
    ["id","ID"],["fecha","Fecha"],["nombre","Evento"],["ini","Empieza"],["fin","Termina"],["lugar","Lugar"],
    ["cliente","Cliente"],["agente","Agente"],["precio","Precio calculado €","n"],["coste","Nos cuesta €","n"],["limpio","Queda limpio €","n"],
    ["objetivo","Beneficio objetivo","n"],["oferta","Oferta del cliente €","n"],
    ["equipo","Equipo (JSON)","j"],["gastos","Gastos (JSON)","j"],["amort","Amortización (JSON)","j"],
    ["clienteId","ID cliente"],["contactoId","ID contacto"],["agenteId","ID agente"],["agenteCtId","ID contacto agente"]
  ]},
  largos: { tab: "Eventos largos", cols: [
    ["id","ID"],["ini","Desde"],["fin","Hasta"],["nombre","Evento"],["lugar","Lugar"],["cliente","Cliente"],["agente","Agente"],["notas","Notas"],
    ["acts","Programa (JSON)","j"],["clienteId","ID cliente"],["contactoId","ID contacto"],["agenteId","ID agente"],["agenteCtId","ID contacto agente"]
  ]}
};
function ENT_COLS_(){
  return [["id","ID"],["nombre","Nombre"],["tipo","Tipo"],["cif","CIF / NIF"],["tel","Teléfono"],["email","Correo"],["direccion","Dirección"],
    ["web","Web"],["zona","Zona"],["comision","Comisión"],["suministra","Qué suministra"],["pago","Condiciones de pago"],["notas","Notas"],
    ["contactos","Contactos (JSON)","j"]];
}
const CONFIG_TAB = "Config";
// Hoja «BURKE APP · Datos» en el Drive de Javi
const SHEET_ID = "1BuzB5NSxyXO5I0zwgWKXuiTqHotFLrr2973Uq2cJuDk";

/** Abre la app. */
function doGet(){
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Burke App")
    .addMetaTag("viewport","width=device-width, initial-scale=1, viewport-fit=cover");
}

/** Ejecútala una vez desde el editor para crear las pestañas y dar permisos. */
function prepararHoja(){
  Object.keys(SCHEMA).forEach(sheet_);
  configSheet_();
  return "Hoja preparada";
}

function sheet_(coll){
  const def = SCHEMA[coll]; if(!def) throw new Error("Colección desconocida: " + coll);
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(def.tab);
  if(!sh){
    sh = ss.insertSheet(def.tab);
    sh.getRange(1,1,1,def.cols.length).setValues([def.cols.map(c=>c[1])]).setFontWeight("bold").setBackground("#E3E6FF");
    sh.setFrozenRows(1);
    def.cols.forEach((c,i)=>{ sh.getRange(2,i+1,sh.getMaxRows()-1,1).setNumberFormat(c[2]==="n" ? "0.##" : "@"); });
    if(def.cols.some(c=>c[0]==="foto")) sh.setColumnWidth(def.cols.findIndex(c=>c[0]==="foto")+1, 80);
  }
  return sh;
}

function configSheet_(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(CONFIG_TAB);
  if(!sh){ sh = ss.insertSheet(CONFIG_TAB); sh.getRange(1,1,1,2).setValues([["Clave","Valor (JSON)"]]).setFontWeight("bold"); sh.getRange("A:B").setNumberFormat("@"); }
  return sh;
}

function toCell_(c, v){
  if(v === undefined || v === null) return "";
  if(c[2]==="j") return JSON.stringify(v);
  if(c[2]==="b") return v ? "Sí" : "No";
  if(c[2]==="n") return v === "" ? "" : Number(v);
  return String(v);
}
function fromCell_(c, v){
  if(c[2]==="j"){ if(v==="" || v===null) return c[0]==="amort" ? {} : []; try{ return JSON.parse(v); }catch(e){ return c[0]==="amort" ? {} : []; } }
  if(c[2]==="b") return String(v).trim().toLowerCase().startsWith("s");
  if(c[2]==="n") return v === "" ? (c[0]==="oferta" ? null : 0) : Number(v);
  if(v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), c[0]==="ini"||c[0]==="fin" ? (String(v).length>10?"HH:mm":"yyyy-MM-dd") : "yyyy-MM-dd");
  return String(v);
}

function readAll_(coll){
  const def = SCHEMA[coll], sh = sheet_(coll), n = sh.getLastRow();
  if(n < 2) return [];
  return sh.getRange(2,1,n-1,def.cols.length).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => { const o = {}; def.cols.forEach((c,i)=>{ o[c[0]] = fromCell_(c, r[i]); }); return o; });
}

/** Todo lo que la app necesita al abrirse. */
function getAll(){
  const out = {};
  Object.keys(SCHEMA).forEach(k => out[k] = readAll_(k));
  const cfg = {}; const sh = configSheet_(), n = sh.getLastRow();
  if(n >= 2) sh.getRange(2,1,n-1,2).getValues().forEach(r => { if(r[0]) { try{ cfg[r[0]] = JSON.parse(r[1]); }catch(e){} } });
  out.config = cfg;
  return out;
}

/** Crea o actualiza un registro (por su ID). */
function put(coll, obj){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const def = SCHEMA[coll], sh = sheet_(coll);
    const row = def.cols.map(c => toCell_(c, obj[c[0]]));
    row.forEach((v,i)=>{ if(typeof v === "string" && v.length > 49000) throw new Error("Un dato es demasiado largo para la hoja (" + def.cols[i][1] + ")"); });
    const n = sh.getLastRow();
    const ids = n >= 2 ? sh.getRange(2,1,n-1,1).getValues().map(r => String(r[0])) : [];
    let at = ids.indexOf(String(obj.id));
    at = at >= 0 ? at + 2 : n + 1;
    if(at > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
    const rng = sh.getRange(at,1,1,def.cols.length);
    rng.setNumberFormats([def.cols.map(c => c[2]==="n" ? "0.##" : "@")]);
    rng.setValues([row]);
    return true;
  } finally { lock.releaseLock(); }
}

/** Borra un registro por su ID. */
function drop(coll, id){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const sh = sheet_(coll), n = sh.getLastRow(); if(n < 2) return true;
    const ids = sh.getRange(2,1,n-1,1).getValues().map(r => String(r[0]));
    const at = ids.indexOf(String(id)); if(at >= 0) sh.deleteRow(at + 2);
    return true;
  } finally { lock.releaseLock(); }
}

/** Guarda ajustes (categorías de gasto propias, importes de inversiones). */
function putConfig(cfg){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const sh = configSheet_(), n = sh.getLastRow();
    const keys = n >= 2 ? sh.getRange(2,1,n-1,1).getValues().map(r => String(r[0])) : [];
    Object.keys(cfg).forEach(k => {
      const at = keys.indexOf(k), val = JSON.stringify(cfg[k]);
      if(at >= 0) sh.getRange(at+2, 2).setValue(val); else { sh.appendRow([k, val]); keys.push(k); }
    });
    return true;
  } finally { lock.releaseLock(); }
}
