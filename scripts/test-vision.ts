// Usage: npx tsx scripts/test-vision.ts — Google Vision response -> lines -> items
import assert from 'node:assert/strict';
import { parseReceipt, toRows } from '../src/receipt';
import { visionToLines, type VisionResponse } from '../src/vision';

// Builds a Vision-shaped response: one paragraph per printed line, words with boxes.
function vision(rows: { y: number; words: [string, number, number][] }[], tilt = 0): VisionResponse {
  const paragraphs = rows.map((r) => ({
    words: r.words.map(([text, x0, x1], i) => {
      const y = r.y + tilt * x0;
      return {
        symbols: [...text].map((c, k, all) => ({ text: c, property: k === all.length - 1 && i === r.words.length - 1 ? { detectedBreak: { type: 'LINE_BREAK' } } : undefined })),
        boundingBox: { vertices: [{ x: x0, y }, { x: x1, y }, { x: x1, y: y + 30 }, { x: x0, y: y + 30 }] },
      };
    }),
  }));
  return { responses: [{ fullTextAnnotation: { pages: [{ blocks: [{ paragraphs }] }] } }] };
}

// Soufi receipt: Arabic names, columns total | price | name | qty (right to left).
const soufi = vision([
  { y: 100, words: [['soufi', 400, 560]] },
  { y: 200, words: [['Le', 290, 320], [':', 325, 330], ['12-11-2026', 350, 500], ['[19:21]', 510, 590]] },
  { y: 300, words: [['28.00', 330, 410], ['28.00', 440, 520], ['1لتر', 700, 760], ['كاسطرو', 770, 860], ['كريم', 870, 880], ['1', 915, 925]] },
  { y: 345, words: [['7.00', 350, 410], ['7.00', 460, 520], ['180غ', 700, 760], ['مايفين', 770, 870], ['1', 915, 925]] },
  { y: 390, words: [['18.00', 330, 410], ['9.00', 460, 520], ['غ', 660, 670], ['250', 680, 720], ['صنية', 730, 800], ['شعرية', 810, 870], ['2', 915, 925]] },
  { y: 435, words: [['10.80', 330, 410], ['240.00', 430, 520], ['عبار', 720, 780], ['اسود', 790, 850], ['فطر', 860, 880], ['0.04', 910, 950]] },
  { y: 480, words: [['7.00', 350, 410], ['7.00', 460, 520], ['Article', 790, 870], ['1', 915, 925]] },
  { y: 600, words: [['Total', 300, 380], [':', 385, 390], ['71.80', 650, 740], ['(', 760, 765], ['Dhs', 770, 820], [')', 830, 835]] },
], 0.03);
const lines = visionToLines(soufi);
const res = parseReceipt(toRows(lines));
assert.equal(res.total, 71.8);
assert.equal(res.date, '2026-11-12');
assert.deepEqual(res.items.map((i) => [i.name, i.qty, i.unitPrice, !!i.unnamed]), [
  ['كريم كاسطرو 1لتر', 1, 28, false],
  ['مايفين 180غ', 1, 7, false],
  ['شعرية صنية 250 غ', 2, 9, false],
  ['فطر اسود عبار', 0.045, 240, false],
  ['Article à nommer', 1, 7, true],
]);

// French receipt through Vision: name and price far apart on the same printed line become two pieces.
const bim = vision([
  { y: 50, words: [['BIM', 400, 480], ['MAROC', 500, 640]] },
  { y: 150, words: [['PILES', 220, 300], ['LR03', 310, 380], ['4PC', 390, 440], ['POWER', 450, 550], ['%20', 610, 660], ['*12.50', 770, 880]] },
  { y: 200, words: [['TOTAL', 220, 300], ['*12.50', 730, 840], ['DH', 850, 880]] },
  { y: 240, words: [['DROITS', 220, 300], ['DE', 310, 340], ['TIMBRE', 350, 470], ['*0.03', 760, 840], ['DH', 850, 880]] },
  { y: 300, words: [['TOTAL', 220, 300], ['TTC', 310, 360], ['*12.53', 730, 840], ['DH', 850, 880]] },
], -0.02);
const r2 = parseReceipt(toRows(visionToLines(bim)));
assert.deepEqual(r2.items.map((i) => [i.name, i.unitPrice]), [['Piles LR03 4PC Power', 12.5], ['Droit de timbre', 0.03]]);
assert.equal(r2.total, 12.53);

// API errors are reported, not swallowed
assert.throws(() => visionToLines({ responses: [{ error: { message: 'API key not valid' } }] }), /API key not valid/);
console.log('Google Vision checks passed.');
