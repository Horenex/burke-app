// Prueba de la app instalable contra una hoja de Google simulada (Sheets API falsa)
const fs = require("fs"), { JSDOM } = require("jsdom");
const D = __dirname + "/../pwa/dist/";
const html = fs.readFileSync(D + "index.html", "utf8").replace(/<script src="[^"]+"><\/script>/g, "");
const dom = new JSDOM(html, { url: "https://javi.github.io/burke-app/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
w.localStorage.setItem("burke-tok", JSON.stringify({ t: "TOK", exp: Date.now() + 3600e3 }));
w.localStorage.setItem("burke-email", "orenes.contacto@gmail.com");

// ---- hoja simulada ----
const tabs = { "Personal": [["ID","Nombre","Qué hace","Teléfono","Correo","Dónde vive","Tallas","Autónomo","Coche propio","Cobra (cache/hora)","Importe €","En nómina","Notas","Foto (no tocar)"],
  ["p1","Juanma","","","","","","No","No","cache",0,"Sí","",""]] };
let sid = 10; const ids = { "Personal": 1 };
const unq = r => { const m = r.match(/^'((?:[^']|'')+)'!(.*)$/); return [m[1].replace(/''/g, "'"), m[2]]; };
const colN = s => s.split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
function read(range) {
  const [t, a] = unq(range), rows = tabs[t] || [];
  if (a === "A:A") return rows.map(r => [r[0]]);
  if (a === "1:1") return rows.slice(0, 1);
  if (a === "A2:B") return rows.slice(1).map(r => r.slice(0, 2));
  return rows;
}
const calls = [];
w.fetch = async (url, opt = {}) => {
  const u = new URL(url), m = opt.method || "GET", body = opt.body ? JSON.parse(opt.body) : null;
  calls.push(m + " " + decodeURIComponent(u.pathname.split("/spreadsheets/")[1] || u.pathname));
  const ok = j => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
  if (u.hostname === "www.googleapis.com") return ok({ email: "orenes.contacto@gmail.com" });
  if (opt.headers.Authorization !== "Bearer TOK") return { ok: false, status: 401, text: async () => "" };
  const p = decodeURIComponent(u.pathname).split("/spreadsheets/SHEET")[1];
  if (p === "" && u.searchParams.get("fields")) return ok({ sheets: Object.keys(tabs).map(t => ({ properties: { title: t, sheetId: ids[t] } })) });
  if (p === ":batchUpdate") { body.requests.forEach(r => {
      if (r.addSheet) { tabs[r.addSheet.properties.title] = []; ids[r.addSheet.properties.title] = ++sid; }
      if (r.deleteDimension) { const t = Object.keys(ids).find(k => ids[k] === r.deleteDimension.range.sheetId); tabs[t].splice(r.deleteDimension.range.startIndex, 1); }
    }); return ok({}); }
  if (p === "/values:batchUpdate") { body.data.forEach(d => { const [t] = unq(d.range); tabs[t][0] = d.values[0]; }); return ok({}); }
  if (p === "/values:batchGet") return ok({ valueRanges: u.searchParams.getAll("ranges").map(r => ({ values: read(r) })) });
  const vm = p.match(/^\/values\/(.+?)(:append)?$/);
  if (vm) { const [t, a] = unq(vm[1]);
    if (vm[2]) { tabs[t].push(...body.values); return ok({}); }
    if (m === "PUT") { const mm = a.match(/^([A-Z]+)(\d+)/), row = +mm[2] - 1, c0 = colN(mm[1]);
      tabs[t][row] = tabs[t][row] || []; body.values[0].forEach((v, i) => tabs[t][row][c0 + i] = v); return ok({}); }
    return ok({ values: read(vm[1]) }); }
  throw new Error("ruta no simulada " + m + " " + p);
};
w.eval(fs.readFileSync(D + "config.js", "utf8").replace(/"sheetId": *"[^"]+"/, '"sheetId":"SHEET"'));
w.eval(fs.readFileSync(D + "sheets.js", "utf8"));
w.eval(fs.readFileSync(D + "app.js", "utf8"));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } console.log("ok -", m); };
(async () => {
  await sleep(300);
  const view = () => w.document.querySelector("#view").textContent;
  w.eval("go")("calendario");
  const nApi = () => calls.length;
  // Raquel guarda un evento hoy desde su móvil (se escribe directamente en la hoja)
  const d0=new Date(); const today=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,"0")}-${String(d0.getDate()).padStart(2,"0")}`;
  tabs["Eventos"].push(["r1", today, "Bolo de Raquel", "18:00", "20:00", "Plaza", "", "", 500, 300, 200, 0.3, "", "[]", "[]", "{}", "", "", "", ""]);
  assert(!/Bolo de Raquel/.test(view()), "antes de la siguiente lectura aún no aparece");
  await w.gasLoad(true);
  assert(/Bolo de Raquel/.test(view()), "tras la lectura periódica aparece en tu calendario sin recargar");
  const before = nApi(); const html = w.document.querySelector("#view").innerHTML;
  await w.gasLoad(true);
  assert(w.document.querySelector("#view").innerHTML === html, "si no hay cambios no se redibuja la pantalla");
  // mientras escribes en un buscador no se te borra lo que tecleas
  w.eval("go")("personal"); const q = w.document.querySelector("#per-q"); q.focus(); q.value = "jua";
  tabs["Personal"].push(["p2", "Nueva Persona", "", "", "", "", "", "No", "No", "cache", 0, "Sí", "", ""]);
  await w.gasLoad(true);
  assert(w.document.activeElement === w.document.querySelector("#per-q") && w.document.querySelector("#per-q").value === "jua", "no se redibuja mientras escribes");
  q.blur(); await sleep(120);
  assert(/Nueva Persona/.test(view()), "al dejar de escribir se actualiza");
  // una lectura que llega mientras tú guardas no deshace tu cambio
  let release; const slow = new Promise(r => release = r); const realFetch = w.fetch;
  w.fetch = async (u, o) => { if ((o.method || "GET") !== "GET") await slow; return realFetch(u, o); };
  const ev = { id: "e9", nombre: "Mi bolo", fecha: today, ini: "", fin: "", lugar: "", equipo: [], gastos: [], amort: {}, objetivo: 0.3, oferta: null };
  w.eval("go")("calendario"); const p = w.put("eventos", ev); const htmlBefore = w.document.querySelector("#view").innerHTML;
  tabs["Eventos"].push(["r2", today, "Otro de Raquel", "", "", "", "", "", 0, 0, 0, 0.3, "", "[]", "[]", "{}", "", "", "", ""]);
  await w.gasLoad(true);
  assert(w.document.querySelector("#view").innerHTML === htmlBefore, "mientras tu guardado está en marcha se ignora la lectura (no deshace nada)");
  release(); await p; w.fetch = realFetch;
  await w.gasLoad(true);
  assert(/Mi bolo/.test(view()) && /Otro de Raquel/.test(view()), "al terminar de guardar se ven los dos eventos");
  console.log("\nTODO OK");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
