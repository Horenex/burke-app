"""Construye la versión instalable (PWA) de Burke App en pwa/dist a partir de src.html.
Uso: python3 pwa/build_pwa.py CLIENT_ID [SHEET_ID]"""
import sys, os, re, json, base64, io, hashlib, shutil
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "pwa", "dist")
CLIENT_ID = sys.argv[1] if len(sys.argv) > 1 else "__CLIENT_ID__"
SHEET_ID = sys.argv[2] if len(sys.argv) > 2 else "1BuzB5NSxyXO5I0zwgWKXuiTqHotFLrr2973Uq2cJuDk"

src = open(os.path.join(ROOT, "src.html"), encoding="utf-8").read()
logo_b64 = open(os.path.join(ROOT, "logo.b64")).read().strip()
src = src.replace('url("data:image/png;base64,__LOGO__")', 'url("logo.png")')
assert "__LOGO__" not in src

head, rest = src.split("</style>", 1)
head += "</style>"
markup, script = rest.split("<script>", 1)
script = script.rsplit("</script>", 1)[0]
head = head.replace("<title>Asistente Burke</title>", "<title>Burke App</title>", 1)
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "")

if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)

# ---------- iconos ----------
logo = Image.open(io.BytesIO(base64.b64decode(logo_b64))).convert("RGBA")
def icon(size, frac, rounded=False):
    bg = Image.new("RGBA", (size, size), (30, 43, 214, 255))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(glow)
    d.ellipse([size*.35, -size*.25, size*1.25, size*.65], fill=(110, 130, 255, 90))
    d.ellipse([-size*.4, size*.45, size*.6, size*1.4], fill=(5, 10, 110, 140))
    bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(size*.12)))
    w = int(size*frac); lg = logo.resize((w, w), Image.LANCZOS)
    bg.alpha_composite(lg, ((size-w)//2, (size-w)//2))
    if rounded:
        m = Image.new("L", (size, size), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, size-1, size-1], radius=int(size*.22), fill=255)
        bg.putalpha(m)
    return bg
def save(im, path):
    im.quantize(colors=96, method=Image.FASTOCTREE).save(os.path.join(OUT, path), optimize=True)
save(icon(192, .62), "icon-192.png")
save(icon(512, .62), "icon-512.png")
save(icon(512, .5), "maskable-512.png")
save(icon(180, .62).convert("RGB"), "apple-touch-icon.png")
save(icon(64, .7, True), "favicon.png")
logo.save(os.path.join(OUT, "logo.png"), optimize=True)

# ---------- archivos ----------
cfg = "window.BURKE_CFG = " + json.dumps({"clientId": CLIENT_ID, "sheetId": SHEET_ID}) + ";\n"
open(os.path.join(OUT, "config.js"), "w", encoding="utf-8").write(cfg)
open(os.path.join(OUT, "app.js"), "w", encoding="utf-8").write(script.strip() + "\n")
shutil.copy(os.path.join(ROOT, "pwa", "sheets.js"), os.path.join(OUT, "sheets.js"))

manifest = {
    "name": "Burke App", "short_name": "Burke", "lang": "es", "start_url": "./", "scope": "./", "id": "./",
    "display": "standalone", "orientation": "portrait", "background_color": "#1E2BD6", "theme_color": "#1E2BD6",
    "description": "App interna del área de espectáculos de Burke.",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
open(os.path.join(OUT, "manifest.webmanifest"), "w", encoding="utf-8").write(json.dumps(manifest, ensure_ascii=False, indent=1))

csp = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' data:; "
       "connect-src 'self' https://sheets.googleapis.com https://www.googleapis.com; "
       "manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'")
pwa_head = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#1E2BD6">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Burke">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
'''
html = (pwa_head + head + "\n</head>\n<body>\n" + markup.strip() +
        '\n<script src="config.js"></script>\n<script src="sheets.js"></script>\n<script src="app.js"></script>\n'
        '<script src="register-sw.js"></script>\n</body>\n</html>\n')
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)
open(os.path.join(OUT, "register-sw.js"), "w").write(
    'if("serviceWorker" in navigator) window.addEventListener("load", ()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));\n')

# Service worker: la app funciona sin conexión; siempre intenta la versión más nueva primero.
shell = ["./", "index.html", "app.js", "sheets.js", "config.js", "register-sw.js", "manifest.webmanifest",
         "icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon.png", "logo.png"]
ver = hashlib.sha1(b"".join(open(os.path.join(OUT, f), "rb").read() for f in shell[1:])).hexdigest()[:10]
sw = f'''const CACHE = "burke-{ver}";
const SHELL = {json.dumps(shell)};
self.addEventListener("install", e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); }});
self.addEventListener("activate", e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener("fetch", e => {{
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Google (datos e inicio de sesión) nunca pasa por la caché
  e.respondWith(fetch(e.request).then(r => {{ const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }})
    .catch(() => caches.match(e.request, {{ignoreSearch: true}}).then(r => r || caches.match("index.html"))));
}});
'''
open(os.path.join(OUT, "sw.js"), "w").write(sw)
print("OK", OUT, "cache", ver, "client", CLIENT_ID[:12])
