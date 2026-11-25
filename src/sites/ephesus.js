// Guided tour of Ephesus: one entry per chapter.
// camera: desktop view (position, target) in metres; the library façade faces +z.
// from:   optional start view, for a long cinematic move into the chapter.
// vr:     where the visitor stands in VR (x, z); they face `camera.target`.
// era:    'ancient' shows the modelled library of AD 120, 'today' the photogrammetry scan of the ruin.

export const ephesus = {
  id: 'ephesus',
  city: { en: 'Ephesus', tr: 'Efes' },
  place: { en: 'Library of Celsus', tr: 'Celsus Kütüphanesi' },
  model: 'models/celsus.glb',
  fit: { height: 17 },
  offset: [-5.5, 0, 0],                       // centres the façade on x = 0
  fade: { center: [1, 1], radius: 14.5, width: 3 },
  // the scan is only the façade: a dark hall behind it fills the windows (x0, x1, z0, z1, height)
  hall: [-9.4, 6.6, -11, -0.6, 15.5],
  credits: [
    { work: 'Library of Celsus – Crowdsourced photogrammetry', author: 'Miguel Bandera', url: 'https://sketchfab.com/3d-models/library-of-celsus-crowdsourced-photogrammetry-1cc6ad6af508422398f60f902cb70e88', license: 'CC BY 4.0' },
    { work: 'Sky, ground textures, shrubs, grass and rocks', author: 'Poly Haven', url: 'https://polyhaven.com', license: 'CC0' },
  ],
  chapters: [
    {
      title: { en: 'Welcome to Ephesus', tr: "Efes'e hoş geldin" },
      era: 'ancient',
      text: {
        en: 'Welcome to Ephesus, once one of the great cities of the Roman world. In the second century, perhaps two hundred thousand people lived here. Let us walk down Marble Street to its most famous building.',
        tr: "Efes'e hoş geldin. Burası bir zamanlar Roma dünyasının en büyük kentlerinden biriydi. İkinci yüzyılda burada belki iki yüz bin kişi yaşıyordu. Mermer Cadde'den inerek kentin en ünlü yapısına gidelim.",
      },
      from: { position: [14, 62, 235], target: [2, 8, 60] },
      camera: { position: [3, 5.5, 40], target: [0, 8, 0] },
      duration: 16,
      vr: [2, 30],
    },
    {
      title: { en: 'The Library of Celsus', tr: 'Celsus Kütüphanesi' },
      era: 'ancient',
      text: {
        en: 'This is the Library of Celsus, finished around 117 AD. Tiberius Julius Aquila built it in memory of his father Celsus, a governor of the province of Asia. It is said to have held some twelve thousand scrolls.',
        tr: 'Karşındaki yapı Celsus Kütüphanesi, MS 117 civarında tamamlandı. Tiberius Julius Aquila onu, Asya eyaletinin valisi olan babası Celsus anısına yaptırdı. Burada yaklaşık on iki bin parşömen rulosu bulunduğu söylenir.',
      },
      camera: { position: [0, 4.8, 25], target: [0, 8.2, 0] },
      vr: [0, 20],
    },
    {
      title: { en: 'The Four Virtues', tr: 'Dört Erdem' },
      era: 'ancient',
      text: {
        en: 'The niches of the lower storey hold four women: Wisdom, Virtue, Intelligence and Knowledge, the qualities of Celsus himself. Like most ancient statues, they were once painted in bright colours. The originals survive today in the Ephesos Museum in Vienna.',
        tr: 'Alt kattaki nişlerde dört kadın heykeli var: Bilgelik, Erdem, Düşünce ve Bilgi. Bunlar Celsus’un kendi niteliklerini simgeler. Çoğu antik heykel gibi bunlar da bir zamanlar canlı renklerle boyalıydı. Asılları bugün Viyana’daki Efes Müzesi’nde.',
      },
      camera: { position: [-2.5, 3.6, 13], target: [-3.5, 4.6, 4] },
      vr: [-2.5, 12],
    },
    {
      title: { en: 'A Tomb Beneath the Books', tr: 'Kitapların altındaki mezar' },
      era: 'ancient',
      text: {
        en: 'The library was also a tomb. Celsus was buried in a marble sarcophagus in a chamber beneath the reading hall. Being buried inside the city was a rare honour in the Roman world.',
        tr: 'Kütüphane aynı zamanda bir mezardı. Celsus, okuma salonunun altındaki bir odaya, mermer bir lahde gömüldü. Roma dünyasında kentin içine gömülmek çok az kişiye tanınan bir onurdu.',
      },
      camera: { position: [1.2, 1.7, 10.5], target: [-0.3, 2.9, 3] },
      vr: [1, 10],
    },
    {
      title: { en: 'Fallen and Rebuilt', tr: 'Yıkılış ve yeniden doğuş' },
      era: 'today',
      text: {
        en: 'Look up. The façade plays a trick on the eye: the columns in the middle are larger than those at the sides, so the building looks wider than it is. Fire and earthquakes brought it down, and archaeologists raised it again from its own stones between 1970 and 1978.',
        tr: 'Yukarı bak. Cephe gözü yanıltır: ortadaki sütunlar kenardakilerden büyüktür, bu yüzden yapı olduğundan geniş görünür. Yangın ve depremler onu yıktı; arkeologlar 1970 ile 1978 arasında yapıyı kendi taşlarıyla yeniden ayağa kaldırdı.',
      },
      camera: { position: [-10, 1.8, 9.5], target: [-1, 12, 2] },
      vr: [-9, 10],
    },
    {
      title: { en: 'Gate of Mazaeus and Mithridates', tr: 'Mazeus ve Mithridates Kapısı' },
      era: 'today',
      text: {
        en: 'To the right stands a triple gateway. Two freed slaves, Mazaeus and Mithridates, dedicated it to Emperor Augustus and his family around 3 BC. It led into the commercial agora, the busy market of the city.',
        tr: 'Sağda üç kemerli bir kapı duruyor. Azat edilmiş iki köle, Mazeus ve Mithridates, onu MÖ 3 civarında İmparator Augustus ve ailesine adadı. Kapı, kentin kalabalık pazar yeri olan ticari agoraya açılıyordu.',
      },
      camera: { position: [13.5, 3.2, 20], target: [8.5, 5.5, 5] },
      vr: [13, 15],
    },
    {
      title: { en: 'Ephesus Today', tr: 'Bugün Efes' },
      era: 'today',
      text: {
        en: 'Since 2015, Ephesus has been a UNESCO World Heritage Site. Next on our journey: Sardis, the capital of Lydia, and Aigai, which our participants will scan themselves in December.',
        tr: "Efes, 2015'ten beri UNESCO Dünya Mirası Listesi'nde. Yolculuğumuzun sonraki durakları: Lidya'nın başkenti Sardes ve katılımcılarımızın Aralık'ta kendi tarayacağı Aigai.",
      },
      camera: { position: [-24, 10, 36], target: [0, 7, 0] },
      duration: 12,
      vr: [0, 30],
    },
  ],
};
