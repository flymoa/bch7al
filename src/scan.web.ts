// Web preview: no camera, so "scanning" runs the real receipt reader on sample receipts
// exactly as the phone reads them. Photo = BIM (with stamp duty), Galerie = an Arabic receipt.
import { parseReceipt, type ReceiptResult } from './receipt';

export const scanAvailable = false;

const BIM = [
  'BIM MAROC', 'MAHASIN AMCERNATE', 'AGADIR', '12.11.2026 13:42  N° Ticket : 47',
  'PILES ALC4P LR06 POW  %20  *12.50', 'PILES LR03 4PC POWER  Z20  *12.50', 'GAUF CACO CENTRO142G  %20  *8.90',
  'TOTAL  *33.90 DH', 'DROITS DE TIMBRE  *0.08 DH', 'TOTAL TTC  *33.98 DH', 'DONT TVA  *5.65 DH',
  'Especes  *40.00', 'RENDU  *-6.02', '%20  28.25  *5.65  *33.90', 'NOMBRE ARTICLES : 3',
];

const SOUFI = [
  'soufi', 'ALIMENTATION', 'N° : 24057681', 'Le : 12-11-2026 [19:21]',
  '28.00  28.00  1', '7.00  7.00  180  1', '18.00  9.00  250  2', '10.80  240.00  0.04', '5.40  90.00  0.06',
  '10.00  10.00  200  1', '24.00  24.00  250  1', '33.00  33.00  jal  400  1', '7.00  7.00  Article  1',
  'Total :  143.20  ( Dhs )', 'Cache :  143.20', 'Rendu :  0.00', 'Editeur : abd  Article : 9 - Articles',
];

export async function scanReceipt(source: 'camera' | 'gallery'): Promise<ReceiptResult | null> {
  await new Promise((r) => setTimeout(r, 600));
  return { ...parseReceipt(source === 'camera' ? BIM : SOUFI), date: null };
}
