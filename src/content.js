// Scene content: models and info points. Edit this file to add exhibits.
// Positions are in metres, relative to the centre of the façade base.

export const exhibits = [
  {
    id: 'celsus',
    model: 'models/celsus.glb',          // put the downloaded/optimised model here
    // Adjust after loading the real model: scale, rotation (radians) and position.
    transform: { scale: 1, rotationY: 0, position: [-5.5, 0, 0] },  // centres the façade
    targetHeight: 17,                     // façade is roughly 17 m tall; used for auto-scaling
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
];

// Shown in the Credits panel. Every CC BY model must be listed here.
export const credits = [
  {
    work: 'Library of Celsus – Crowdsourced photogrammetry',
    author: 'miguelbandera',
    url: 'https://sketchfab.com/3d-models/library-of-celsus-crowdsourced-photogrammetry-1cc6ad6af508422398f60f902cb70e88',
    license: 'CC BY 4.0',
    changes: 'Simplified and compressed for web and VR.',
  },
];
