// Guided tour of Sardis, capital of Lydia: the Temple of Artemis below the acropolis.
// Same fields as sites/ephesus.js. The temple's front faces +z; the acropolis rises behind it (-z).
import { addSardis, sardisGround, riverX } from '../world/artemis.js';
import { fbm, smoothstep } from '../world/noise.js';

function hills(x, z) {
  // the acropolis: a high ridge behind the temple, cut into gullies by the rain
  const rise = smoothstep(-105, -320, z + 60 * (fbm(x * 0.004, 7) - 0.5));
  const peaks = 70 + 150 * fbm(x * 0.005 + 2, z * 0.005);
  // ridged noise gives sharp crests and gullies running down the slope
  const ridged = 1 - Math.abs(2 * fbm(x * 0.018 + 5, z * 0.008 - 3, 4) - 1);
  const cliffs = rise * peaks * (0.75 + 0.35 * ridged);
  // lower hills on both sides of the valley, the plain opening out in front
  const sides = smoothstep(90, 320, Math.abs(x - 20)) * (25 + 110 * fbm(x * 0.0045 - 3, z * 0.0045 + 1)) * smoothstep(420, 80, z);
  const r = Math.hypot(x, z);
  const range = smoothstep(700, 1700, r) * 520 * fbm(x * 0.0012 + 4, z * 0.0012 - 2, 4);   // Mount Tmolus
  const lumps = (fbm(x * 0.07, z * 0.07, 3) - 0.5) * 0.9;
  return cliffs + sides + range + lumps;
}

// the Pactolus runs in a shallow bed west of the sanctuary
function carve(x, z, h) {
  const d = Math.abs(x - riverX(z));
  if (d > 18) return h;
  const bed = -2.3;
  return bed + (h - bed) * smoothstep(4.5, 18, d);
}

