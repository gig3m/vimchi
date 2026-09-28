// Headless screenshot helper for local checks.
// usage: node scripts/shot.mjs <url> <out.png> [keys] [width] [height]
import { chromium } from 'playwright-core';

const [url, out, keys = '', w = '1400', h = '1000'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'load' });
if (keys) {
  await page.focus('.editor');
  for (const k of keys.split(' ')) await page.keyboard.press(k);
}
await page.evaluate(() => document.querySelector('.editor')?.scrollIntoView({ block: 'center' }));
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
