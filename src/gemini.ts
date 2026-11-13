// Gemini (Google AI Studio, free key, no bank card). Gemini looks at the photo itself and
// answers with the list of articles, so Arabic names, tilted photos and grouped receipts
// are read directly. The conversion code is separate from the network call so it can be
// tested in Node.
import { knownStore, STAMP_DUTY, UNNAMED, type ReceiptItem, type ReceiptResult } from './receipt';

/** Tried in this order; the first one the key may use is remembered. */
export const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const PROMPT = `Tu lis la photo d'un ticket de caisse marocain (français et/ou arabe). Réponds uniquement avec un objet JSON :
{"store": string|null, "date": "AAAA-MM-JJ"|null, "total": number|null, "article_count": number|null,
 "items": [{"name": string, "qty": number, "unit": "piece"|"kg", "unit_price": number, "line_total": number}]}

Règles :
- Une entrée par article acheté, dans l'ordre du ticket. Ne saute aucun article et n'en invente aucun.
- "name" : le nom tel qu'il est imprimé (l'arabe reste en arabe), sans code-barres, sans code TVA, sans prix. Si le nom est illisible ou absent, mets "".
- Article au poids : "unit" = "kg", "qty" = le poids en kilos, "unit_price" = le prix du kilo. Sinon "unit" = "piece".
- "2 x 2,50" veut dire qty 2 et unit_price 2.50. "line_total" = le montant imprimé pour la ligne.
- Une remise sur un article se retire de son line_total et de son unit_price.
- Ne mets PAS dans items : sous-totaux de rayon, lignes TOTAL, TVA, paiement (espèces, carte), rendu, points de fidélité.
- Le droit de timbre, s'il est imprimé, est un article : name "Droit de timbre", qty 1. Une seule fois, même s'il est imprimé deux fois.
- "total" : le total à payer TTC, droit de timbre compris. "article_count" : le nombre d'articles imprimé sur le ticket, sinon null.
- "store" : l'enseigne (Marjane, Carrefour, BIM...). "date" : la date d'achat.
- Les nombres utilisent un point décimal. Si un chiffre est illisible, déduis-le des autres colonnes de la ligne ; sinon laisse l'article avec ce que tu lis.`;

const SCHEMA = {
  type: 'object',
  properties: {
    store: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
    total: { type: ['number', 'null'] },
    article_count: { type: ['number', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
          unit: { type: 'string', enum: ['piece', 'kg'] },
          unit_price: { type: 'number' },
          line_total: { type: 'number' },
        },
        required: ['name', 'qty', 'unit', 'unit_price', 'line_total'],
      },
    },
  },
  required: ['store', 'date', 'total', 'article_count', 'items'],
};

const n = (v: unknown): number | null => {
  const x = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/\s/g, '').replace(',', '.')) : NaN;
  return Number.isFinite(x) ? x : null;
};
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
const STAMP = /t[il1][mn]bre|تنبر|تمبر|طابع/i;

/** Pulls the answer's text out of Gemini's reply (current and older reply shapes). */
export function geminiText(resp: any): string {
  const err = resp?.error ?? resp?.errors?.[0];
  if (err) throw new Error(err.message || 'Erreur Gemini');
  const parts: string[] = [];
  for (const step of resp?.steps ?? resp?.outputs ?? []) {
    if (step?.type && step.type !== 'model_output' && step.type !== 'text') continue;
    if (typeof step?.text === 'string') parts.push(step.text);
    for (const c of step?.content ?? []) if (c?.type === 'text' && typeof c.text === 'string') parts.push(c.text);
  }
  if (!parts.length && typeof resp?.output_text === 'string') parts.push(resp.output_text);
  for (const c of resp?.candidates?.[0]?.content?.parts ?? []) if (typeof c?.text === 'string') parts.push(c.text);
  return parts.join('');
}