export const sardis = {
  id: 'sardis',
  city: { en: 'Sardis', tr: 'Sardes' },
  place: { en: 'Temple of Artemis', tr: 'Artemis Tapınağı' },
  layout: {
    plaza: { minX: -34, maxX: 34, minZ: -108, maxZ: 36 },
    streets: [{ name: 'road', width: 7, flat: 999, rise: 0, points: [[0, 34], [-6, 120], [-26, 260]] }],
    hills, carve,
  },
  terrain: { cliff: 0x957457 },
  paving: { square: false },
  stoas: false,   // no colonnaded streets here
  sun: { center: [0, 0, -35], extent: 85 },
  build: (scene, manager) => {
    const { group, animators } = addSardis(scene, manager);
    return { group, animators, walkable: [group.userData.walkable] };
  },
  people: {
    groundY: sardisGround,
    walkers: 40,
    routes: [
      { spread: 2.5, points: [[0, 30], [-6, 120], [-20, 220]] },
      { spread: 2, points: [[-26, 3.2], [26, 3.2]] },
      { spread: 1.5, points: [[-8, 32], [-34, 32], [-36, -30]] },   // down to the bank of the Pactolus
      { spread: 3, points: [[-28, 10], [-28, -100]] },
      { spread: 3, points: [[28, 10], [28, -100]] },
    ],
    groups: [[-8, 31, 3], [8, 32, 3], [-15, 8, 2], [16, 42, 4], [0, 12, 3], [-35, 20, 2]],
    sitters: [{ x: -12, z: 0.75, y: 1.2 }, { x: 9, z: 1.3, y: 0.8 }, { x: 15.5, z: 0.75, y: 1.2 }, { x: -3, z: 1.3, y: 0.8 }],
  },
  credits: [
    { work: 'Narration voice (George)', author: 'ElevenLabs', url: 'https://elevenlabs.io', license: 'Generated with ElevenLabs' },
    { work: 'Sky, ground textures, shrubs, grass and rocks', author: 'Poly Haven', url: 'https://polyhaven.com', license: 'CC0' },
  ],
  chapters: [
    {
      title: { en: 'Welcome to Sardis', tr: "Sardes'e hoş geldin" },
      text: {
        en: 'Welcome to Sardis, capital of the kingdom of Lydia. Here, under King Croesus, the first coins of pure gold and silver were struck. Let us go down to the sanctuary of Artemis, below the acropolis.',
        tr: "Sardes'e hoş geldin, Lidya krallığının başkentine. Burada, Kral Kroisos döneminde ilk saf altın ve gümüş sikkeler basıldı. Akropolün eteğindeki Artemis kutsal alanına inelim.",
      },
      from: { position: [70, 80, 280], target: [0, 10, 0] },
      camera: { position: [16, 6, 72], target: [0, 11, -10] },
      duration: 16,
      vr: [6, 62],
    },
    {
      title: { en: 'The Temple of Artemis', tr: 'Artemis Tapınağı' },
      text: {
        en: 'This is the Temple of Artemis, one of the largest Ionic temples ever built: almost one hundred metres long. Work began around 300 BC and went on for centuries. It was never completely finished.',
        tr: 'Karşındaki yapı Artemis Tapınağı, şimdiye dek yapılmış en büyük İon tapınaklarından biri: neredeyse yüz metre uzunluğunda. Yapımı MÖ 300 civarında başladı ve yüzyıllar sürdü. Hiçbir zaman tamamen bitirilemedi.',
      },
      camera: { position: [-8, 5, 48], target: [0, 13, -12] },
      vr: [-5, 42],
    },
    {
      title: { en: 'Eighteen-Metre Columns', tr: 'On sekiz metrelik sütunlar' },
      text: {
        en: 'Each column rose almost eighteen metres. Their capitals, with deep spiral volutes, are among the finest Ionic capitals anywhere. In Roman times the temple was shared with the cult of the emperors.',
        tr: 'Her sütun neredeyse on sekiz metre yükseliyordu. Derin sarmal volütlü başlıkları, dünyadaki en güzel İon başlıkları arasında sayılır. Roma döneminde tapınak, imparator kültüyle paylaşıldı.',
      },
      camera: { position: [-27, 2.2, 6], target: [-19, 15, -8] },
      vr: [-28, 7],
    },
    {
      title: { en: 'The Altar', tr: 'Sunak' },
      text: {
        en: 'In front of the temple stands the altar of Artemis. It is older than the temple itself: the Lydians made offerings here long before the Greeks raised the columns behind it.',
        tr: 'Tapınağın önünde Artemis sunağı duruyor. Sunak tapınaktan daha eski: Lidyalılar, Yunanlar arkadaki sütunları dikmeden çok önce burada adak sunuyordu.',
      },
      camera: { position: [15, 4.5, 42], target: [0, 3, 21] },
      vr: [11, 38],
    },
    {
      title: { en: 'The Acropolis', tr: 'Akropol' },
      text: {
        en: 'Above the city rises the acropolis, its cliffs carved by rain. In 547 BC the Persian king Cyrus captured it, and Croesus, the richest king of his age, lost his kingdom.',
        tr: 'Kentin üstünde, yağmurun oyduğu yamaçlarıyla akropol yükseliyor. MÖ 547’de Pers kralı Kyros onu ele geçirdi ve çağının en zengin kralı Kroisos krallığını kaybetti.',
      },
      camera: { position: [44, 24, 66], target: [4, 62, -190] },
      vr: [30, 30],
    },
    {
      title: { en: 'The Gold of the Pactolus', tr: 'Paktolos’un altını' },
      text: {
        en: 'The Pactolus stream flowed past the sanctuary, its sand full of gold dust. In workshops by the river, the Lydians learned to separate gold from silver and made the first refined coins.',
        tr: 'Paktolos çayı kutsal alanın yanından akıyordu ve kumu altın tozuyla doluydu. Lidyalılar, nehrin kıyısındaki atölyelerde altını gümüşten ayırmayı öğrendi ve ilk arıtılmış sikkeleri yaptı.',
      },
      camera: { position: [-36, 3, 34], target: [-52, 0, -6] },
      vr: [-36, 30],
    },
    {
      title: { en: 'Onwards to Aigai', tr: 'Sırada Aigai var' },
      text: {
        en: 'Sardis later became one of the Seven Churches of Asia and home to one of the largest synagogues of the ancient world. Our next stop is Aigai, high in the hills, which our participants will explore in December.',
        tr: 'Sardes daha sonra Asya’nın Yedi Kilisesi’nden biri oldu ve antik dünyanın en büyük sinagoglarından birine ev sahipliği yaptı. Sıradaki durağımız tepelerin yükseğindeki Aigai; katılımcılarımız orayı Aralık’ta keşfedecek.',
      },
      camera: { position: [48, 32, 96], target: [0, 10, -40] },
      duration: 12,
      vr: [20, 70],
    },
  ],
};
