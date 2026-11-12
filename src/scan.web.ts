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
