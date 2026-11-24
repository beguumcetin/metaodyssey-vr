# MetaOdyssey Virtual Museum

One web page that works both as an online virtual museum and in a VR headset (WebXR, e.g. Meta Quest browser).
First exhibit: the Library of Celsus, Ephesus. Next: Sardis, Aigai.

## Run locally
    python3 tools/serve.py
Open http://localhost:8080. (VR needs HTTPS, so test on the headset after publishing, e.g. GitHub Pages.)

## Add the Celsus model
1. Download "Library of Celsus – Crowdsourced photogrammetry" (CC BY) from Sketchfab as **glTF/GLB**:
   https://sketchfab.com/3d-models/library-of-celsus-crowdsourced-photogrammetry-1cc6ad6af508422398f60f902cb70e88
2. Save it as `models/raw/celsus.glb` (if it comes as a zip with `scene.gltf`, unzip it into `models/raw/celsus/`).
3. Shrink it: `tools/optimize.sh models/raw/celsus.glb models/celsus.glb`
4. Reload the page. If it faces the wrong way or the info points are off, edit `transform` and `hotspots` in `src/content.js`.

## Files
- `src/content.js` — exhibits, info point texts and positions, credits (edit this to add content)
- `src/main.js` — scene, desktop controls, VR teleport
- `tools/optimize.sh` — reduces triangles and compresses textures

## Licences
Every CC BY model must appear in `credits` in `src/content.js` (shown under "Credits" on the page).
