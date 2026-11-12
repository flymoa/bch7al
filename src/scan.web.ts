// Web preview: no camera or on-device text recognition, so "scanning" loads a
// sample Carrefour receipt to show what a scan fills in. The Android app uses the real camera.
import type { ReceiptResult } from './receipt';

export const scanAvailable = false;

export async function scanReceipt(_source: 'camera' | 'gallery'): Promise<ReceiptResult | null> {
  await new Promise((r) => setTimeout(r, 600));
  return {
    store: 'Carrefour Market',
    date: null,
    total: 116.96,
    expected: 5,
    rows: ['Carrefour Market', 'EL HOUDA', '12/11/2026 - 19:51:56', '(4)2000002693406  FILET COLIN ALASKA B  34.90', 'SURGELE  34.90', '(1)2700997030582  EDAM BOULE FRICO AU  30.58', '(1)2707827014620  FROMAGE FUME NATURE  14.62', 'FROMAGERIE  45.20', '(1)7622202376115  CHEWING GUM ORIGINAL  3.95', 'BISCUITERIE  3.95', '(4)2303641  CHAMPIGNON DE PARIS  32.62', '0.628 kg x 51.95 MAD/kg', 'FRUITS ET LEGUMES  32.62', '116.96', 'TOTAL :', 'NOMBRE ARTICLES : 5'],
    items: [
      { name: 'Filet Colin Alaska B', qty: 1, unitPrice: 34.9, unit: 'pièce' },
      { name: 'Edam Boule Frico Au', qty: 1, unitPrice: 30.58, unit: 'pièce' },
      { name: 'Fromage Fume Nature', qty: 1, unitPrice: 14.62, unit: 'pièce' },
      { name: 'Chewing Gum Original', qty: 1, unitPrice: 3.95, unit: 'pièce' },
      { name: 'Chewing Gum Original', qty: 1, unitPrice: 3.95, unit: 'pièce' },
      { name: 'Champignon De Paris', qty: 0.628, unitPrice: 51.95, unit: 'kg' },
    ],
  };
}
