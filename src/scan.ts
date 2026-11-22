// Android: take a photo of the receipt (or pick one) and read it.
// With a Gemini key (free, from Google AI Studio): read online (French + Arabic, most accurate).
// Without one, or offline: read on the phone (French only).
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { parseReceipt, toRows, type OcrLine, type ReceiptResult } from './receipt';
import { geminiRead } from './gemini';

export const scanAvailable = true;

export type ScanResult = ReceiptResult & { engine: 'gemini' | 'phone'; warning?: string; model?: string; /** the photo, kept so a failed Gemini read can be retried */ photo?: Photo; /** Gemini was asked but the phone read it instead */ fellBack?: boolean };

export type Photo = { uri: string; base64?: string | null; mimeType?: string | null };

/** A photo taken by the app's own camera screen, waiting to be read by the trip screen. */
let pending: Photo | null = null;
export function setPendingPhoto(p: Photo) { pending = p; }
export function takePendingPhoto(): Photo | null { const p = pending; pending = null; return p; }

export async function scanReceipt(source: 'camera' | 'gallery' | 'photo', geminiKey?: string | null, geminiModel?: string | null): Promise<ScanResult | null> {
  if (source === 'photo') {
    const photo = takePendingPhoto();
    return photo ? readPhoto(photo, geminiKey, geminiModel) : null;
  }
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("L'accès à l'appareil photo a été refusé. Tu peux l'autoriser dans les réglages du téléphone.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsEditing: true };
  const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets?.length) return null;
  return readPhoto(picked.assets[0], geminiKey, geminiModel);
}

/** Reads one receipt photo: Gemini when a key is set, otherwise (or on failure) on the phone. */
export async function readPhoto(asset: Photo, geminiKey?: string | null, geminiModel?: string | null): Promise<ScanResult> {

  let warning: string | undefined;
  if (geminiKey) {
    try {
      // Full-size camera photos are 5-10 MB once encoded: on mobile data the upload hit the
      // 60 s timeout and the app fell back to the phone reader. 1600 px is plenty to read a ticket.
      const small = await shrink(asset.uri);
      const res = await geminiRead(small, 'image/jpeg', geminiKey, geminiModel);
      if (res.items.length > 0) return { ...res, engine: 'gemini', photo: asset };
      warning = "Gemini n'a trouvé aucun article. Ticket lu sur le téléphone.";
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      const status = (e as { status?: number }).status;
      warning = status === 429
        ? "Limite gratuite de Gemini atteinte pour l'instant : ticket lu sur le téléphone (sans les noms en arabe). Réessaie dans une minute."
        : /abort/i.test(msg) || (e as Error).name === 'AbortError'
        ? 'Gemini a mis trop de temps à répondre : ticket lu sur le téléphone (sans les noms en arabe). Réessaie.'
        : !status || /network|fetch|timeout/i.test(msg)
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
  const fellBack = !!geminiKey;
  if (lines.length === 0) return { store: null, date: null, items: [], total: null, expected: null, rows: [], engine: 'phone', warning, photo: asset, fellBack };
  return { ...parseReceipt(toRows(lines)), engine: 'phone', warning, photo: asset, fellBack };
}

/** Long edge 1600 px, JPEG 0.7: about 250-400 KB instead of several MB. */
async function shrink(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1600 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Photo illisible');
  return out.base64;
}
