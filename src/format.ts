// Pure helpers: no React Native imports, so they can be tested in Node.
import { verdictBand } from './tokens';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** 1240.5 -> "1 240,50" */
export function money(v: number): string {
  const sign = v < 0 ? '−' : '';
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  return sign + int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
}

/** 1.5 -> "1,5" ; 2 -> "2" */
export function qty(v: number): string {
  return String(Math.round(v * 1000) / 1000).replace('.', ',');
}

/** 0.75 kg -> "750 g", 1.5 kg -> "1,5 kg", 0.33 L -> "330 mL", 3 pièce -> "3" */
export function qtyLabel(q: number, unit: string): string {
  if ((unit === 'kg' || unit === 'L') && q < 1) return Math.round(q * 1000) + (unit === 'kg' ? ' g' : ' mL');
  if (unit === 'kg' || unit === 'L') return qty(q) + ' ' + unit;
  return qty(q);
}

/** "12,50" or "12.50" -> 12.5 ; invalid -> NaN */
export function parseNumber(text: string): number {
  const t = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.?$/.test(t)) return NaN;
  return parseFloat(t);
}

/**
 * Key used to recognise the same product typed differently: case, accents and spacing are
 * ignored. Arabic letters are kept (vowel marks and letter variants are unified).
 */
export function productKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Arabic vowel marks and tatweel
    .replace(/[\u0622\u0623\u0625]/g, '\u0627') // alef variants -> ا
    .replace(/\u0649/g, '\u064A') // ى -> ي
    .replace(/\u0629/g, '\u0647') // ة -> ه
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic digits
    .toLowerCase()
    .replace(/[^a-z0-9\u0621-\u064A]+/g, ' ')
    .trim();
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** Local date as YYYY-MM-DD */
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** "Lundi 9 nov." (adds the year when it is not the current one) */
export function longDate(iso: string): string {
  const d = parseIso(iso);
  const year = d.getFullYear() === new Date().getFullYear() ? '' : ' ' + d.getFullYear();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${year}`;
}

export function shortDate(iso: string): string {
  const d = parseIso(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "2026-11" -> "Novembre 2026" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const name = MONTHS[m - 1];
  return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y;
}

export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Percent change from a to b, e.g. 4.3 ; null when it cannot be computed. */
export function pctChange(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from <= 0) return null;
  return ((to - from) / from) * 100;
}

export function pct(v: number): string {
  return (Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(0)).replace('.', ',') + ' %';
}

// ---- CSV (semicolon separated, Excel-friendly in French locales) ----

function csvCell(v: string | number): string {
  const s = String(v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(';')).join('\n') + '\n';
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

// ---- price verdict ----

export type Verdict = { kind: 'good' | 'normal' | 'high'; change: number };

/** Is this price good compared with what is usually paid? Within ±5 % counts as the usual price. */
export function verdict(price: number, usual: number | null): Verdict | null {
  if (usual === null || !(usual > 0) || !(price >= 0)) return null;
  const change = ((price - usual) / usual) * 100;
  return { kind: change <= -verdictBand ? 'good' : change >= verdictBand ? 'high' : 'normal', change };
}

export const VERDICT_WORD = { good: 'Rkhis', normal: 'Normal', high: 'Ghali' } as const;
export const VERDICT_FR = { good: 'moins cher', normal: 'prix habituel', high: 'plus cher' } as const;

// ---- money in Morocco ----

/** " / kg" for weighed items, nothing for pieces. */
export function perUnit(unit: string): string {
  return unit === 'pièce' ? '' : ` / ${unit}`;
}

/** 12.5 -> "12,50 DH" (no-break space so the DH never wraps alone). */
export function dh(v: number): string {
  return money(v) + '\u00A0DH';
}

/** Whole dirhams when there are no centimes: 2000 -> "2 000", 12.5 -> "12,50". */
export function moneyShort(v: number): string {
  return money(v).replace(/,00$/, '');
}

/** 1 DH = 20 ryal, the souk's way of saying prices. 6 -> "120 ryal". */
export function ryal(v: number): string {
  return Math.round(v * 20).toLocaleString('fr-FR').replace(/\u202F|\u00A0/g, ' ') + ' ryal';
}

// ---- pack size and price per kilo / litre ----

export type PackSize = { amount: number; base: 'kg' | 'L' };

/**
 * Reads the size printed in a product name: "Huile 5L" -> 5 L, "Lait 1/2 L" is ignored,
 * "Farine 500G" -> 0.5 kg, "Eau 6x1,5L" -> 9 L, "Coca 33CL" -> 0.33 L. null when none.
 */
export function packSize(name: string): PackSize | null {
  const t = ' ' + name.toLowerCase().replace(/,/g, '.') + ' ';
  const m = t.match(/(?:(\d{1,2})\s*[x×*]\s*)?(\d+(?:\.\d+)?)\s*(kg|kilo|g|gr|grs|l|lt|litre|litres|cl|ml)(?=[^a-z]|$)/);
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const v = Number(m[2]);
  if (!(v > 0) || !(count > 0)) return null;
  const u = m[3];
  const per =
    u === 'kg' || u === 'kilo' ? { amount: v, base: 'kg' as const }
    : u === 'g' || u === 'gr' || u === 'grs' ? { amount: v / 1000, base: 'kg' as const }
    : u === 'cl' ? { amount: v / 100, base: 'L' as const }
    : u === 'ml' ? { amount: v / 1000, base: 'L' as const }
    : { amount: v, base: 'L' as const };
  const amount = Math.round(per.amount * count * 10000) / 10000;
  return amount > 0 && amount < 1000 ? { amount, base: per.base } : null;
}

/**
 * The price brought back to 1 kg or 1 L, so a 5 L bottle and a 1 L bottle compare.
 * Weighed items already are; pieces need a size in their name. null when unknown.
 */
export function basePrice(unitPrice: number, unit: string, name: string): { price: number; base: 'kg' | 'L' } | null {
  if (unit === 'kg' || unit === 'L') return { price: unitPrice, base: unit };
  const size = packSize(name);
  if (!size || size.amount === 1) return null; // a 1 L / 1 kg pack: same number, nothing to add
  return { price: unitPrice / size.amount, base: size.base };
}

// ---- « Même produit que … ? » ----

const SIZE_TOKEN = /^\d+([.,]\d+)?(kg|g|gr|l|cl|ml)?$|^x\d+$/;
const tokens = (name: string) => productKey(name).split(' ').filter((w) => w.length > 1 && !SIZE_TOKEN.test(w));

/** 0..1: how alike two product names are (shared words, prefix-tolerant: "lait" ~ "lai"). */
export function similarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const hit = (w: string, list: string[]) => list.some((x) => x === w || (w.length >= 3 && x.length >= 3 && (x.startsWith(w) || w.startsWith(x))));
  const shared = ta.filter((w) => hit(w, tb)).length;
  return (2 * shared) / (ta.length + tb.length);
}

/** The known product a receipt name most likely is, if any is close enough to ask. */
export function closestName<T extends { name: string }>(name: string, known: T[], min = 0.6): T | null {
  let best: T | null = null;
  let score = min;
  const key = productKey(name);
  for (const k of known) {
    if (productKey(k.name) === key) return null; // exact: no question to ask
    const s = similarity(name, k.name);
    if (s > score || (s === score && best === null)) {
      if (s >= min) { best = k; score = s; }
    }
  }
  return best;
}