/** Gemini's JSON answer -> the same result the on-device reader gives, with sanity checks. */
export function geminiToReceipt(text: string): ReceiptResult {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error("Gemini n'a pas renvoyé de liste d'articles.");
  let data: any;
  try {
    data = JSON.parse(text.slice(a, b + 1));
  } catch {
    throw new Error('La réponse de Gemini est incomplète.');
  }
  const items: ReceiptItem[] = [];
  let stamp = false;
  for (const raw of Array.isArray(data.items) ? data.items : []) {
    let qty = n(raw?.qty) ?? 1;
    let unitPrice = n(raw?.unit_price);
    const line = n(raw?.line_total);
    if (qty <= 0) qty = 1;
    if (unitPrice === null && line !== null) unitPrice = line / qty;
    if (unitPrice === null || unitPrice <= 0) continue;
    const kg = raw?.unit === 'kg' || !Number.isInteger(qty);
    // The printed line amount is the most reliable number: make the others agree with it.
    if (line !== null && line > 0 && Math.abs(qty * unitPrice - line) > 0.06) {
      if (kg) qty = round(line / unitPrice, 3);
      else if (Number.isInteger(qty)) unitPrice = line / qty;
    }
    const name = String(raw?.name ?? '').replace(/\s+/g, ' ').trim();
    if (STAMP.test(name)) {
      if (stamp) continue;
      stamp = true;
      items.push({ name: STAMP_DUTY, qty: 1, unitPrice: round(line ?? unitPrice, 2), unit: 'pièce' });
      continue;
    }
    if (/^(sous[- ]?)?total\b|^t\.?v\.?a\b|^rendu\b|^esp[eè]ces?\b/i.test(name)) continue;
    const item: ReceiptItem = { name: name || UNNAMED, qty: kg ? round(qty, 3) : qty, unitPrice: round(unitPrice, 2), unit: kg ? 'kg' : 'pièce' };
    if (!name) item.unnamed = true;
    items.push(item);
  }
  const date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null;
  const storeText = typeof data.store === 'string' ? data.store.trim() : '';
  const count = n(data.article_count);
  return {
    store: storeText ? knownStore(storeText) ?? storeText : null,
    date,
    items,
    total: n(data.total),
    expected: count !== null && count > 0 ? Math.round(count) : null,
    rows: items.map((i) => `${i.name}  ${i.qty} x ${i.unitPrice.toFixed(2)}`),
  };
}

class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call(body: object, apiKey: string, ms: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new GeminiError(json?.error?.message || `Gemini a répondu ${res.status}`, res.status);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs one request, moving to the next model when one is not open to this key (404),
 * is out of free quota (429) or is overloaded (5xx). Returns the reply and the model used.
 */
async function ask(build: (model: string) => object, apiKey: string, preferred: string | null | undefined, ms: number): Promise<{ json: any; model: string }> {
  const models = [...new Set([preferred, ...GEMINI_MODELS].filter(Boolean) as string[])];
  let last: unknown;
  for (const model of models) {
    try {
      return { json: await call(build(model), apiKey, ms), model };
    } catch (e) {
      last = e;
      const status = e instanceof GeminiError ? e.status : 0;
      if (status === 404 || status === 429 || status >= 500) continue;
      throw e;
    }
  }
  throw last;
}

/** Checks a key with a tiny text question. Returns the model that answered. */
export async function geminiCheck(apiKey: string): Promise<string> {
  const { model } = await ask((m) => ({ model: m, input: 'Réponds seulement : ok', store: false }), apiKey, null, 20000);
  return model;
}

/** Sends one receipt photo to Gemini and returns its articles. */
export async function geminiRead(base64: string, mime: string, apiKey: string, preferred?: string | null): Promise<ReceiptResult & { model: string }> {
  const input = [{ type: 'text', text: PROMPT }, { type: 'image', data: base64, mime_type: mime }];
  const strict = (model: string) => ({
    model,
    input,
    store: false,
    response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
    generation_config: { thinking_level: 'low' },
  });
  let out: { json: any; model: string };
  try {
    out = await ask(strict, apiKey, preferred, 60000);
  } catch (e) {
    // An option this model does not accept: ask again with the plain request (the prompt
    // alone already asks for JSON).
    if (!(e instanceof GeminiError) || e.status !== 400 || /api key|image/i.test(e.message)) throw e;
    out = await ask((model) => ({ model, input }), apiKey, preferred, 60000);
  }
  return { ...geminiToReceipt(geminiText(out.json)), model: out.model };
}
