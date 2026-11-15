// All database access lives here. Only type imports from expo-sqlite, so the
// logic can be exercised in Node with any object exposing the same methods.
import type { SQLiteDatabase } from 'expo-sqlite';
import { cleanName, productKey, parseCsv, parseNumber, toCsv, verdict, type Verdict } from './format';

export type Db = SQLiteDatabase;

export type TripRow = { id: number; date: string; store: string; total: number; n: number };
export type ItemRow = { id: number; product_id: number; name: string; unit: string; qty: number; unit_price: number };
export type ProductRow = { id: number; name: string; unit: string; n: number; last_price: number | null; prev_price: number | null; avg_price: number | null };
export type HistoryRow = { date: string; store: string; unit_price: number; qty: number };
export type MonthSummary = { trips: number; total: number; items: number };
export type NewItem = { name: string; unit: string; qty: number; unitPrice: number };
export type NewTrip = { id?: number; store: string; date: string; items: NewItem[] };

const DATABASE_VERSION = 4;

export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;
  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE,
        unit TEXT NOT NULL DEFAULT 'pièce'
      );
      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY NOT NULL,
        store_id INTEGER NOT NULL REFERENCES stores(id),
        date TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY NOT NULL,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        qty REAL NOT NULL,
        unit_price REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS items_trip ON items(trip_id);
      CREATE INDEX IF NOT EXISTS items_product ON items(product_id);
      CREATE INDEX IF NOT EXISTS trips_date ON trips(date);
    `);
    version = 1;
    await db.execAsync(`PRAGMA user_version = 1`); // each step is saved, so a closed app resumes cleanly
  }
  if (version === 1) {
    await db.execAsync('CREATE TABLE IF NOT EXISTS prefs (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
    version = 2;
    await db.execAsync(`PRAGMA user_version = 2`); // each step is saved, so a closed app resumes cleanly
  }
  if (version === 2) {
    await db.execAsync(`CREATE TABLE IF NOT EXISTS list_items (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      done INTEGER NOT NULL DEFAULT 0
    );`);
    version = 3;
    await db.execAsync(`PRAGMA user_version = 3`); // each step is saved, so a closed app resumes cleanly
  }
  if (version === 3) {
    await rekeyArabic(db);
    version = 4;
    await db.execAsync(`PRAGMA user_version = 4`); // each step is saved, so a closed app resumes cleanly
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

/**
 * Arabic names used to lose their letters in the key (only digits were left), so they
 * could not be saved or were mixed up. Keys are recomputed; same-name rows are merged.
 */
async function rekeyArabic(db: Db): Promise<void> {
  const ar = (t: string) => /[\u0600-\u06FF]/.test(t);
  const products = await db.getAllAsync<{ id: number; name: string; key: string }>('SELECT id, name, key FROM products', []);
  for (const p of products.filter((x) => ar(x.name))) {
    const key = productKey(p.name);
    if (!key || key === p.key) continue;
    const other = await db.getFirstAsync<{ id: number }>('SELECT id FROM products WHERE key = ? AND id <> ?', [key, p.id]);
    if (other) {
      await db.runAsync('UPDATE items SET product_id = ? WHERE product_id = ?', [other.id, p.id]);
      await db.runAsync('DELETE FROM products WHERE id = ?', [p.id]);
    } else {
      await db.runAsync('UPDATE products SET key = ? WHERE id = ?', [key, p.id]);
    }
  }
  const stores = await db.getAllAsync<{ id: number; name: string; key: string }>('SELECT id, name, key FROM stores', []);
  for (const st of stores.filter((x) => ar(x.name))) {
    const key = productKey(st.name);
    if (!key || key === st.key) continue;
    const other = await db.getFirstAsync<{ id: number }>('SELECT id FROM stores WHERE key = ? AND id <> ?', [key, st.id]);
    if (other) {
      await db.runAsync('UPDATE trips SET store_id = ? WHERE store_id = ?', [other.id, st.id]);
      await db.runAsync('DELETE FROM stores WHERE id = ?', [st.id]);
    } else {
      await db.runAsync('UPDATE stores SET key = ? WHERE id = ?', [key, st.id]);
    }
  }
  const list = await db.getAllAsync<{ id: number; name: string; key: string }>('SELECT id, name, key FROM list_items', []);
  for (const l of list.filter((x) => ar(x.name))) {
    const key = productKey(l.name);
    if (!key || key === l.key) continue;
    const other = await db.getFirstAsync<{ id: number }>('SELECT id FROM list_items WHERE key = ? AND id <> ?', [key, l.id]);
    if (other) await db.runAsync('DELETE FROM list_items WHERE id = ?', [l.id]);
    else await db.runAsync('UPDATE list_items SET key = ? WHERE id = ?', [key, l.id]);
  }
}

/** Runs on every open: SQLite only enforces foreign keys when asked to. */
export async function onOpen(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
}

// ---------- stores & products ----------

async function storeId(db: Db, name: string): Promise<number> {
  const clean = cleanName(name);
  const key = productKey(clean);
  const found = await db.getFirstAsync<{ id: number }>('SELECT id FROM stores WHERE key = ?', [key]);
  if (found) return found.id;
  const res = await db.runAsync('INSERT INTO stores (name, key) VALUES (?, ?)', [clean, key]);
  return res.lastInsertRowId;
}

/** Same product typed with other capitals, accents or spacing maps to the existing row. */
async function productId(db: Db, name: string, unit: string): Promise<number> {
  const clean = cleanName(name);
  const key = productKey(clean);
  const found = await db.getFirstAsync<{ id: number }>('SELECT id FROM products WHERE key = ?', [key]);
  if (found) return found.id;
  const res = await db.runAsync('INSERT INTO products (name, key, unit) VALUES (?, ?, ?)', [clean, key, unit]);
  return res.lastInsertRowId;
}

export async function listStores(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT s.name FROM stores s LEFT JOIN trips t ON t.store_id = s.id
     GROUP BY s.id ORDER BY COUNT(t.id) DESC, s.name`,
    [],
  );
  return rows.map((r) => r.name);
}

