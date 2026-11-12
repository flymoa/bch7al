// Usage: npx tsx scripts/test-receipt.ts
import assert from 'node:assert/strict';
import { parseReceipt, toRows, type OcrLine } from '../src/receipt';

// Name and price arrive as separate OCR lines on the same row, like a real receipt.
const L = (text: string, top: number, left = 10): OcrLine => ({ text, top, left, height: 20 });
const lines: OcrLine[] = [
  L('MARJANE HAY RIAD', 10), L('Rabat - Tel 0537 00 00 00', 35),
  L('Date: 09/11/2026 18:42', 60),
  L('LAIT CENTRALE 1L', 100), L('45,00', 101, 300), L('6 x 7,50', 125),
  L('HUILE LESIEUR 5L', 150), L('98.00', 152, 300),
  L('TOMATES', 175), L('0,750 kg x 8,00', 176, 150), L('6,00', 177, 300),
  L('6111245590018 SUCRE 2KG', 200), L('21,00 DH', 200, 300),
  L('REMISE TOTALE', 225), L('-2,00', 226, 300),
  L('SOUS TOTAL', 250), L('168,00', 250, 300),
  L('TOTAL', 275), L('168,00', 276, 300),
  L('ESPECES', 300), L('200,00', 300, 300),
  L('RENDU', 325), L('32,00', 325, 300),
];
const rows = toRows(lines);
assert.equal(rows[3], 'LAIT CENTRALE 1L  45,00');
const r = parseReceipt(rows);
assert.equal(r.store, 'Marjane');
assert.equal(r.date, '2026-11-09');
assert.equal(r.total, 168);
assert.deepEqual(r.items.map((i) => i.name), ['Lait Centrale 1L', 'Huile Lesieur 5L', 'Tomates', 'Sucre 2KG']);
assert.deepEqual([r.items[0].qty, r.items[0].unitPrice], [6, 7.5], 'detail line under the product');
const byName = Object.fromEntries(r.items.map((i) => [i.name.toLowerCase(), i]));
assert.equal(byName['huile lesieur 5l'].unitPrice, 98);
assert.deepEqual([byName['tomates'].qty, byName['tomates'].unitPrice, byName['tomates'].unit], [0.75, 8, 'kg']);
assert.equal(byName['sucre 2kg'].unitPrice, 21, 'barcode is stripped from the name');
assert.ok(!r.items.some((i) => /total|espece|rendu|remise/i.test(i.name)), 'totals and payment lines are skipped');

// quantity written on the line itself
const r2 = parseReceipt(['BIM', '12-11-26', 'Yaourt nature 4 x 2,50 10,00', 'Pain 1,20', 'TOTAL A PAYER 11,20']);
assert.equal(r2.store, 'BIM');
assert.equal(r2.date, '2026-11-12');
assert.deepEqual(r2.items, [{ name: 'Yaourt nature', qty: 4, unitPrice: 2.5, unit: 'pièce' }, { name: 'Pain', qty: 1, unitPrice: 1.2, unit: 'pièce' }]);
assert.equal(r2.total, 11.2);

// "6 x 7,50" printed on the line after the product
const r3 = parseReceipt(['Lait Centrale 45,00', '6 x 7,50']);
assert.deepEqual(r3.items, [{ name: 'Lait Centrale', qty: 6, unitPrice: 7.5, unit: 'pièce' }]);
const r4 = parseReceipt(['2 x 3,00', 'Eau Sidi Ali 6,00']);
assert.deepEqual(r4.items, [{ name: 'Eau Sidi Ali', qty: 2, unitPrice: 3, unit: 'pièce' }], 'detail line before the product');

// nothing readable
assert.deepEqual(parseReceipt(['merci de votre visite']).items, []);
console.log('All receipt checks passed.', r.items.length, 'items:', r.items.map((i) => `${i.name} ${i.qty}×${i.unitPrice}`).join(' | '));
