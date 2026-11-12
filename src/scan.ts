// Android: take a photo of the receipt (or pick one) and read it on the phone, offline.
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as ImagePicker from 'expo-image-picker';
import { parseReceipt, toRows, type OcrLine, type ReceiptResult } from './receipt';

export const scanAvailable = true;

export async function scanReceipt(source: 'camera' | 'gallery'): Promise<ReceiptResult | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("L'accès à l'appareil photo a été refusé. Tu peux l'autoriser dans les réglages du téléphone.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: true };
  const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets?.length) return null;

  const result = await TextRecognition.recognize(picked.assets[0].uri);
  const lines: OcrLine[] = [];
  for (const block of result.blocks) {
    for (const line of block.lines) {
      const f = line.frame;
      lines.push({ text: line.text, top: f?.top ?? 0, left: f?.left ?? 0, height: f?.height ?? 20 });
    }
  }
  return parseReceipt(toRows(lines));
}
