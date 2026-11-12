// Turns the text read from a receipt photo into items. Pure logic, tested in Node.
import { DEFAULT_STORES } from './theme-constants';

export type OcrLine = { text: string; top: number; left: number; height: number };
export type ReceiptItem = { name: string; qty: number; unitPrice: number; unit: 'pièce' | 'kg' };
export type ReceiptResult = {
  store: string | null;
  date: string | null;
  items: ReceiptItem[];
  total: number | null;
  /** "NOMBRE ARTICLES : 5" when the receipt prints it. */
  expected: number | null;
  /** The rows as read, to show the user what the camera saw. */
  rows: string[];
};

// Article code at the start of a line, tolerant of camera misreads:
// "(4)2000002693406", "1)2707827014620", "(l)7622202376115", "(1)27009970305B2".
const CODE = /^\s*[(\[{]?\s*[0-9lI|!]\s*[)\]}]\s*[0-9OoBSIl|]{5,}\s*|^\s*[0-9OoBSIl|]{8,}\s+/;

// Supermarket departments printed as group subtotals (Carrefour, Marjane...).
const DEPARTMENTS = /^(surgel[eé]s?|fromagerie|biscuiterie|fruits? et l[eé]gumes|boucherie|charcuterie|traiteur|cr[eè]merie|[eé]picerie( sal[eé]e| sucr[eé]e)?|boissons?|liquides?|droguerie|parfumerie|hygi[eè]ne|entretien|boulangerie|p[aâ]tisserie|viennoiserie|poissonnerie|volaille|produits? frais|frais|laitiers?|bazar|textile|confiserie|petit d[eé]jeuner|conserves?|surgel[eé]s? sal[eé]s|b[eé]b[eé]|animaux|electrom[eé]nager|multim[eé]dia)$/i;

const KNOWN_STORES = [...DEFAULT_STORES, 'Acima', 'Aswak Assalam', 'Label Vie', 'Carrefour Market', 'Kazyon', 'Atacadao'].sort((a, b) => b.length - a.length);

// Lines that are never products.
const SKIP = /\b(total|sous[- ]?total|tva|t\.v\.a|ht|ttc|esp[eè]ces?|rendu|monnaie|carte|cb|visa|cash|ticket|caisse|caissier|merci|client|fid[eé]lit[eé]|points?|remise totale|net a payer|net à payer|a payer|à payer|montant|change|tel|t[eé]l[eé]phone|ice|patente|rc|if\b|cnss|adresse|www|http|articles?|nombre|qt[eé] totale|solde|avoir|recu|reçu|facture|date|heure|n°|no\.|timbre|droits?|operation|vente|ventilation|taux|code promo|solde|offerts?|bienvenue|paiement)/i;

const PRICE = /(-?\d{1,5}(?:[ .]\d{3})*[.,]\d{2})\s*(?:dh|dhs|mad|€)?\s*[a-z]?$/i;

/** Weights like "0.628" or "1,250": the dot is a decimal point here, never a thousands separator. */
function weight(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

function num(s: string): number {
  return parseFloat(s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
}

/** Groups OCR lines that sit on the same row (name on the left, price on the right). */
export function toRows(lines: OcrLine[]): string[] {
  const sorted = [...lines].filter((l) => l.text.trim()).sort((a, b) => a.top - b.top);
  const rows: OcrLine[][] = [];
  for (const l of sorted) {
    const mid = l.top + l.height / 2;
    const row = rows.find((r) => {
      const ref = r[0];
      return Math.abs(ref.top + ref.height / 2 - mid) < Math.max(ref.height, l.height) * 0.55;
    });
    if (row) row.push(l);
    else rows.push([l]);
  }
  return rows.map((r) => r.sort((a, b) => a.left - b.left).map((l) => l.text.trim()).join('  '));
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

export function parseReceipt(rows: string[]): ReceiptResult {
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
  // Amount of the articles since the last group subtotal (e.g. "FROMAGERIE 45.20").
  let sinceGroup = 0;

  for (const raw of rows) {
    const row = raw.replace(/\s+/g, ' ').trim();
    if (!row) continue;

    const count = row.match(/nombre\s*(?:d'?\s*)?articles?\s*:?\s*(\d{1,3})/i);
    if (count) {
      expected = Number(count[1]);
      continue;
    }

    if (/\b(total|net [aà] payer|[aà] payer)\b/i.test(row) && !/sous/i.test(row)) {
      const m = row.match(PRICE);
      if (m && total === null) total = num(m[1]);
      continue;
    }

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

    const pm = row.match(PRICE);
    if (!pm) continue;
    const lineTotal = num(pm[1]);
    let left = row.slice(0, pm.index).trim();
    if (SKIP.test(left) || lineTotal <= 0 || lineTotal > 100000) continue;
    // Tax table rows ("4  67.5200  0.00%  0.0000  67.52") are not articles.
    if (/%|\d[.,]\d{4}/.test(row)) continue;
    const hasCode = CODE.test(left);
    // Group subtotal ("FROMAGERIE 45.20"): a department name, or an uncoded line whose
    // amount equals the articles since the previous group.
    if (!hasCode && (DEPARTMENTS.test(left.trim()) || (sinceGroup > 0 && Math.abs(lineTotal - sinceGroup) < 0.02))) {
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
    if (!(qty > 0) || !(unitPrice >= 0)) continue;
    items.push({ name, qty: Math.round(qty * 1000) / 1000, unitPrice: Math.round(unitPrice * 100) / 100, unit });
    sinceGroup += lineTotal;
  }

  return { store, date, items, total, expected, rows };
}
