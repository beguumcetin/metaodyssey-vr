# MetaOdyssey Virtual Museum

Three ancient cities of the Manisa region, rebuilt as they stood in antiquity, with a narrated tour.
It runs in any browser and in VR headsets (WebXR, e.g. the Quest Browser): open the link and press **VR**.

**Live:** https://beguumcetin.github.io/metaodyssey-vr/

| City | Link | What you see |
|---|---|---|
| Ephesus | [?site=ephesus](https://beguumcetin.github.io/metaodyssey-vr/?site=ephesus) | Library of Celsus and the Gate of Mazaeus and Mithridates around AD 120, colonnaded streets; "See it today" swaps in the real scan |
| Sardis | [?site=sardis](https://beguumcetin.github.io/metaodyssey-vr/?site=sardis) | Temple of Artemis, the Lydian altar, the acropolis and the Pactolus stream |
| Aigai | [?site=aigai](https://beguumcetin.github.io/metaodyssey-vr/?site=aigai) | Three-storey market building, agora, council house, theatre and acropolis temple |

Built for the Erasmus+ youth exchange MetaOdyssey (2025-3-TR01-KA152-YOU-000382053), Manisa, December 2026.

## Using it

- **Start the tour**: the camera flies from stop to stop while a narrator speaks; subtitles follow the voice.
- Pause with ▶/❚❚ or by dragging the view; play continues where it stopped.
- The chapter list (left) jumps to any stop; the city buttons (top left) and the link on the last stop go to the next city.
- **In VR**: a panel in front of you has previous / play / next and a button for the next city. Point at the ground and
  pull the trigger to walk there.
- `?lang=tr` shows the Turkish version (Ephesus also has Turkish narration).

## Run locally

    python3 tools/serve.py      # http://127.0.0.1:8080

No build step: plain ES modules, three.js from a CDN.

## Code

- `src/main.js` renderer, UI, VR controls; loads the city given by `?site=`
- `src/sites/<city>.js` everything specific to a city: ground layout, monuments, people, tour chapters (text EN/TR, camera, VR spot)
- `src/sites/index.js` the list of cities
- `src/tour.js` camera flights, narration and subtitles; `src/vr-panel.js` the in-headset panel
- `src/world/` shared world: sky and terrain (`landscape.js`), ground plan (`layout.js`), trees, colonnades (`city.js`),
  people (`people.js`), birds and dust (`life.js`), and the monuments (`celsus.js`, `artemis.js`, `aigai.js`)
- `src/audio.js` wind, cicadas and birds, generated in the browser
- `assets/voice/<city>/<lang>/01.mp3 …` recorded narration, one file per chapter

### Adding a city

Copy `src/sites/aigai.js`, change the layout (`hills`, `plaza`, `streets`), write a `build()` that adds the monuments,
add the chapters, and register it in `src/sites/index.js`. Narration files go in `assets/voice/<id>/en/`.

## Accuracy

The buildings are reconstructions made from published descriptions (dimensions, number of storeys and columns,
layout), not from excavation plans. Sizes and positions are approximate, and the colours follow what is known about
ancient painted architecture in general. Aigai will be checked against the site after the December visit.

## Credits

- Library of Celsus scan: Miguel Bandera, CC BY 4.0 (Sketchfab)
- Sky, ground textures, shrubs, grass, rocks: Poly Haven, CC0
- Narration: ElevenLabs (voices "George" and, for Turkish, "Cavit")
- Everything else (buildings, people, trees, birds, sound) is generated in code with three.js
