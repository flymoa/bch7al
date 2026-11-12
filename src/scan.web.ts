// Web preview: no camera or on-device text recognition.
import type { ReceiptResult } from './receipt';

export const scanAvailable = false;

export async function scanReceipt(_source: 'camera' | 'gallery'): Promise<ReceiptResult | null> {
  throw new Error("Le scan de ticket marche dans l'application Android, pas dans l'aperçu.");
}
