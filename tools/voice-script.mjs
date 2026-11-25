// Writes assets/voice/SCRIPT.md: the narration text of every chapter with the file name it should be saved as.
// Run: node tools/voice-script.mjs
import { writeFileSync } from 'node:fs';
import { ephesus } from '../src/sites/ephesus.js';

let md = '# Narration script\n\nGenerate one MP3 per chapter and save it under the given name. The tour plays it automatically; subtitles follow the audio.\n';
for (const lang of ['tr', 'en']) {
  const chars = ephesus.chapters.reduce((a, ch) => a + ch.text[lang].length, 0);
  md += `\n## ${lang.toUpperCase()} (${chars} characters)\n`;
  ephesus.chapters.forEach((ch, i) => {
    md += `\n### assets/voice/${lang}/${String(i + 1).padStart(2, '0')}.mp3 · ${ch.title[lang]}\n\n${ch.text[lang]}\n`;
  });
}
writeFileSync(new URL('../assets/voice/SCRIPT.md', import.meta.url), md);
console.log(md.split('\n').filter((l) => l.startsWith('## ')).join('\n'));
