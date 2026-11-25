// The cities of the virtual museum. Each site module exports its layout, monuments and tour.
export const SITES = [
  { id: 'ephesus', city: { en: 'Ephesus', tr: 'Efes' }, load: () => import('./ephesus.js').then((m) => m.ephesus) },
  { id: 'sardis', city: { en: 'Sardis', tr: 'Sardes' }, load: () => import('./sardis.js').then((m) => m.sardis) },
  { id: 'aigai', city: { en: 'Aigai', tr: 'Aigai' }, load: () => import('./aigai.js').then((m) => m.aigai) },
];

export async function loadSite(id) {
  return (SITES.find((s) => s.id === id) || SITES[0]).load();
}
