# MetaOdyssey Virtual Museum

A living Ephesus scene with a narrated tour that runs in any browser and in VR headsets (WebXR, e.g. Quest Browser).
Live: https://beguumcetin.github.io/metaodyssey-vr/

## Run locally

    python3 tools/serve.py      # http://127.0.0.1:8080  (?lang=tr or ?lang=en)

## Layout

- `src/main.js` renderer, scene, UI and VR controls
- `src/tour.js` camera flights, narration (browser speech) and subtitles
- `src/sites/ephesus.js` the tour text (EN/TR) and camera stops; copy it for Sardis and Aigai
- `src/world/` sky, terrain, streets, columns, trees, birds and dust
- `src/audio.js` wind, cicadas and birds, generated in the browser
- `assets/` Poly Haven sky, textures and plants (CC0); `models/` the scans

## Credits

- Library of Celsus scan: Miguel Bandera, CC BY 4.0 (Sketchfab)
- Sardis scans: GeopilotXYZ Drone Hizmetleri (Uygar Kuzuoğlu), CC BY 4.0 (Sketchfab)
- Sky, ground textures, shrubs, grass, rocks: Poly Haven, CC0

## Two eras

The library and the streets are modelled in code as they stood around AD 120 (`src/world/celsus.js`, `city.js`, `people.js`).
The "See it today" button, and the chapters tagged `era: 'today'`, swap in the photogrammetry scan and the ruined streets.

## Narration audio

Put one MP3 per chapter in `assets/voice/<site>/<lang>/01.mp3 … 07.mp3` (e.g. made with ElevenLabs). The tour plays them
instead of the browser voice and times the subtitles to them. The texts are the chapter `text` fields in `src/sites/<site>.js`.
