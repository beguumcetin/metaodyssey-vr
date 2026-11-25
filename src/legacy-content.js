// Scene content: one entry per stop of the virtual museum. Edit this file to add stops.
// Without ?site= the page opens the museum hall (every stop as a model on a plinth);
// ?site=<id> steps into one stop at full scale.
//
// fit:       { height: m } scales the model to that height (single monuments),
//            { size: m }   scales its longest horizontal side (drone scans of whole areas).
// transform: extra offset after fitting (metres) and rotation (radians).
// camera:    desktop start view; null frames the whole model. vrStart: where you stand in VR (x, z).
// hotspotSize: marker scale (default 1).
// floor:     true = the model stands on y = 0; false = the scan has its own terrain.
// fade:      circle (site metres) outside which the scan fades into the ground; hides ragged scan edges.
// ground:    ground colour around the scan (match the scan's own ground).
// hall:      plinth position [x, z] in the museum hall.
// hotspots:  positions in metres after fitting and transform.

export const sites = [
  {
    id: 'ephesus',
    city: 'Ephesus',
    place: 'Library of Celsus',
    model: 'models/celsus.glb',
    fit: { height: 17 },
    transform: { rotationY: 0, position: [-5.5, 0, 0] },  // centres the façade
    camera: { position: [0, 5, 30], target: [0, 7, 0] },
    vrStart: [0, 16],
    floor: true,
    fade: { center: [0, 2], radius: 21, width: 6 },
    ground: 0xb3a385,
    hall: [-4, 7],
    credit: {
      work: 'Library of Celsus – Crowdsourced photogrammetry',
      author: 'Miguel Bandera',
      url: 'https://sketchfab.com/3d-models/library-of-celsus-crowdsourced-photogrammetry-1cc6ad6af508422398f60f902cb70e88',
      license: 'CC BY 4.0',
    },
    hotspots: [
      {
        position: [0, 4.5, 6],
        title: 'The Library of Celsus',
        body: 'Built in the early 2nd century AD by Tiberius Julius Aquila in honour of his father, Tiberius Julius Celsus Polemaeanus, a governor of the province of Asia. It is said to have held around 12,000 scrolls and was one of the largest libraries of the Roman world.',
      },
      {
        position: [-5.7, 5.3, 6],
        title: 'Four Virtues',
        body: 'The niches of the lower storey hold statues personifying Wisdom (Sophia), Virtue (Arete), Intelligence (Ennoia) and Knowledge (Episteme). The ones on site today are copies; the originals are in the Ephesos Museum in Vienna.',
      },
      {
        position: [-0.5, 2.2, 6],
        title: 'A Tomb Beneath the Books',
        body: 'Celsus himself was buried in a sarcophagus in a chamber under the reading hall, an unusual honour inside a city.',
      },
      {
        position: [2, 13.5, 5],
        title: 'Rebuilt from Fragments',
        body: 'The façade collapsed in antiquity. Archaeologists re-erected it from its original pieces between 1970 and 1978.',
      },
      {
        position: [8.5, 5.5, 6],
        title: 'Gate of Mazaeus and Mithridates',
        body: 'This triple gateway beside the library was dedicated to Emperor Augustus and his family by two freed slaves, Mazaeus and Mithridates, in the late 1st century BC. It led into the commercial agora of Ephesus.',
      },
    ],
  },
  {
    id: 'sardis',
    city: 'Sardis',
    place: 'Bath-Gymnasium & Synagogue',
    model: 'models/sardes.glb',
    fit: { size: 120 },
    transform: { rotationY: 0, position: [0, 0, 0] },
    camera: null,
    vrStart: [8, 15],          // in the exercise yard
    fade: { center: [0, 0], radius: 54, width: 10 },
    ground: 0x7d8452,
    hall: [4, 7],
    hotspotSize: 4,            // bigger markers for a large area
    floor: false,
    credit: {
      work: 'SARDES YÜKSEK ÇÖZÜNÜRLÜK (2.5 M MESH)',
      author: 'GeopilotXYZ Drone Hizmetleri (Uygar Kuzuoğlu)',
      url: 'https://sketchfab.com/3d-models/sardes-yuksek-cozunurluk-25-m-mesh-19b1b82514eb4c0a82a6afaa1bfb3df1',
      license: 'CC BY 4.0',
    },
    hotspots: [
      {
        position: [-22, 12, 22],
        title: 'Sardis, Capital of Lydia',
        body: 'Sardis was the capital of the Lydian kingdom, home of the legendary rich King Croesus. The Lydians are credited with minting the first coins, and the Persian Royal Road ended here. The Archaeological Exploration of Sardis has been excavating the city since 1958.',
      },
      {
        position: [8, 3, 6],
        title: 'The Palaestra',
        body: 'This open yard was the exercise ground of the Roman Bath-Gymnasium. Young men trained here in wrestling, running and other sports, then moved on to the baths and lecture halls around it.',
      },
      {
        position: [-13.5, 4, 7],
        title: 'The Synagogue',
        body: 'This long hall was turned into a synagogue in late antiquity, set right into the corner of the gymnasium. It is one of the largest ancient synagogues ever found, a sign of a large and well-established Jewish community at Sardis.',
      },
      {
        position: [4, 12, -15],
        title: 'The Marble Court',
        body: 'The two-storey marble screen at the far end was the showpiece of the complex. Visit the next stop to see it up close.',
      },
    ],
  },
  {
    id: 'sardis-gymnasium',
    city: 'Sardis',
    place: 'Marble Court',
    model: 'models/gymnasium.glb',
    fit: { size: 45 },
    transform: { rotationY: Math.PI, position: [0, 0, 0] },   // face the court façade
    camera: { position: [-1, 4.5, 6], target: [-1, 6, -8] },   // camera y is added to the ground height
    vrStart: [-1, 2],          // inside the court, facing the screen
    fade: { center: [-1, 0], radius: 21, width: 5 },
    ground: 0x7d8452,
    hall: [4, -6],
    floor: false,
    credit: {
      work: 'GYMNASIUM',
      author: 'GeopilotXYZ Drone Hizmetleri (Uygar Kuzuoğlu)',
      url: 'https://sketchfab.com/3d-models/gymnasium-c6e39ec3aead45c1963ed4c4b29b8029',
      license: 'CC BY 4.0',
    },
    hotspots: [
      {
        position: [-1, 6, -8],
        title: 'The Marble Court',
        body: 'The ceremonial heart of the Bath-Gymnasium, built in the early 3rd century AD and dedicated to the imperial family. Its richly carved two-storey screen was re-erected from the original blocks by archaeologists in the 1960s and 70s.',
      },
      {
        position: [-1, 4, 8],
        title: 'Behind the Walls: the Baths',
        body: 'Beyond these massive brick-and-stone walls lay the heated halls of the Roman baths. A visit combined exercise, bathing and conversation, which made the gymnasium a centre of city life.',
      },
    ],
  },
];

// Stops that are not scanned yet; shown in the hall as empty plinths.
export const upcoming = [
  {
    id: 'aigai',
    city: 'Aigai',
    place: 'Market Building',
    note: 'To be scanned by MetaOdyssey participants on site in December 2026.',
    hall: [-4, -6],
  },
];
