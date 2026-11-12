// All database access lives here. Only type imports from expo-sqlite, so the
// logic can be exercised in Node with any object exposing the same methods.
import type { SQLiteDatabase } from 'expo-sqlite';
import { cleanName, productKey, parseCsv, parseNumber, toCsv } from './format';

export type Db = SQLiteDatabase;

export type TripRow = { id: number; date: string; store: string; total: number; n: number };
export type ItemRow = { id: number; product_id: number; name: string; unit: string; qty: number; unit_price: number };
export type ProductRow = { id: number; name: string; unit: string; n: number; last_price: number | null; prev_price: number | null };
export type HistoryRow = { date: string; store: string; unit_price: number; qty: number };
export type MonthSummary = { trips: number; total: number; items: number };
export type NewItem = { name: string; unit: string; qty: number; unitPrice: number };
export type NewTrip = { id?: number; store: string; date: string; items: NewItem[] };

const DATABASE_VERSION = 1;

export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;
  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE stores (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE
      );
      CREATE TABLE products (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE,
        unit TEXT NOT NULL DEFAULT 'pièce'
      );
      CREATE TABLE trips (
        id INTEGER PRIMARY KEY NOT NULL,
        store_id INTEGER NOT NULL REFERENCES stores(id),
        date TEXT NOT NULL
      );
      CREATE TABLE items (
        id INTEGER PRIMARY KEY NOT NULL,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        qty REAL NOT NULL,
        unit_price REAL NOT NULL
      );
      CREATE INDEX items_trip ON items(trip_id);
      CREATE INDEX items_product ON items(product_id);
      CREATE INDEX trips_date ON trips(date);
    `);
    version = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
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
  let items = 0;
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2;
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
