// Web preview: no camera, so "scanning" runs the real receipt reader on sample receipts
// exactly as the phone reads them. Photo = Marjane, Galerie = an Arabic receipt.
import { parseReceipt } from './receipt';
import type { ScanResult } from './scan';

export const scanAvailable = false;

// Sample receipt kept for manual web testing.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BIM = [
  'BIM MAROC', 'MAHASIN AMCERNATE', 'AGADIR', '12.11.2026 13:42  N° Ticket : 47',
  'PILES ALC4P LR06 POW  %20  *12.50', 'PILES LR03 4PC POWER  Z20  *12.50', 'GAUF CACO CENTRO142G  %20  *8.90',
  'TOTAL  *33.90 DH', 'DROITS DE TIMBRE  *0.08 DH', 'TOTAL TTC  *33.98 DH', 'DONT TVA  *5.65 DH',
  'Especes  *40.00', 'RENDU  *-6.02', '%20  28.25  *5.65  *33.90', 'NOMBRE ARTICLES : 3',
];

const MARJANE = [
  'Marjane', 'MARJANE HOLDING', 'MARJANE MASSIRA', '23/07/2017 16:07:46 8 17 7766',
  '(5)6111056009436 CADUM, SHAMP GH  22.95', '(5)5410076932535 H&S SH. 200ML ANTI-D  21.75',
  '(5)3610340015489 COLOR NATURALS 5 CHA  34.50', 'BEAUTE-SANTE  79.20',
  '(5)8001585008148 GAUFRETTE BALC  2.95', '(5)6221134000108 BISC FLUTE CHOC 22.5', '2 x 2.50  5.00', 'BISCUITERIE  7.95',
  'T O T A L  87.37', 'DONT DROITS DE TIMBRE : 0.22', 'ESPECES  100.00', 'DROITS DE TIMBRE  0.22', 'RENDU  12.63',
  "NOMBRE D'ARTICLES  6", '5  20.00  72.61  14.54  87.15', 'total  72.61  14.54  87.15',
];

const SOUFI = [
  'soufi', 'ALIMENTATION', 'N° : 24057681', 'Le : 12-11-2026 [19:21]',
  '28.00  28.00  1', '7.00  7.00  180  1', '18.00  9.00  250  2', '10.80  240.00  0.04', '5.40  90.00  0.06',
  '10.00  10.00  200  1', '24.00  24.00  250  1', '33.00  33.00  jal  400  1', '7.00  7.00  Article  1',
  'Total :  143.20  ( Dhs )', 'Cache :  143.20', 'Rendu :  0.00', 'Editeur : abd  Article : 9 - Articles',
];

export function setPendingPhoto(_p: { uri: string; base64?: string | null; mimeType?: string | null }) {}

export async function scanReceipt(source: 'camera' | 'gallery' | 'photo', _geminiKey?: string | null, _geminiModel?: string | null): Promise<ScanResult | null> {
  await new Promise((r) => setTimeout(r, 600));
  return { ...parseReceipt(source === 'camera' ? MARJANE : SOUFI), date: null, engine: 'phone' };
}

export type { Photo } from './scan';
/** Web preview has no online reading: retries just read the Marjane sample again. */
export async function readPhoto(): Promise<ScanResult> {
  return (await scanReceipt('camera'))!;
}
