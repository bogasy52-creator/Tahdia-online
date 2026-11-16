// Renders every flag in flags.js to <out>/<name>.png at 1350 × 900, and the
// flag's box on the picture (fractions) to <out>/boxes.json for the zoom focus.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [, , outDir] = process.argv;
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(); const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, 'studio.html')); await page.waitForFunction(() => window.ready);
  const names = await page.evaluate(() => Object.keys(window.QUIZ_FLAGS)); const boxes = {};
  for (const [i, name] of names.entries()) {
    const { url, box } = await page.evaluate(([n, s]) => window.renderFlag(n, s), [name, i % 5]);
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    boxes[name] = box;
  }
  fs.writeFileSync(path.join(outDir, 'boxes.json'), JSON.stringify(boxes, null, 1));
  console.log(names.length + ' flags'); if (errors.length) console.log(errors.join('\n'));
  await browser.close();
})();
