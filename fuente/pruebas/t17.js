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
  const txt = () => w.document.querySelector("#view").textContent;
  assert(Object.keys(tabs).length === 7, "crea las pestañas que faltan (" + Object.keys(tabs).join(", ") + ")");
  assert(/3 personas/.test(txt()), "carga el personal de la hoja (Javi, Raquel + Juanma)");
  // crear cliente y evento como lo haría la app
  await w.SHEETS.put("clientes", { id: "c1", nombre: "La Ribera", tipo: "Ayuntamiento o administración", contactos: [{ id: "k1", nombre: "Amador", cargo: "Concejal" }] });
  const ev = { id: "e1", nombre: "Bolo prueba", fecha: "2026-11-05", ini: "18:00", fin: "20:00", lugar: "Plaza", cliente: "La Ribera", clienteId: "c1",
    equipo: [{ pid: "p1", modo: "cache", extra: 100, ss: true }], gastos: [{ cat: "Transporte", imp: 50 }], amort: {}, objetivo: 0.3, oferta: null };
  await w.eval("put")("eventos", ev);
  assert(tabs["Eventos"].length === 2 && tabs["Eventos"][1][0] === "e1", "guarda el evento como fila nueva");
  assert(typeof tabs["Eventos"][1][8] === "number" && tabs["Eventos"][1][8] > 0, "guarda el precio calculado (" + tabs["Eventos"][1][8] + " €)");
  await w.SHEETS.put("eventos", { ...ev, nombre: "Bolo prueba editado" });
  assert(tabs["Eventos"].length === 2 && tabs["Eventos"][1][2] === "Bolo prueba editado", "editar actualiza la misma fila, no duplica");
  await w.SHEETS.putConfig({ cats: ["Dietas"], inv: { kumbre: 2500 } });
  await w.SHEETS.putConfig({ cats: ["Dietas", "Peajes"], inv: { kumbre: 2500 } });
  assert(tabs["Config"].length === 3 && /Peajes/.test(tabs["Config"][1][1]), "ajustes se actualizan sin duplicar");
  const all = await w.SHEETS.getAll();
  assert(all.eventos[0].equipo[0].extra === 100 && all.eventos[0].fecha === "2026-11-05" && all.clientes[0].contactos[0].nombre === "Amador", "lee bien listas, fechas y contactos");
  assert(all.personal[0].ss === true && all.personal[0].autonomo === false, "lee bien los Sí/No");
  // columnas reordenadas a mano en la hoja
  tabs["Personal"] = tabs["Personal"].map(r => [r[1], r[0], ...r.slice(2)]);
  const all2 = await w.SHEETS.getAll();
  assert(all2.personal[0].id === "p1" && all2.personal[0].nombre === "Juanma", "aguanta columnas cambiadas de orden");
  // fecha que alguien escribe a mano y Google convierte en fecha
  tabs["Eventos"][1][1] = 46331; tabs["Eventos"][1][3] = 0.75;
  const all3 = await w.SHEETS.getAll();
  assert(all3.eventos[0].fecha === "2026-11-05" && all3.eventos[0].ini === "18:00", "entiende fechas y horas escritas a mano");
  await w.SHEETS.drop("eventos", "e1");
  assert(tabs["Eventos"].length === 1, "borrar quita la fila");
  // sesión caducada: el cambio queda en cola y no se pierde
  let redirected = null; w.location.assign = u => { redirected = u; };
  w.localStorage.setItem("burke-tok", JSON.stringify({ t: "VIEJO", exp: Date.now() + 3600e3 }));
  w.SHEETS.put("agentes", { id: "g1", nombre: "Salvador Navarro" });
  await sleep(100);
  assert(w.SHEETS.pending() === 1, "con la sesión caducada el cambio queda guardado en el móvil");
  // foto maliciosa
  const bad = 'x" onerror="alert(1)'; w.eval("applyPersonal")([{ id: "p9", nombre: "Mal", foto: bad }]);
  assert(!w.eval("avatar")({ id: "p9", nombre: "Mal", foto: bad }).includes("onerror"), "una foto manipulada en la hoja no inyecta código");
  console.log("\nTODO OK ·", calls.length, "llamadas a la API");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
