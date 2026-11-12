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

// ---- Real Carrefour Market receipt (12/11/2026): group subtotals in bold, article codes, weighed line ----
{
  const R = (text: string, top: number, left = 10): OcrLine => ({ text, top, left, height: 18 });
  const lines: OcrLine[] = [
    R('Carrefour', 380, 350), R('market', 430, 460), R('LabelVie', 495, 600),
    R('Carrefour Market', 570, 435), R('EL HOUDA', 603, 480), R('ICE 000078523000008', 637, 420),
    R('P.N : 25900525', 668, 445), R('Tel 05 28 32 25 69', 698, 425),
    R('12/11/2026 - 19:51:56', 800, 315), R('8 2 66238', 798, 630),
    R('OPERATION : VENTE', 868, 435),
    R('(4)2000002693406', 905, 225), R('FILET COLIN ALASKA B', 903, 435), R('34.90', 900, 750),
    R('SURGELE', 938, 225), R('34.90', 938, 470),
    R('(1)2700997030582', 972, 225), R('EDAM BOULE FRICO AU', 971, 437), R('30.58', 967, 752),
    R('(1)2707827014620', 1006, 225), R('FROMAGE FUME NATURE', 1004, 437), R('14.62', 999, 752),
    R('FROMAGERIE', 1041, 225), R('45.20', 1041, 472),
    R('(1)7622202376115', 1072, 225), R('CHEWING GUM ORIGINAL', 1070, 438), R('3.95', 1065, 767),
    R('BISCUITERIE', 1109, 222), R('3.95', 1109, 472),
    R('(4)2303641', 1140, 225), R('CHAMPIGNON DE PARIS', 1138, 440), R('32.62', 1131, 757),
    R('0.628 kg x 51.95 MAD/kg', 1174, 320),
    R('FRUITS ET LEGUMES', 1208, 222), R('32.62', 1208, 472),
    R('PAIEMENT', 1268, 490),
    R('TOTAL :', 1308, 218), R('116.96', 1291, 760),
    R('DONT DOIT DE TIMBRE : 0.29', 1343, 218),
    R('200.00', 1393, 762), R('ESPECES', 1416, 216), R('0.29', 1431, 787),
    R('DROITS TIMBRE', 1451, 216), R('83.04', 1468, 778), R('Rendu (ESPECES)', 1488, 218),
    R('NOMBRE ARTICLES : 5', 1562, 215), R('Club Carrefour', 1592, 460),
    R('Ancien Solde : 307 Points', 1670, 400),
    R('VENTILATION PAR TAUX TVA', 1880, 210),
    R('CODE', 1922, 208), R('TOT.HT', 1919, 316), R('TAUX', 1917, 449), R('T.V.A', 1914, 568), R('T.T.C', 1911, 697),
    R('4', 1965, 210), R('67.5200', 1962, 304), R('0.00%', 1959, 437), R('0.0000', 1955, 557), R('67.52', 1952, 700),
    R('1', 2007, 210), R('40.9583', 2005, 304), R('20.00%', 2001, 434), R('8.1917', 1997, 560), R('49.15', 1994, 700),
    R('TOTAL', 2050, 208), R('8.1917', 2042, 560), R('116.67', 2038, 693),
    R('50 DH OFFERTS SUR VOS COURSES EN LIGNE !', 2285, 310), R('Code Promo : WELCOME', 2398, 425),
  ];
  const res = parseReceipt(toRows(lines));
  assert.equal(res.store, 'Carrefour Market');
  assert.equal(res.date, '2026-11-12');
  assert.equal(res.total, 116.96);
  assert.deepEqual(
    res.items.map((i) => [i.name, i.qty, i.unitPrice, i.unit]),
    [
      ['Filet Colin Alaska B', 1, 34.9, 'pièce'],
      ['Edam Boule Frico Au', 1, 30.58, 'pièce'],
      ['Fromage Fume Nature', 1, 14.62, 'pièce'],
      ['Chewing Gum Original', 1, 3.95, 'pièce'],
      ['Champignon De Paris', 0.628, 51.95, 'kg'],
    ],
  );
  console.log('Carrefour receipt read:', res.items.length, 'items, total', res.total);
}

// ---- Same Carrefour receipt with typical camera misreads ----
{
  const rows = [
    'Carrefour Market', 'EL HOUDA', '12/11/2026 - 19:51:56',
    '(4)2000002693406  FILET COLIN ALASKA B  34.90',
    'SURGELE  34.90',
    '(1)27009970305B2  EDAM BOULE FRICO AU  30.58', // 8 read as B
    '1)2707827014620  FROMAGE FUME NATURE  14,62', // lost "(" and comma price
    'FROMAGERIE  45.20',
    '(l)7622202376115  CHEWING GUM ORIGINAL  3.95', // 1 read as l
    'BISCUITERIE  3.95',
    '(4)2303641 CHAMPIGNON DE PARIS  32.62',
    '0.628 kg x 51.95 MAD/kg',
    'FRUITS ET LEGUMES  32.62',
    '116.96', 'TOTAL :', 'NOMBRE ARTICLES : 5',
  ];
  const res = parseReceipt(rows);
  assert.deepEqual(res.items.map((i) => i.name), ['Filet Colin Alaska B', 'Edam Boule Frico Au', 'Fromage Fume Nature', 'Chewing Gum Original', 'Champignon De Paris']);
  assert.equal(res.expected, 5);
}

// ---- A product whose code was not read at all must still be kept, and a group line must not become a product ----
{
  const rows = [
    'Carrefour Market',
    '(4)2000002693406  FILET COLIN ALASKA B  34.90',
    'SURGELE  34.90',
    'EDAM BOULE FRICO AU  30.58', // code missing entirely
    '(1)2707827014620  FROMAGE FUME NATURE  14.62',
    'FROMAGERIE  45.20',
    'NOMBRE ARTICLES : 3',
  ];
  const res = parseReceipt(rows);
  assert.deepEqual(res.items.map((i) => i.name), ['Filet Colin Alaska B', 'Edam Boule Frico Au', 'Fromage Fume Nature']);
}

// ---- Group line read without its amount matching (an item before it was missed) is still not a product ----
{
  const res = parseReceipt(['(1)2707827014620  FROMAGE FUME NATURE  14.62', 'FROMAGERIE  45.20', '(1)7622202376115  CHEWING GUM  3.95']);
  assert.deepEqual(res.items.map((i) => i.name), ['Fromage Fume Nature', 'Chewing Gum']);
}
console.log('Misread checks passed.');