const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.unit,
    (SELECT COUNT(*) FROM items i WHERE i.product_id = p.id) AS n,
    -- "usual price": the average of the last 3 purchases, so old prices don't drag it down
    (SELECT AVG(x.unit_price) FROM (SELECT i.unit_price FROM items i JOIN trips t ON t.id = i.trip_id
      WHERE i.product_id = p.id ORDER BY t.date DESC, i.id DESC LIMIT 3) x) AS avg_price,
    (SELECT i.unit_price FROM items i JOIN trips t ON t.id = i.trip_id
      WHERE i.product_id = p.id ORDER BY t.date DESC, i.id DESC LIMIT 1) AS last_price,
    (SELECT i.unit_price FROM items i JOIN trips t ON t.id = i.trip_id
      WHERE i.product_id = p.id ORDER BY t.date DESC, i.id DESC LIMIT 1 OFFSET 1) AS prev_price
  FROM products p`;

export async function listProducts(db: Db, search = '', order: 'name' | 'frequent' = 'name', limit = 500): Promise<ProductRow[]> {
  const key = productKey(search);
  const orderBy = order === 'frequent' ? 'n DESC, p.name' : 'p.name COLLATE NOCASE';
  return db.getAllAsync<ProductRow>(
    `${PRODUCT_SELECT} WHERE p.key LIKE ? ORDER BY ${orderBy} LIMIT ?`,
    ['%' + key.replace(/[%_]/g, '') + '%', limit],
  );
}

export async function getProduct(db: Db, id: number): Promise<ProductRow | null> {
  return db.getFirstAsync<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
}

export async function productHistory(db: Db, id: number): Promise<HistoryRow[]> {
  return db.getAllAsync<HistoryRow>(
    `SELECT t.date, s.name AS store, i.unit_price, i.qty
     FROM items i JOIN trips t ON t.id = i.trip_id JOIN stores s ON s.id = t.store_id
     WHERE i.product_id = ? ORDER BY t.date ASC, i.id ASC`,
    [id],
  );
}

/**
 * Renames a product and/or changes its unit. If the new name matches another
 * product, the two are merged and the id of the surviving product is returned.
 */
export async function updateProduct(db: Db, id: number, name: string, unit: string): Promise<number> {
  const clean = cleanName(name);
  const key = productKey(clean);
  if (!key) throw new Error('Nom vide');
  const other = await db.getFirstAsync<{ id: number }>('SELECT id FROM products WHERE key = ? AND id <> ?', [key, id]);
  if (other) {
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE items SET product_id = ? WHERE product_id = ?', [other.id, id]);
      await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
    });
    return other.id;
  }
  await db.runAsync('UPDATE products SET name = ?, key = ?, unit = ? WHERE id = ?', [clean, key, unit, id]);
  return id;
}

// ---------- trips ----------

const TRIP_SELECT = `
  SELECT t.id, t.date, s.name AS store,
    COALESCE(SUM(i.qty * i.unit_price), 0) AS total, COUNT(i.id) AS n
  FROM trips t JOIN stores s ON s.id = t.store_id LEFT JOIN items i ON i.trip_id = t.id`;

export async function listTrips(db: Db, month?: string, limit = 1000): Promise<TripRow[]> {
  if (month) {
    return db.getAllAsync<TripRow>(
      `${TRIP_SELECT} WHERE substr(t.date, 1, 7) = ? GROUP BY t.id ORDER BY t.date DESC, t.id DESC LIMIT ?`,
      [month, limit],
    );
  }
  return db.getAllAsync<TripRow>(`${TRIP_SELECT} GROUP BY t.id ORDER BY t.date DESC, t.id DESC LIMIT ?`, [limit]);
}

export async function listMonths(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ m: string }>('SELECT DISTINCT substr(date, 1, 7) AS m FROM trips ORDER BY m DESC', []);
  return rows.map((r) => r.m);
}

export async function monthSummary(db: Db, month: string): Promise<MonthSummary> {
  const row = await db.getFirstAsync<MonthSummary>(
    `SELECT COUNT(DISTINCT t.id) AS trips, COALESCE(SUM(i.qty * i.unit_price), 0) AS total, COUNT(i.id) AS items
     FROM trips t LEFT JOIN items i ON i.trip_id = t.id WHERE substr(t.date, 1, 7) = ?`,
    [month],
  );
  return row ?? { trips: 0, total: 0, items: 0 };
}

export async function getTrip(db: Db, id: number): Promise<{ trip: TripRow; items: ItemRow[] } | null> {
  const trip = await db.getFirstAsync<TripRow>(`${TRIP_SELECT} WHERE t.id = ? GROUP BY t.id`, [id]);
  if (!trip) return null;
  const items = await db.getAllAsync<ItemRow>(
    `SELECT i.id, i.product_id, p.name, p.unit, i.qty, i.unit_price
     FROM items i JOIN products p ON p.id = i.product_id WHERE i.trip_id = ? ORDER BY i.id`,
    [id],
  );
  return { trip, items };
}

/** A product that is no longer in any trip has no price history left, so it is removed. */
async function dropUnusedProducts(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM products WHERE id NOT IN (SELECT DISTINCT product_id FROM items)', []);
}

async function writeTrip(db: Db, trip: NewTrip): Promise<number> {
  const sid = await storeId(db, trip.store);
  let id = trip.id;
  if (id) {
    await db.runAsync('UPDATE trips SET store_id = ?, date = ? WHERE id = ?', [sid, trip.date, id]);
    await db.runAsync('DELETE FROM items WHERE trip_id = ?', [id]);
  } else {
    const res = await db.runAsync('INSERT INTO trips (store_id, date) VALUES (?, ?)', [sid, trip.date]);
    id = res.lastInsertRowId;
  }
  for (const it of trip.items) {
    const pid = await productId(db, it.name, it.unit);
    await db.runAsync('INSERT INTO items (trip_id, product_id, qty, unit_price) VALUES (?, ?, ?, ?)', [id, pid, it.qty, it.unitPrice]);
  }
  await dropUnusedProducts(db);
  return id;
}

/** Creates a trip, or replaces the content of an existing one when `id` is given. */
export async function saveTrip(db: Db, trip: NewTrip): Promise<number> {
  if (!cleanName(trip.store)) throw new Error('Magasin manquant');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trip.date)) throw new Error('Date invalide');
  if (trip.items.length === 0) throw new Error('Aucun article');
  for (const it of trip.items) {
    if (!productKey(it.name) || !(it.qty > 0) || !(it.unitPrice >= 0)) throw new Error('Article invalide : ' + it.name);
  }
  let id = 0;
  await db.withTransactionAsync(async () => {
    id = await writeTrip(db, trip);
  });
  return id;
}

export async function deleteTrip(db: Db, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM items WHERE trip_id = ?', [id]);
    await db.runAsync('DELETE FROM trips WHERE id = ?', [id]);
    await dropUnusedProducts(db);
  });
}

// ---------- backup ----------

const LIST_MARK = '#liste';
const BUDGET_MARK = '#budget';

export const CSV_HEADER = ['date', 'magasin', 'produit', 'unite', 'quantite', 'prix_unitaire', 'total'];

export async function exportCsv(db: Db): Promise<{ csv: string; rows: number }> {
  const rows = await db.getAllAsync<{ trip_id: number; date: string; store: string; name: string; unit: string; qty: number; unit_price: number }>(
    `SELECT t.id AS trip_id, t.date, s.name AS store, p.name, p.unit, i.qty, i.unit_price
     FROM items i JOIN trips t ON t.id = i.trip_id JOIN stores s ON s.id = t.store_id JOIN products p ON p.id = i.product_id
     ORDER BY t.date, t.id, i.id`,
    [],
  );
  const out: (string | number)[][] = [[...CSV_HEADER, 'course']];
  for (const r of rows) {
    out.push([r.date, r.store, r.name, r.unit, r.qty, r.unit_price, Math.round(r.qty * r.unit_price * 100) / 100, r.trip_id]);
  }
  // The shopping list and the budget ride along on marked lines at the end.
  const list = await db.getAllAsync<{ name: string; done: number }>('SELECT name, done FROM list_items ORDER BY id', []);
  for (const l of list) out.push([LIST_MARK, '', l.name, '', l.done ? 1 : 0, '', '', '']);
  const budget = await getPref(db, 'budget');
  if (budget) out.push([BUDGET_MARK, '', '', '', '', budget, '', '']);
  return { csv: toCsv(out), rows: rows.length };
}

/**
 * Restores a backup made by exportCsv. Replaces everything currently stored.
 * Nothing is changed if the file cannot be read in full.
 */
export async function importCsv(db: Db, text: string): Promise<{ trips: number; items: number }> {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('Fichier vide');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error('Colonne manquante : ' + name);
    return i;
  };
  const cDate = col('date'), cStore = col('magasin'), cName = col('produit'), cUnit = col('unite'), cQty = col('quantite'), cPrice = col('prix_unitaire');
  const cTrip = head.indexOf('course');

  const trips = new Map<string, NewTrip>();
  const list: { name: string; done: boolean }[] = [];
  let budget: string | null = null;
  let items = 0;
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const mark = (r[cDate] ?? '').trim();
    if (mark === LIST_MARK) {
      if (productKey(r[cName] ?? '')) list.push({ name: cleanName(r[cName]), done: (r[cQty] ?? '').trim() === '1' });
      return;
    }
    if (mark === BUDGET_MARK) {
      budget = (r[cPrice] ?? '').trim() || null;
      return;
    }
    if (r.every((c) => !c.trim())) return;
    const date = (r[cDate] ?? '').trim();
    const store = cleanName(r[cStore] ?? '');
    const name = cleanName(r[cName] ?? '');
    const q = parseNumber(r[cQty] ?? '');
    const price = parseNumber(r[cPrice] ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !store || !productKey(name) || !(q > 0) || !(price >= 0)) {
      throw new Error('Ligne ' + line + ' illisible');
    }
    const tripKey = cTrip >= 0 && r[cTrip] ? 'id:' + r[cTrip] : date + '|' + productKey(store);
    let trip = trips.get(tripKey);
    if (!trip) {
      trip = { store, date, items: [] };
      trips.set(tripKey, trip);
    }
    trip.items.push({ name, unit: (r[cUnit] ?? '').trim() || 'pièce', qty: q, unitPrice: price });
    items++;
  });

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM items', []);
    await db.runAsync('DELETE FROM trips', []);
    await db.runAsync('DELETE FROM products', []);
    await db.runAsync('DELETE FROM stores', []);
    for (const trip of trips.values()) await writeTrip(db, trip);
    if (list.length) {
      await db.runAsync('DELETE FROM list_items', []);
      for (const l of list) {
        await db.runAsync('INSERT OR IGNORE INTO list_items (name, key, done) VALUES (?, ?, ?)', [l.name, productKey(l.name), l.done ? 1 : 0]);
      }
    }
    if (budget) await setPref(db, 'budget', budget);
  });
  return { trips: trips.size, items };
}

export async function counts(db: Db): Promise<{ trips: number; products: number; items: number }> {
  const row = await db.getFirstAsync<{ trips: number; products: number; items: number }>(
    `SELECT (SELECT COUNT(*) FROM trips) AS trips, (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM items) AS items`,
    [],
  );
  return row ?? { trips: 0, products: 0, items: 0 };
}

// ---------- preferences ----------

export async function getPref(db: Db, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM prefs WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setPref(db: Db, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

// ---------- statistics ----------

export type StoreSpend = { store: string; total: number; trips: number };
export type ProductSpend = { id: number; name: string; total: number; qty: number; unit: string };
export type PriceMove = { id: number; name: string; unit: string; before: number; now: number; change: number; spend: number };
export type MonthStats = {
  month: string;
  total: number;
  trips: number;
  prevTotal: number;
  byStore: StoreSpend[];
  topProducts: ProductSpend[];
  moves: PriceMove[];
  /** Spend-weighted average price change vs. the last price paid before this month, in %. null when nothing to compare. */
  inflation: number | null;
  compared: number;
};

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export async function monthStats(db: Db, month: string): Promise<MonthStats> {
  const sum = await monthSummary(db, month);
  const prev = await monthSummary(db, prevMonth(month));
  const byStore = await db.getAllAsync<StoreSpend>(
    `SELECT s.name AS store, SUM(i.qty * i.unit_price) AS total, COUNT(DISTINCT t.id) AS trips
     FROM items i JOIN trips t ON t.id = i.trip_id JOIN stores s ON s.id = t.store_id
     WHERE substr(t.date, 1, 7) = ? GROUP BY s.id ORDER BY total DESC`,
    [month],
  );
  const topProducts = await db.getAllAsync<ProductSpend>(
    `SELECT p.id, p.name, p.unit, SUM(i.qty * i.unit_price) AS total, SUM(i.qty) AS qty
     FROM items i JOIN trips t ON t.id = i.trip_id JOIN products p ON p.id = i.product_id
     WHERE substr(t.date, 1, 7) = ? GROUP BY p.id ORDER BY total DESC LIMIT 5`,
    [month],
  );
  // For each product bought this month: latest price this month vs. latest price before the month started.
  const rows = await db.getAllAsync<{ id: number; name: string; unit: string; now: number; before: number | null; spend: number }>(
    `SELECT p.id, p.name, p.unit,
       (SELECT i2.unit_price FROM items i2 JOIN trips t2 ON t2.id = i2.trip_id
         WHERE i2.product_id = p.id AND substr(t2.date, 1, 7) = ?1 ORDER BY t2.date DESC, i2.id DESC LIMIT 1) AS now,
       (SELECT i3.unit_price FROM items i3 JOIN trips t3 ON t3.id = i3.trip_id
         WHERE i3.product_id = p.id AND t3.date < ?1 || '-01' ORDER BY t3.date DESC, i3.id DESC LIMIT 1) AS before,
       SUM(i.qty * i.unit_price) AS spend
     FROM items i JOIN trips t ON t.id = i.trip_id JOIN products p ON p.id = i.product_id
     WHERE substr(t.date, 1, 7) = ?1 GROUP BY p.id`,
    [month],
  );
  const moves: PriceMove[] = rows
    .filter((r) => r.before !== null && r.before > 0)
    .map((r) => ({ id: r.id, name: r.name, unit: r.unit, before: r.before as number, now: r.now, spend: r.spend, change: ((r.now - (r.before as number)) / (r.before as number)) * 100 }));
  const weight = moves.reduce((a, m) => a + m.spend, 0);
  const inflation = moves.length && weight > 0 ? moves.reduce((a, m) => a + m.change * m.spend, 0) / weight : null;
  moves.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return { month, total: sum.total, trips: sum.trips, prevTotal: prev.total, byStore, topProducts, moves, inflation, compared: moves.length };
}

// ---------- "bch7al ?" : what do I usually pay, and where is it cheapest ----------

export type StorePrice = { store: string; price: number; date: string; n: number; /** the most recent purchase of all */ latest: boolean };

/** Latest price paid in each store for one product, cheapest first. */
export async function pricesByStore(db: Db, productId: number): Promise<StorePrice[]> {
  const rows = await db.getAllAsync<{ store: string; price: number; date: string }>(
    `SELECT s.name AS store, i.unit_price AS price, t.date
     FROM items i JOIN trips t ON t.id = i.trip_id JOIN stores s ON s.id = t.store_id
     WHERE i.product_id = ? ORDER BY t.date DESC, i.id DESC`,
    [productId],
  );
  const byStore = new Map<string, StorePrice>();
  for (const r of rows) {
    const seen = byStore.get(r.store);
    if (seen) seen.n++;
    else byStore.set(r.store, { ...r, n: 1, latest: byStore.size === 0 });
  }
  return [...byStore.values()].sort((a, b) => a.price - b.price || (a.date < b.date ? 1 : -1));
}

/**
 * For each line of a trip: is its price mzyan / normal / ghali compared with the last 3
 * purchases of the same product before that day? Lines never bought before get null.
 */
export async function tripVerdicts(db: Db, tripId: number): Promise<Record<number, Verdict | null>> {
  const rows = await db.getAllAsync<{ id: number; unit_price: number; usual: number | null }>(
    `SELECT i.id, i.unit_price,
       (SELECT AVG(x.unit_price) FROM (SELECT o.unit_price FROM items o JOIN trips ot ON ot.id = o.trip_id
          WHERE o.product_id = i.product_id AND ot.date < t.date ORDER BY ot.date DESC, o.id DESC LIMIT 3) x) AS usual
     FROM items i JOIN trips t ON t.id = i.trip_id WHERE i.trip_id = ?`,
    [tripId],
  );
  const out: Record<number, Verdict | null> = {};
  for (const r of rows) out[r.id] = verdict(r.unit_price, r.usual);
  return out;
}

/** Money spent in each week of a month: days 1–7, 8–14, 15–21, 22 to the end. */
export async function weekSpend(db: Db, month: string): Promise<number[]> {
  const rows = await db.getAllAsync<{ w: number; total: number }>(
    `SELECT MIN(3, (CAST(substr(t.date, 9, 2) AS INTEGER) - 1) / 7) AS w, SUM(i.qty * i.unit_price) AS total
     FROM items i JOIN trips t ON t.id = i.trip_id WHERE substr(t.date, 1, 7) = ? GROUP BY w`,
    [month],
  );
  const weeks = [0, 0, 0, 0];
  for (const r of rows) weeks[r.w] = r.total;
  return weeks;
}

// ---------- shopping list ----------

export type ListRow = { id: number; name: string; done: number };
export type ListLine = ListRow & { unit: string | null; best: { store: string; price: number } | null; prices: Record<string, number> };
export type StorePlan = { store: string; total: number; covered: number; cheapest: number };
export type ListPlan = { lines: ListLine[]; stores: StorePlan[]; todo: number; known: number };

/** Adds an article to the list. Returns false when it is already there (it is then un-ticked). */
export async function addListItem(db: Db, name: string): Promise<boolean> {
  const clean = cleanName(name);
  const key = productKey(clean);
  if (!key) throw new Error('Nom vide');
  const found = await db.getFirstAsync<{ id: number }>('SELECT id FROM list_items WHERE key = ?', [key]);
  if (found) {
    await db.runAsync('UPDATE list_items SET done = 0 WHERE id = ?', [found.id]);
    return false;
  }
  // An article already bought keeps the spelling of its price history.
  const product = await db.getFirstAsync<{ name: string }>('SELECT name FROM products WHERE key = ?', [key]);
  await db.runAsync('INSERT INTO list_items (name, key) VALUES (?, ?)', [product?.name ?? clean, key]);
  return true;
}

export async function setListDone(db: Db, id: number, done: boolean): Promise<void> {
  await db.runAsync('UPDATE list_items SET done = ? WHERE id = ?', [done ? 1 : 0, id]);
}

export async function removeListItem(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM list_items WHERE id = ?', [id]);
}

export async function clearListDone(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM list_items WHERE done = 1', []);
}

export async function listCount(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM list_items WHERE done = 0', []);
  return row?.n ?? 0;
}

/**
 * The list with, for each article, the latest price paid in each store, and the stores
 * ranked for what is still to buy: the one that has the most of the list first, then the
 * one that is cheapest for the most articles.
 */
export async function listPlan(db: Db): Promise<ListPlan> {
  const rows = await db.getAllAsync<ListRow & { key: string }>('SELECT id, name, key, done FROM list_items ORDER BY done, id', []);
  const prices = await db.getAllAsync<{ key: string; unit: string; store: string; price: number }>(
    `SELECT p.key, p.unit, s.name AS store, i.unit_price AS price
     FROM items i JOIN trips t ON t.id = i.trip_id JOIN stores s ON s.id = t.store_id JOIN products p ON p.id = i.product_id
     WHERE p.key IN (SELECT key FROM list_items) ORDER BY t.date DESC, i.id DESC`,
    [],
  );
  const latest = new Map<string, { unit: string; prices: Record<string, number> }>();
  for (const r of prices) {
    let e = latest.get(r.key);
    if (!e) latest.set(r.key, (e = { unit: r.unit, prices: {} }));
    if (!(r.store in e.prices)) e.prices[r.store] = r.price; // rows come newest first
  }
  const lines: ListLine[] = rows.map(({ key, ...row }) => {
    const e = latest.get(key);
    const all = Object.entries(e?.prices ?? {}).sort((a, b) => a[1] - b[1]);
    return { ...row, unit: e?.unit ?? null, prices: e?.prices ?? {}, best: all.length ? { store: all[0][0], price: all[0][1] } : null };
  });
  const todo = lines.filter((l) => !l.done);
  const plan = new Map<string, StorePlan>();
  for (const l of todo) {
    for (const [store, price] of Object.entries(l.prices)) {
      const sp = plan.get(store) ?? { store, total: 0, covered: 0, cheapest: 0 };
      sp.total += price;
      sp.covered++;
      if (l.best && price <= l.best.price) sp.cheapest++;
      plan.set(store, sp);
    }
  }
  const stores = [...plan.values()].sort((a, b) => b.covered - a.covered || b.cheapest - a.cheapest || a.total - b.total);
  return { lines, stores, todo: todo.length, known: todo.filter((l) => l.best).length };
}

// ---------- "Ton mois" ----------

export type MonthRecap = {
  month: string;
  total: number;
  trips: number;
  prevTotal: number;
  items: number;
  /** Where most of the money went. */
  mainStore: StoreSpend | null;
  /** The store whose prices this month beat what the same products cost elsewhere. */
  bestStore: { store: string; saved: number } | null;
  rise: PriceMove | null;
  drop: PriceMove | null;
  inflation: number | null;
};

export async function monthRecap(db: Db, month: string): Promise<MonthRecap> {
  const stats = await monthStats(db, month);
  const sum = await monthSummary(db, month);
  const bought = await db.getAllAsync<{ product_id: number; store: string; qty: number; unit_price: number }>(
    `SELECT i.product_id, s.name AS store, i.qty, i.unit_price
     FROM items i JOIN trips t ON t.id = i.trip_id JOIN stores s ON s.id = t.store_id WHERE substr(t.date, 1, 7) = ?`,
    [month],
  );
  const avgs = await db.getAllAsync<{ product_id: number; store: string; avg: number }>(
    `SELECT i.product_id, s.name AS store, AVG(i.unit_price) AS avg
     FROM items i JOIN trips t ON t.id = i.trip_id JOIN stores s ON s.id = t.store_id GROUP BY i.product_id, s.id`,
    [],
  );
  const elsewhere = new Map<number, { store: string; avg: number }[]>();
  for (const a of avgs) elsewhere.set(a.product_id, [...(elsewhere.get(a.product_id) ?? []), a]);
  const saved = new Map<string, number>();
  for (const b of bought) {
    const others = (elsewhere.get(b.product_id) ?? []).filter((o) => o.store !== b.store);
    if (!others.length) continue;
    const ref = others.reduce((x, o) => x + o.avg, 0) / others.length;
    saved.set(b.store, (saved.get(b.store) ?? 0) + (ref - b.unit_price) * b.qty);
  }
  const best = [...saved.entries()].sort((a, b) => b[1] - a[1])[0];
  const real = stats.moves.filter((m) => !/timbre/i.test(m.name));
  const rise = [...real].sort((a, b) => b.change - a.change)[0];
  const drop = [...real].sort((a, b) => a.change - b.change)[0];
  return {
    month,
    total: stats.total,
    trips: stats.trips,
    prevTotal: stats.prevTotal,
    items: sum.items,
    mainStore: stats.byStore[0] ?? null,
    bestStore: best && best[1] >= 0.5 ? { store: best[0], saved: Math.round(best[1] * 100) / 100 } : null,
    rise: rise && rise.change > 0.05 ? rise : null,
    drop: drop && drop.change < -0.05 ? drop : null,
    inflation: stats.inflation,
  };
}

export function previousMonth(month: string): string {
  return prevMonth(month);
}
