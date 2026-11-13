// Android: take a photo of the receipt (or pick one) and read it.
// With a Gemini key (free, from Google AI Studio): read online (French + Arabic, most accurate).
// Without one, or offline: read on the phone (French only).
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import * as ImagePicker from 'expo-image-picker';
import { parseReceipt, toRows, type OcrLine, type ReceiptResult } from './receipt';
import { geminiRead } from './gemini';

export const scanAvailable = true;

export type ScanResult = ReceiptResult & { engine: 'gemini' | 'phone'; warning?: string; model?: string };

export async function scanReceipt(source: 'camera' | 'gallery', geminiKey?: string | null, geminiModel?: string | null): Promise<ScanResult | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("L'accès à l'appareil photo a été refusé. Tu peux l'autoriser dans les réglages du téléphone.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsEditing: true, base64: !!geminiKey };
  const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets?.length) return null;
  const asset = picked.assets[0];

  let warning: string | undefined;
  if (geminiKey && asset.base64) {
    try {
      const res = await geminiRead(asset.base64, asset.mimeType || 'image/jpeg', geminiKey, geminiModel);
      if (res.items.length > 0) return { ...res, engine: 'gemini' };
      warning = "Gemini n'a trouvé aucun article. Ticket lu sur le téléphone.";
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      const status = (e as { status?: number }).status;
      warning = status === 429
        ? "Limite gratuite de Gemini atteinte pour l'instant : ticket lu sur le téléphone (sans les noms en arabe). Réessaie dans une minute."
        : !status || /network|fetch|abort|timeout/i.test(msg)
        ? 'Pas de connexion : ticket lu sur le téléphone (sans les noms en arabe).'
        : `Gemini a refusé la lecture (${msg}). Ticket lu sur le téléphone.`;
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
