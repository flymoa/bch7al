// Turns the text read from a receipt photo into items. Pure logic, tested in Node.
import { DEFAULT_STORES } from './theme-constants';

export type OcrLine = { text: string; top: number; left: number; height: number; width?: number };
export type ReceiptItem = {
  name: string;
  qty: number;
  unitPrice: number;
  unit: 'pièce' | 'kg';
  /** The name could not be read (Arabic receipts): the user has to type it. */
  unnamed?: boolean;
};

export const UNNAMED = 'Article à nommer';
export const STAMP_DUTY = 'Droit de timbre';
export type ReceiptResult = {
  store: string | null;
  date: string | null;
  items: ReceiptItem[];
  total: number | null;
  /** "NOMBRE ARTICLES : 5" when the receipt prints it. */
  expected: number | null;
  /** The rows as read, to show the user what the camera saw. */
  rows: string[];
  /** Droit de timbre (cash payment tax): kept on the trip, never a product. */
  stamp: number | null;
};

/** Moroccan stamp duty on cash payments: 0.25 % of the amount. */
export const STAMP_RATE = 0.0025;

/**
 * When the stamp line was not read but the ticket total is the articles plus 0.25 %,
 * the difference is the stamp duty. Anything else is left alone (a misread, a discount).
 */
export function inferStamp(items: ReceiptItem[], total: number | null, stamp: number | null): number | null {
  if (stamp !== null && stamp > 0) return Math.round(stamp * 100) / 100;
  if (total === null) return null;
  const lines = items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
  const gap = Math.round((total - lines) * 100) / 100;
  return gap > 0 && Math.abs(gap - lines * STAMP_RATE) <= 0.02 ? gap : null;
}

// Article code at the start of a line, tolerant of camera misreads:
// "(4)2000002693406", "1)2707827014620", "(l)7622202376115", "(1)27009970305B2".
const CODE = /^\s*[(\[{]?\s*[0-9lI|!]\s*[)\]}]\s*[0-9OoBSIl|]{5,}\s*|^\s*[0-9OoBSIl|]{8,}\s+/;

// Supermarket departments printed as group subtotals (Carrefour, Marjane...).
const DEPARTMENTS = /^(surgel[eé]s?|fromagerie|biscuiterie|fruits? et l[eé]gumes|boucherie|charcuterie|traiteur|cr[eè]merie|[eé]picerie( sal[eé]e| sucr[eé]e)?|boissons?|liquides?|droguerie|parfumerie|hygi[eè]ne|entretien|boulangerie|p[aâ]tisserie|viennoiserie|poissonnerie|volaille|produits? frais|frais|laitiers?|bazar|textile|confiserie|petit d[eé]jeuner|conserves?|surgel[eé]s? sal[eé]s|b[eé]b[eé]|animaux|electrom[eé]nager|multim[eé]dia)$/i;

const KNOWN_STORES = [...DEFAULT_STORES, 'Acima', 'Aswak Assalam', 'Label Vie', 'Carrefour Market', 'Kazyon', 'Atacadao', 'Soufi'].sort((a, b) => b.length - a.length);

// Lines that are never products.
const SKIP = /\b(total|sous[- ]?total|tva|t\.v\.a|ht|ttc|esp[eè]ces?|rendu|monnaie|carte|cb|visa|cash|ticket|caisse|caissier|merci|client|fid[eé]lit[eé]|points?|remise totale|net a payer|net à payer|a payer|à payer|montant|change|tel|t[eé]l[eé]phone|ice|patente|rc|if\b|cnss|adresse|capital|fiscal|editeur|cache|client divers|www|http|articles?|nombre|qt[eé] totale|solde|avoir|recu|reçu|facture|date|heure|n°|no\.|t[il1|][mnh]{1,2}bre|droits?|operation|vente|ventilation|taux|code promo|solde|offerts?|bienvenue|paiement)/i;

const PRICE = /(-?\d{1,5}(?:[ .]\d{3})*[.,]\d{2})\s*(?:\(?\s*(?:dh|dhs|mad)\s*\)?|€)?\s*[a-z]?$/i;
const STAMP = /^(?:dont\s*)?(?:dr?oits?)\s*(?:de\s*)?t[il1|][mnh]{1,2}bre/i;
const MONEY = /(?<![\d.,])\d{1,5}[.,]\d{2}(?![\d])/g;

