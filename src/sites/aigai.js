// Guided tour of Aigai, an Aeolian hill city in the Yunt Mountains near Manisa.
// The market building's tall face looks down the slope (+z); the agora is on top of it, the theatre and temple above.
import { addAigai, LOWER, MARKET, THEATRE, theatreSeatY } from '../world/aigai.js';
import { fbm, smoothstep } from '../world/noise.js';
import { heightAt } from '../world/layout.js';

function hills(x, z) {
  // the hill falls away in front of the market building and rises behind the agora to the acropolis
  const slope = z > 0 ? -(14 * smoothstep(4, 46, z) + 0.16 * Math.max(0, z - 46)) : 58 * smoothstep(-15, -230, z);
  const shoulders = smoothstep(70, 260, Math.abs(x)) * (20 + 70 * fbm(x * 0.006 + 1, z * 0.006 - 2)) * (z > 0 ? 0.6 : 1);
  const r = Math.hypot(x, z);
  const range = smoothstep(600, 1600, r) * 380 * fbm(x * 0.0013 - 5, z * 0.0013 + 3, 4);
  const lumps = (fbm(x * 0.07, z * 0.07, 3) - 0.5) * 0.9;
  return slope + shoulders + range + lumps;
}

// terraces cut into the hill: the street below the market building and a level floor for the theatre
function carve(x, z, h) {
  const inX = 1 - smoothstep(44, 52, Math.abs(x));
  if (z > MARKET.back + 0.5 && z < 70) {
    const t = inX * (1 - smoothstep(46, 62, z));
    h = h + (LOWER - h) * t;
  }
  const dx = x - THEATRE.x, dz = z - THEATRE.z, d = Math.hypot(dx, dz);
  if (d < 42) {
    const base = theatreBase(), w = 1 - smoothstep(30, 42, d);
    const target = dz < 2 ? Math.min(h, base - 0.6) : base - 0.15;
    h = h + (target - h) * w;
  }
  return h;
}
// the orchestra sits on the natural slope (computed without the carve so it never recurses)
let baseCache = null;
const theatreBase = () => (baseCache ??= hills(THEATRE.x, THEATRE.z + 9) + 0.2);

