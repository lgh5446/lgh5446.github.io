import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(path.join(site, 'portfolio-media.json'), 'utf8'));
const htmlPath = path.join(site, 'index.html');
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
for (const name of ['src', 'poster']) {
  const absolute = path.resolve(site, config[name]);
  if (!absolute.startsWith(site) || !config[name].startsWith('assets/')) throw new Error(`Invalid local ${name}`);
  await access(absolute);
}
if (!(config.durationSeconds > 0) || !(config.shots > 0)) throw new Error('Measured duration and shot count are required.');
let html = await readFile(htmlPath, 'utf8');
let videoCount = 0;
html = html.replace(/<video\b[^>]*data-portfolio-film[^>]*>/g, (tag) => {
  videoCount++;
  for (const [name, value] of Object.entries({ src: config.src, poster: config.poster, 'aria-label': config.ariaLabel })) {
    tag = tag.replace(new RegExp(`\\b${name}="[^"]*"`), `${name}="${escape(value)}"`);
  }
  return tag;
});
for (const [name, key] of Object.entries({ label: 'label', meta: 'meta', action: 'action', 'story-meta': 'storyMeta', disclosure: 'disclosure' })) {
  const expression = new RegExp(`(<(?:span|p)[^>]*data-film-${name}(?:="")?[^>]*>)[\\s\\S]*?(<\\/(?:span|p)>)`, 'g');
  html = html.replace(expression, (_, open, close) => `${open}${escape(config[key])}${close}`);
}
html = html.replace(/(<a\b[^>]*data-film-download[^>]*href=")[^"]*(")/g, `$1${escape(config.src)}$2`);
if (videoCount !== 2) throw new Error(`Expected two film placements, found ${videoCount}.`);
await writeFile(htmlPath, html);
console.log(`Synced ${videoCount} film placements: ${config.durationSeconds}s / ${config.shots} shots / ${config.src}`);
