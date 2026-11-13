// Google Cloud Vision (online OCR). Reads Arabic and French. Pure conversion code is
// separate from the network call so it can be tested in Node.
import type { OcrLine } from './receipt';

type Vertex = { x?: number; y?: number };
type Symbol = { text: string; property?: { detectedBreak?: { type?: string } } };
type Word = { symbols?: Symbol[]; boundingBox?: { vertices?: Vertex[] } };
export type VisionResponse = {
  responses?: {
    error?: { message?: string; code?: number };
    fullTextAnnotation?: { pages?: { blocks?: { paragraphs?: { words?: Word[] }[] }[] }[] };
  }[];
  error?: { message?: string; code?: number };
};

const ARABIC = /[؀-ۿ]/;

/**
 * Turns Vision's words into printed lines. Vision marks where a line ends; a wide gap
 * between two words also starts a new piece, so columns (name | price) stay separate
 * and the receipt reader can pair them along the photo's tilt.
 */
export function visionToLines(resp: VisionResponse): OcrLine[] {
  const r = resp.responses?.[0];
  const err = r?.error ?? resp.error;
  if (err) throw new Error(err.message || 'Erreur Google Vision');
  const lines: OcrLine[] = [];
  let words: { text: string; x0: number; x1: number; y0: number; y1: number; rtl: boolean }[] = [];

  const flush = () => {
    if (!words.length) return;
    // split into pieces where the gap between words is wider than ~2 characters
    const sorted = [...words].sort((a, b) => a.x0 - b.x0);
    const charW = Math.max(4, median(sorted.map((w) => (w.x1 - w.x0) / Math.max(1, w.text.length))));
    let piece: typeof words = [sorted[0]];
    const pieces: (typeof words)[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      const number = (w: { text: string }) => /^[*x+]?-?\d+(?:[.,]\d+)?$/.test(w.text);
      // a plain number next to an Arabic word is a separate column (quantity, price)
      const scriptChange = ((a.rtl && number(b)) || (b.rtl && number(a))) && b.x0 - a.x1 > charW * 1.2;
      if (b.x0 - a.x1 > charW * 2.5 || scriptChange) {
        pieces.push(piece);
        piece = [];
      }
      piece.push(sorted[i]);
    }
    pieces.push(piece);
    for (const p of pieces) {
      // Arabic reads right to left: order its words from the right edge
      const rtl = p.filter((w) => w.rtl).length > p.length / 2;
      const ordered = rtl ? [...p].sort((a, b) => b.x1 - a.x1) : p;
      const x0 = Math.min(...p.map((w) => w.x0));
      const x1 = Math.max(...p.map((w) => w.x1));
      const y0 = Math.min(...p.map((w) => w.y0));
      const y1 = Math.max(...p.map((w) => w.y1));
      lines.push({ text: ordered.map((w) => w.text).join(' '), left: x0, width: x1 - x0, top: y0, height: Math.max(1, y1 - y0) });
    }
    words = [];
  };

  for (const page of r?.fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const w of para.words ?? []) {
          const text = (w.symbols ?? []).map((s) => s.text).join('');
          const v = w.boundingBox?.vertices ?? [];
          const xs = v.map((p) => p.x ?? 0), ys = v.map((p) => p.y ?? 0);
          if (!text || !xs.length) continue;
          words.push({ text, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), rtl: ARABIC.test(text) });
          const brk = w.symbols?.[w.symbols.length - 1]?.property?.detectedBreak?.type;
          if (brk === 'LINE_BREAK' || brk === 'EOL_SURE_SPACE') flush();
        }
        flush();
      }
    }
  }
  flush();
  return lines;
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/** Sends one photo to Google Cloud Vision (document text mode, tuned for printed receipts). */
export async function visionRead(base64: string, apiKey: string): Promise<OcrLine[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey.trim())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['fr', 'ar'] } }],
      }),
    });
    const json = (await res.json()) as VisionResponse;
    if (!res.ok) throw new Error(json.error?.message || `Google Vision a répondu ${res.status}`);
    return visionToLines(json);
  } finally {
    clearTimeout(timer);
  }
}
