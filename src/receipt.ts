// Turns the text read from a receipt photo into items. Pure logic, tested in Node.
import { DEFAULT_STORES } from './theme-constants';

export type OcrLine = { text: string; top: number; left: number; height: number };
export type ReceiptItem = { name: string; qty: number; unitPrice: number; unit: 'pièce' | 'kg' };
export type ReceiptResult = { store: string | null; date: string | null; items: ReceiptItem[]; total: number | null };

const KNOWN_STORES = [...DEFAULT_STORES, 'Acima', 'Aswak Assalam', 'Label Vie', 'Carrefour Market', 'Kazyon', 'Atacadao'];

// Lines that are never products.
const SKIP = /\b(total|sous[- ]?total|tva|t\.v\.a|ht|ttc|esp[eè]ces?|rendu|monnaie|carte|cb|visa|cash|ticket|caisse|caissier|merci|client|fid[eé]lit[eé]|points?|remise totale|net a payer|net à payer|a payer|à payer|montant|change|tel|t[eé]l[eé]phone|ice|patente|rc|if\b|cnss|adresse|www|http|articles?|nombre|qt[eé] totale|solde|avoir|recu|reçu|facture|date|heure|n°|no\.)/i;

const PRICE = /(-?\d{1,5}(?:[ .]\d{3})*[.,]\d{2})\s*(?:dh|dhs|mad|€)?\s*[a-z]?$/i;

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
    .replace(/^\s*[\d]{4,}\s+/, '') // leading article code / barcode
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
  for (const r of rows.slice(0, 6)) {
    const hit = KNOWN_STORES.find((s) => r.toLowerCase().includes(s.toLowerCase()));
    if (hit) { store = hit; break; }
  }

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
  const items: ReceiptItem[] = [];
  let pendingQty: { qty: number; unitPrice: number } | null = null;

  for (const raw of rows) {
    const row = raw.replace(/\s+/g, ' ').trim();
    if (!row) continue;

    if (/\b(total|net [aà] payer|[aà] payer)\b/i.test(row) && !/sous/i.test(row)) {
      const m = row.match(PRICE);
      if (m && total === null) total = num(m[1]);
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
      qty = num(weighed[1]);
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
  }

  return { store, date, items, total };
}
