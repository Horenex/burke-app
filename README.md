# Burke App

App interna del área de espectáculos de Burke. Los datos viven en la hoja de Google «BURKE APP · Datos».

- **App publicada:** https://horenex.github.io/burke-app/
- **Raíz del repositorio:** la app ya construida (lo que sirve GitHub Pages). No editar a mano.
- **`fuente/`:** código original y herramientas.
  - `src.html`: la app (pantallas, cálculos, estilos). Se edita aquí.
  - `pwa/sheets.js`: conexión con Google Sheets e inicio de sesión con Google.
  - `pwa/build_pwa.py`: construye la app instalable en `fuente/pwa/dist` → copiar su contenido a la raíz.
  - `build.py`: construye la versión de Apps Script (respaldo) y la demo.
  - `pruebas/`: pruebas automáticas (Node + jsdom) contra una hoja simulada.
  - `apps-script/`: servidor de la versión de respaldo.

## Publicar una versión nueva
```
cd fuente
python3 pwa/build_pwa.py <CLIENT_ID>
node pruebas/t17.js && node pruebas/t18.js
cp pwa/dist/* ..
```