export const aigai = {
  id: 'aigai',
  city: { en: 'Aigai', tr: 'Aigai' },
  place: { en: 'Market Building & Agora', tr: 'Çarşı Binası ve Agora' },
  layout: {
    plaza: { minX: -40, maxX: 40, minZ: -32, maxZ: 8.5 },
    streets: [],
    hills, carve,
    clearings: [[36, -88, 46], [-26, -42, 22], [-12, -172, 22]],
  },
  terrain: { cliff: 0x7a6a55 },
  paving: {},
  stoas: { streets: false },
  sun: { center: [0, 0, -30], extent: 80 },
  build: (scene, manager) => {
    const { group } = addAigai(scene, manager);
    return { group, walkable: group.userData.walkable };
  },
  people: {
    groundY: (x, z) => {
      if (z > MARKET.back - 0.5 && z < MARKET.front && Math.abs(x) < 40) return 0;
      return heightAt(x, z);
    },
    walkers: 38,
    routes: [
      { spread: 5, points: [[-34, -12], [34, -12]] },
      { spread: 4, points: [[-30, 4], [30, 4]] },
      { spread: 4, points: [[-46, 32], [46, 32]] },
      { spread: 2, points: [[0, -30], [-20, -40], [-26, -30]] },
      { spread: 2, points: [[10, -30], [30, -70], [36, -78]] },
    ],
    groups: [[-8, -6, 3], [12, -20, 4], [-20, 2, 2], [6, 30, 3], [-24, 36, 2], [-26, -30, 3]],
    sitters: [
      ...[[0.4, 12], [-0.3, 16], [0.25, 22], [-0.15, 9], [0.1, 26]].map(([a, r]) => ({
        x: THEATRE.x + Math.sin(Math.PI + a) * r, z: THEATRE.z + Math.cos(Math.PI + a) * r + 0.35,
        y: theatreSeatY(r), face: a,
      })),
    ],
  },
  credits: [
    { work: 'Narration voice (George)', author: 'ElevenLabs', url: 'https://elevenlabs.io', license: 'Generated with ElevenLabs' },
    { work: 'Sky, ground textures, shrubs, grass and rocks', author: 'Poly Haven', url: 'https://polyhaven.com', license: 'CC0' },
  ],
  chapters: [
    {
      title: { en: 'Welcome to Aigai', tr: "Aigai'ye hoş geldin" },
      text: {
        en: 'Welcome to Aigai, an Aeolian city high in the Yunt Mountains near Manisa. In the second century BC, under the kings of Pergamon, it was rebuilt in stone on terraces cut into the hill.',
        tr: "Aigai'ye hoş geldin. Manisa yakınlarında, Yunt Dağları'nın yükseklerinde bir Aiol kenti. MÖ ikinci yüzyılda, Pergamon krallarının döneminde, tepeye oyulmuş teraslar üzerinde taştan yeniden kuruldu.",
      },
      from: { position: [-60, 70, 260], target: [0, -2, 0] },
      camera: { position: [8, -7, 78], target: [0, -3, 14] },
      duration: 16,
      vr: [6, 40],
    },
    {
      title: { en: 'The Market Building', tr: 'Çarşı Binası' },
      text: {
        en: 'This three-storey market building is one of the best preserved Hellenistic buildings in Anatolia. Shops and storerooms filled the lower floors, while the top floor opened onto the agora as a colonnade.',
        tr: "Bu üç katlı çarşı binası, Anadolu'nun en iyi korunmuş Helenistik yapılarından biri. Alt katlarda dükkânlar ve depolar vardı; en üst kat ise sütunlu bir galeri olarak agoraya açılıyordu.",
      },
      camera: { position: [-16, -11, 46], target: [0, -5, 19] },
      vr: [-14, 38],
    },
    {
      title: { en: 'The Agora', tr: 'Agora' },
      text: {
        en: 'On top of it lies the agora, the square where citizens traded, heard the news and talked politics. The colonnades gave shade to merchants and to friends meeting in the afternoon heat.',
        tr: 'Binanın üstünde agora uzanıyor: yurttaşların alışveriş yaptığı, haberleri duyduğu ve siyaset konuştuğu meydan. Sütunlu galeriler, tüccarlara ve öğle sıcağında buluşan dostlara gölge sağlıyordu.',
      },
      camera: { position: [24, 3, 2], target: [-8, 3, -14] },
      vr: [20, 0],
    },
    {
      title: { en: 'The Council House', tr: 'Meclis Binası' },
      text: {
        en: 'In the bouleuterion, the council house, elected citizens met to decide on the affairs of the city: festivals, taxes, and honours for those who had served it well.',
        tr: 'Buleuterion, yani meclis binasında, seçilmiş yurttaşlar kentin işlerine karar vermek için toplanırdı: bayramlar, vergiler ve kente iyi hizmet edenlere verilecek onurlar.',
      },
      camera: { position: [-14, 4, -14], target: [-26, 5, -44] },
      vr: [-16, -18],
    },
    {
      title: { en: 'The Theatre', tr: 'Tiyatro' },
      text: {
        en: 'The theatre is built into the slope, so the hill itself carries the seats. From the top rows, the audience could look out over the valley while plays and assemblies took place below.',
        tr: 'Tiyatro yamaca oturtulmuş, böylece oturma sıralarını tepenin kendisi taşıyor. Aşağıda oyunlar ve toplantılar sürerken, en üst sıralardaki seyirciler vadiyi seyredebiliyordu.',
      },
      camera: { position: [52, 27, -64], target: [36, 16, -99] },
      vr: [36, -76],
    },
    {
      title: { en: 'The Earthquake of AD 17', tr: 'MS 17 depremi' },
      text: {
        en: 'In AD 17 a great earthquake struck twelve cities of Asia, Aigai among them. Emperor Tiberius helped to rebuild them, and the city lived on into Roman times.',
        tr: "MS 17'de büyük bir deprem Asya'nın on iki kentini yıktı; Aigai de bunlar arasındaydı. İmparator Tiberius kentlerin yeniden kurulmasına yardım etti ve Aigai Roma döneminde de yaşamayı sürdürdü.",
      },
      camera: { position: [70, 40, 30], target: [0, 0, -40] },
      vr: [30, 20],
    },
    {
      title: { en: 'Aigai Today', tr: 'Bugün Aigai' },
      text: {
        en: 'Today archaeologists from Manisa Celal Bayar University are uncovering Aigai. In December our participants will walk among its ruins and scan them, so the real city can stand beside this reconstruction.',
        tr: "Bugün Manisa Celal Bayar Üniversitesi'nden arkeologlar Aigai'yi gün yüzüne çıkarıyor. Aralık'ta katılımcılarımız kalıntıların arasında yürüyecek ve onları tarayacak; böylece gerçek kent bu canlandırmanın yanında yer alacak.",
      },
      camera: { position: [-40, 30, 110], target: [0, -4, 0] },
      duration: 12,
      vr: [0, 34],
    },
  ],
};