/** Removes printing marks that are not part of names or prices: "*12.50", VAT codes "%20" / "Z20". */
function tidy(row: string): string {
  return row
    .replace(/\bT\s+O\s+T\s+A\s+L\b/gi, 'TOTAL')
    // a star misread as "x" or "+" at the start of a column (columns are joined with two spaces)
    .replace(/(^|\s{2,})[x+](?=-?\d+[.,]\d{2}\b)/gi, '$1')
    .replace(/\*\s*(?=-?\d)/g, '')
    .replace(/(^|\s)[%Z]\s?\d{1,2}\.?(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Weights like "0.628" or "1,250": the dot is a decimal point here, never a thousands separator. */
function weight(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

function num(s: string): number {
  return parseFloat(s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
}

/**
 * Groups OCR lines that sit on the same printed row (name on the left, price on the right).
 * Photos are often slightly tilted, so a price can sit a full line higher or lower than its
 * name. We try a range of tilts and keep the one that lines the text up into the fewest,
 * tightest rows, then group lines along that tilt.
 */
/** The app's spelling of a store named anywhere in this text, or null. */
export function knownStore(text: string): string | null {
  const head = text.toLowerCase();
  return KNOWN_STORES.find((name) => head.includes(name.toLowerCase())) ?? null;
}

export function toRows(lines: OcrLine[]): string[] {
  const ls = lines.filter((l) => l.text.trim());
  if (ls.length === 0) return [];
  const heights = ls.map((l) => l.height).sort((a, b) => a - b);
  const h = heights[Math.floor(heights.length / 2)] || 20;
  const cx = (l: OcrLine) => l.left + (l.width ?? 0) / 2;
  const cy = (l: OcrLine) => l.top + l.height / 2;

  const group = (slope: number) => {
    const items = ls.map((l) => ({ l, y: cy(l) - slope * cx(l) })).sort((a, b) => a.y - b.y);
    const rows: { y: number; members: typeof items }[] = [];
    for (const it of items) {
      const row = rows[rows.length - 1];
      // join the current row while the line stays within half a line of the row's average height
      if (row && Math.abs(it.y - row.y) < h * 0.5 && !row.members.some((m) => overlapsX(m.l, it.l))) {
        row.members.push(it);
        row.y = row.members.reduce((a, m) => a + m.y, 0) / row.members.length;
      } else rows.push({ y: it.y, members: [it] });
    }
    const spread = rows.reduce((a, r) => a + r.members.reduce((b, m) => b + Math.abs(m.y - r.y), 0), 0);
    return { rows, cost: rows.length + spread / (h * 4) };
  };

  let best = group(0);
  for (let i = -30; i <= 30; i++) {
    const slope = i * 0.004; // up to about ±7°
    const g = group(slope);
    if (g.cost < best.cost - 0.01) best = g;
  }
  return best.rows.map((r) => r.members.map((m) => m.l).sort((a, b) => a.left - b.left).map((l) => l.text.trim()).join('  '));
}

/** Two pieces of text that overlap horizontally cannot be on the same printed row. */
function overlapsX(a: OcrLine, b: OcrLine): boolean {
  if (a.width === undefined || b.width === undefined) return false;
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.left + a.width, b.left + b.width);
  return right - left > Math.min(a.width, b.width) * 0.3;
}

function cleanItemName(raw: string): string {
  return raw
    .replace(CODE, '') // article code / barcode, even partly misread
    .replace(/[*#=_|]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** "LAIT CENTRALE 1L" -> "Lait Centrale 1L" (receipts print in capitals). */
function softenCaps(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .split(' ')
    .map((w) => (/\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

export function parseReceipt(rawRows: string[]): ReceiptResult {
  const rows = rawRows.map(tidy);
  let store: string | null = null;
  const head = rows.slice(0, 8).join(' ').toLowerCase();
  store = KNOWN_STORES.find((name) => head.includes(name.toLowerCase())) ?? null; // longest name first

  let date: string | null = null;
  for (const r of rows) {
    const m = r.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
    if (m) {
      const d = Number(m[1]), mo = Number(m[2]);
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) {
        date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        break;
      }
    }
  }

  let total: number | null = null;
  // The total amount is sometimes printed just above or below the word "TOTAL".
  for (let i = 0; i < rows.length && total === null; i++) {
    if (!/^\s*total\s*:?\s*$/i.test(rows[i])) continue;
    for (const j of [i - 1, i + 1]) {
      const m = rows[j]?.trim().match(/^(\d{1,5}(?:[ .]\d{3})*[.,]\d{2})\s*(?:dh|dhs|mad)?$/i);
      if (m) { total = num(m[1]); break; }
    }
  }
  const items: ReceiptItem[] = [];
  let pendingQty: { qty: number; unitPrice: number } | null = null;
  let expected: number | null = null;
  let stamp: number | null = null;
  let sawTotal = false;
  // A product line without a price; its "2 x 2.50  5.00" comes on the next line (Marjane).
  let pendingName: string | null = null;
  // Amount of the articles since the last group subtotal (e.g. "FROMAGERIE 45.20").
  let sinceGroup = 0;
  // Receipts that print an article code on each line (Carrefour) also print group subtotals.
  const codedReceipt = rows.filter((r) => CODE.test(r)).length >= 2;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (!row) continue;

    const count = row.match(/nombre\s*(?:d'?\s*)?articles?\s*:?\s*(\d{1,3})|articles?\s*:\s*(\d{1,3})\s*-?\s*articles?/i);
    if (count) {
      expected = Number(count[1] ?? count[2]);
      continue;
    }

    if (/\b(total|net [aà] payer|[aà] payer)\b/i.test(row) && !/sous/i.test(row)) {
      const m = row.match(PRICE);
      // "TOTAL TTC" / "NET A PAYER" is what was paid; a plain "TOTAL" may come before the stamp duty.
      if (m && (total === null || /ttc|payer/i.test(row))) total = num(m[1]);
      sawTotal = true;
      continue;
    }

    // Stamp duty is part of what was paid, but it is a tax, not an article: kept apart.
    if (STAMP.test(row)) {
      let amount = row.match(/(\d+[.,]\d{2})\s*(?:dh|dhs|mad)?\s*$/i)?.[1] ?? null;
      for (const j of [idx + 1, idx - 1]) {
        if (amount) break;
        amount = rows[j]?.match(/^\s*(\d+[.,]\d{2})\s*(?:dh|dhs|mad)?\s*$/i)?.[1] ?? null;
      }
      if (amount && num(amount) > 0 && stamp === null) stamp = num(amount);
      continue;
    }
    // A lone amount next to the stamp duty label belongs to it.
    if (/^\d+[.,]\d{2}\s*(?:dh|dhs|mad)?$/i.test(row) && (STAMP.test(rows[idx - 1] ?? '') || STAMP.test(rows[idx + 1] ?? ''))) continue;

    // "0.628 kg x 51.95 MAD/kg" printed under a weighed article
    const weightLine = row.match(/^(\d+[.,]\d{1,3})\s*kg\s*[x×*@]\s*(\d+[.,]\d{2})\s*(?:mad|dh|dhs)?\s*(?:\/\s*kg)?$/i);
    if (weightLine) {
      const last = items[items.length - 1];
      if (last && last.unit === 'pièce' && last.qty === 1) {
        last.qty = weight(weightLine[1]);
        last.unitPrice = num(weightLine[2]);
        last.unit = 'kg';
      }
      continue;
    }

    // "2 x 7,50" on its own line, applying to the next product line
    const qtyOnly = row.match(/^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})\s*$/i);
    if (qtyOnly) {
      const q = num(qtyOnly[1]);
      const u = num(qtyOnly[2]);
      const last = items[items.length - 1];
      // Usually printed under the product: it belongs to it when the amounts add up.
      if (last && last.qty === 1 && last.unit === 'pièce' && Math.abs(last.unitPrice - q * u) < 0.05) {
        last.qty = q;
        last.unitPrice = u;
      } else {
        pendingQty = { qty: q, unitPrice: u };
      }
      continue;
    }

    // Tax tables and similar number-only rows are not articles.
    if (/\d[.,]\d{4}/.test(row)) continue;
    if (/%/.test(row) && !/[a-zà-ÿ]{3,}/i.test(row)) continue;

    // Marjane: "2 x 2.50  5.00" under a product line that had no price.
    const qtyTotal = row.match(/^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i);
    if (qtyTotal && pendingName) {
      const q = weight(qtyTotal[1]);
      const u = num(qtyTotal[2]);
      items.push({ name: pendingName, qty: q, unitPrice: u, unit: Number.isInteger(q) ? 'pièce' : 'kg' });
      sinceGroup += num(qtyTotal[3]);
      pendingName = null;
      continue;
    }

    // Right-to-left receipts start the row with numbers: "total  price  name  qty".
    if (/^\d/.test(row)) {
      const col = columnRow(row);
      if (col) {
        items.push(col);
        sinceGroup += col.qty * col.unitPrice;
        continue;
      }
    }

    const pm = row.match(PRICE);
    if (!pm && CODE.test(row) && !sawTotal) {
      const n = softenCaps(cleanItemName(row));
      if (/[a-zà-ÿ]{2,}/i.test(n)) pendingName = n;
      continue;
    }
    if (!pm) {
      const col = columnRow(row);
      if (col) {
        items.push(col);
        sinceGroup += col.qty * col.unitPrice;
      }
      continue;
    }
    const lineTotal = num(pm[1]);
    let left = row.slice(0, pm.index).trim();
    if (SKIP.test(left) || lineTotal <= 0 || lineTotal > 100000) continue;
    const hasCode = CODE.test(left);
    // Group subtotal ("FROMAGERIE 45.20"): a department name, or an uncoded line whose
    // amount equals the articles since the previous group.
    const byAmount = codedReceipt && !/\d/.test(left) && sinceGroup > 0 && Math.abs(lineTotal - sinceGroup) < 0.02;
    if (!hasCode && (DEPARTMENTS.test(left.trim()) || byAmount)) {
      sinceGroup = 0;
      continue;
    }

    let qty = 1;
    let unitPrice = lineTotal;
    let unit: 'pièce' | 'kg' = 'pièce';
    // "Lait 1L 6 x 7,50 45,00" or "Lait 1L 6 X 7.50"
    const inline = left.match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})\s*$/i);
    // weight "0,750 kg x 8,00"
    const weighed = left.match(/(\d+[.,]\d{1,3})\s*kg\s*[x×*@]?\s*(\d+[.,]\d{2})?\s*$/i);
    if (inline) {
      qty = num(inline[1]);
      unitPrice = num(inline[2]);
      left = left.slice(0, inline.index).trim();
    } else if (weighed) {
      qty = weight(weighed[1]);
      unitPrice = weighed[2] ? num(weighed[2]) : lineTotal / qty;
      unit = 'kg';
      left = left.slice(0, weighed.index).trim();
    } else if (pendingQty) {
      qty = pendingQty.qty;
      unitPrice = pendingQty.unitPrice;
    }
    pendingQty = null;

    const name = softenCaps(cleanItemName(left));
    if (!/[a-zà-ÿ]{2,}/i.test(name)) continue;
    if (SKIP.test(name)) continue;
    if (!(qty > 0) || !(unitPrice >= 0)) continue;
    items.push({ name, qty: Math.round(qty * 1000) / 1000, unitPrice: Math.round(unitPrice * 100) / 100, unit });
    sinceGroup += lineTotal;
  }

  return { store, date, items, total, expected, rows: rawRows, stamp: inferStamp(items, total, stamp) };
}

/**
 * A row made of columns "total  unit price  [name]  quantity", as on receipts printed
 * right to left (Arabic). The camera reads the numbers; the name usually cannot be read.
 */
function columnRow(row: string): ReceiptItem | null {
  if (/total|rendu|cache|esp[eè]ces|tva|timbre|monnaie|carte/i.test(row)) return null;
  const amounts = [...row.matchAll(MONEY)].map((m) => num(m[0]));
  if (amounts.length < 2) return null;
  const tail = row.match(/(\d+(?:[.,]\d{1,3})?)\s*$/);
  if (!tail) return null;
  const q = weight(tail[1]);
  const [a, b] = amounts;
  for (const [lineTotal, unitPrice] of [[a, b], [b, a]]) {
    if (!(lineTotal > 0) || !(unitPrice > 0) || !(q > 0)) continue;
    const whole = Number.isInteger(q);
    // Whole quantities must add up exactly; weights are often printed cut short (0.04 for 0.045).
    const ok = whole ? Math.abs(q * unitPrice - lineTotal) < 0.05 : Math.abs(q * unitPrice - lineTotal) <= Math.max(0.02, lineTotal * 0.2);
    if (!ok) continue;
    const qty = whole ? q : Math.round((lineTotal / unitPrice) * 1000) / 1000;
    const rest = row
      .replace(MONEY, ' ')
      // the last number is the quantity column; other numbers belong to the name ("250 غ")
      .replace(/\d+(?:[.,]\d{1,3})?\s*$/, ' ')
      .replace(/[^\p{L}\d\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // On-device reading drops Arabic names (nothing or stray letters); the online reader keeps them.
    // "Article" is a placeholder printed by some tills.
    const arabicName = /[\u0600-\u06FF]{2,}/.test(rest);
    const readable = (arabicName || /[a-zà-ÿ]{4,}/i.test(rest)) && !/^articles?$/i.test(rest);
    return {
      name: readable ? (arabicName ? rest : softenCaps(rest.replace(/^./, (c) => c.toUpperCase()))) : UNNAMED,
      qty,
      unitPrice: Math.round(unitPrice * 100) / 100,
      unit: whole ? 'pièce' : 'kg',
      unnamed: !readable,
    };
  }
  return null;
}
