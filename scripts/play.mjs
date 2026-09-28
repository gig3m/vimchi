// Play a lesson headlessly: node scripts/play.mjs <lesson-id> <out.png> "<keys per round, | separated>"
import { chromium } from 'playwright-core';

const [id, out, script] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://localhost:5317/#${id}`, { waitUntil: 'load' });
await page.focus('.editor');
for (const round of script.split('|')) {
  for (const k of round.trim().split(' ').filter(Boolean)) {
    await page.keyboard.press(k);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(600);
}
await page.evaluate(() => document.querySelector('.editor')?.scrollIntoView({ block: 'center' }));
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
