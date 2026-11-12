// Pure helpers: no React Native imports, so they can be tested in Node.

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

/** Key used to recognise the same product typed differently: case, accents and spacing are ignored. */
export function productKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
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
