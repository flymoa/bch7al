// Android: take a photo of the receipt (or pick one) and read it.
// With a Google Cloud Vision key: read online (French + Arabic, most accurate).
// Without one, or offline: read on the phone (French only).
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import * as ImagePicker from 'expo-image-picker';
import { parseReceipt, toRows, type OcrLine, type ReceiptResult } from './receipt';
import { visionRead } from './vision';

export const scanAvailable = true;

export type ScanResult = ReceiptResult & { engine: 'google' | 'phone'; warning?: string };

export async function scanReceipt(source: 'camera' | 'gallery', visionKey?: string | null): Promise<ScanResult | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("L'accès à l'appareil photo a été refusé. Tu peux l'autoriser dans les réglages du téléphone.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsEditing: true, base64: !!visionKey };
  const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets?.length) return null;
  const asset = picked.assets[0];

  let warning: string | undefined;
  if (visionKey && asset.base64) {
    try {
      const lines = await visionRead(asset.base64, visionKey);
      return { ...parseReceipt(toRows(lines)), engine: 'google' };
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      warning = /network|fetch|abort|timeout/i.test(msg)
        ? 'Pas de connexion : ticket lu sur le téléphone (sans les noms en arabe).'
        : `Google Vision a refusé la lecture (${msg}). Ticket lu sur le téléphone.`;
    }
  }

  const result = await recognizeText(asset.uri);
  const lines: OcrLine[] = [];
  for (const block of result?.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const f = line.frame;
      lines.push({ text: line.text ?? '', top: f?.top ?? 0, left: f?.left ?? 0, height: f ? Math.max(1, f.bottom - f.top) : 20, width: f ? Math.max(1, f.right - f.left) : undefined });
    }
  }
  if (lines.length === 0) return { store: null, date: null, items: [], total: null, expected: null, rows: [], engine: 'phone', warning };
  return { ...parseReceipt(toRows(lines)), engine: 'phone', warning };
}
