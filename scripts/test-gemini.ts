// Usage: npx tsx scripts/test-gemini.ts — Gemini reply -> articles
import assert from 'node:assert/strict';
import { geminiText, geminiToReceipt } from '../src/gemini';

const reply = (text: string) => ({ status: 'completed', steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text }] }] });

// Arabic receipt, a weight whose printed quantity is rounded, a nameless line, stamp duty twice
const soufi = geminiToReceipt(geminiText(reply('```json\n' + JSON.stringify({
  store: 'SOUFI alimentation', date: '2026-11-12', total: 71.88, article_count: 5,
  items: [
    { name: 'كريم كاسطرو 1لتر', qty: 1, unit: 'piece', unit_price: 28, line_total: 28 },
    { name: 'شعرية صنية 250 غ', qty: 2, unit: 'piece', unit_price: 9, line_total: 18 },
    { name: 'فطر اسود عبار', qty: 0.04, unit: 'kg', unit_price: 240, line_total: 10.8 },
    { name: '', qty: 1, unit: 'piece', unit_price: 7, line_total: 7 },
    { name: 'TOTAL', qty: 1, unit: 'piece', unit_price: 63.8, line_total: 63.8 },
    { name: 'Droits de timbre', qty: 1, unit: 'piece', unit_price: 0.08, line_total: 0.08 },
    { name: 'DONT DROIT DE TIMBRE', qty: 1, unit: 'piece', unit_price: 0.08, line_total: 0.08 },
  ],
}) + '\n```')));
assert.equal(soufi.store, 'Soufi');
assert.equal(soufi.date, '2026-11-12');
assert.equal(soufi.total, 71.88);
assert.equal(soufi.expected, 5);
assert.deepEqual(soufi.items.map((i) => [i.name, i.qty, i.unitPrice, i.unit, !!i.unnamed]), [
  ['كريم كاسطرو 1لتر', 1, 28, 'pièce', false],
  ['شعرية صنية 250 غ', 2, 9, 'pièce', false],
  ['فطر اسود عبار', 0.045, 240, 'kg', false],
  ['Article à nommer', 1, 7, 'pièce', true],
]);
assert.equal(soufi.stamp, 0.08, 'stamp duty is kept apart, once');

// A wrong unit price is corrected from the printed line amount; strings and commas are accepted
const fix = geminiToReceipt('{"store":"Carrefour Market Agadir","date":"12/11/2026","total":"15,00","article_count":null,"items":[{"name":"LAIT UHT","qty":"3","unit":"piece","unit_price":"4,50","line_total":"15,00"},{"name":"x","qty":1,"unit":"piece","unit_price":0,"line_total":0}]}');
assert.equal(fix.store, 'Carrefour Market');
assert.equal(fix.date, null);
assert.equal(fix.total, 15);
assert.deepEqual(fix.items.map((i) => [i.name, i.qty, i.unitPrice]), [['LAIT UHT', 3, 5]]);

// Older reply shape, error replies, and junk
assert.equal(geminiText({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), 'ok');
assert.throws(() => geminiText({ error: { message: 'API key not valid' } }), /API key not valid/);
assert.throws(() => geminiToReceipt('désolé'), /liste/);
// The new reply shape: stamp duty in its own field
const own = geminiToReceipt('{"store":"BIM","date":null,"total":8.98,"article_count":1,"stamp_duty":0.08,"items":[{"name":"GAUFRETTE","qty":1,"unit":"piece","unit_price":8.9,"line_total":8.9}]}');
assert.deepEqual([own.items.length, own.stamp], [1, 0.08]);
// Not on the ticket: never guessed from the total
const inferred = geminiToReceipt('{"store":"BIM","date":null,"total":100.25,"article_count":1,"stamp_duty":null,"items":[{"name":"HUILE","qty":1,"unit":"piece","unit_price":100,"line_total":100}]}');
assert.equal(inferred.stamp, null);
// Paid by card: total = articles, no stamp
assert.equal(fix.stamp, null);
console.log('gemini: ok');
