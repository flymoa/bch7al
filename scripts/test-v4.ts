// v4 « Majorelle Nuit »: aliases, promo flag, pack sizes, name matching, price effect.
// Usage: npx tsx scripts/test-v4.ts
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import * as D from '../src/db';
import { basePrice, closestName, dh, packSize, ryal, similarity, verdict } from '../src/format';
import { productIcon, storeIcon } from '../src/icons';

function adapter(): any {
  const raw = new DatabaseSync(':memory:');
  return {
    async execAsync(sql: string) { raw.exec(sql); },
    async runAsync(sql: string, params: any[] = []) { const r = raw.prepare(sql).run(...params); return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) }; },
    async getAllAsync(sql: string, params: any[] = []) { return raw.prepare(sql).all(...params).map((r: any) => ({ ...r })); },
    async getFirstAsync(sql: string, params: any[] = []) { const r = raw.prepare(sql).get(...params); return r ? { ...r } : null; },
    async withTransactionAsync(fn: () => Promise<void>) { raw.exec('BEGIN'); try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
  };
}

async function main() {
  // pack sizes -> price per kg / L
  assert.deepEqual(packSize('Huile Lesieur 5L'), { amount: 5, base: 'L' });
  assert.deepEqual(packSize('Farine 500G'), { amount: 0.5, base: 'kg' });
  assert.deepEqual(packSize('Coca 33CL'), { amount: 0.33, base: 'L' });
  assert.deepEqual(packSize('Eau Sidi Ali 6x1,5L'), { amount: 9, base: 'L' });
  assert.equal(packSize('Lait Centrale'), null);
  assert.equal(packSize('Pile LR06'), null);
  assert.deepEqual(basePrice(96.5, 'pièce', 'Huile 5L'), { price: 19.3, base: 'L' });
  assert.equal(basePrice(7.5, 'pièce', 'Lait 1L'), null, 'a 1 L pack adds nothing');
  assert.deepEqual(basePrice(8, 'kg', 'Tomates'), { price: 8, base: 'kg' });
  assert.equal(dh(12.5), '12,50 DH');
  assert.equal(ryal(6), '120 ryal');

  // name matching
  assert.ok(similarity('LAIT CENTRALE 1L DEMI', 'Lait Centrale 1L') >= 0.6);
  assert.ok(similarity('Huile Lesieur', 'Farine Mouna') < 0.3);
  const known = [{ name: 'Lait Centrale 1L' }, { name: 'Huile Lesieur 5L' }];
  assert.equal(closestName('LAIT CENTRALE DEMI ECR', known)?.name, 'Lait Centrale 1L');
  assert.equal(closestName('Lait Centrale 1L', known), null, 'exact names need no question');
  assert.equal(closestName('Sardines', known), null);

  // verdict band ±5 %
  assert.equal(verdict(7.3, 7)!.kind, 'normal');
  assert.equal(verdict(7.4, 7)!.kind, 'high');
  assert.equal(verdict(6.6, 7)!.kind, 'good');

  // icons never fall back to colour emoji, always a named icon
  assert.equal(productIcon('Lait Centrale'), 'dairy');
  assert.equal(storeIcon('Souk Had'), 'market');

  const db = adapter();
  await D.onOpen(db);
  await D.onOpen(db);
  const t1 = await D.saveTrip(db, { store: 'Marjane', date: '2026-10-01', items: [
    { name: 'Lait Centrale 1L', unit: 'pièce', qty: 2, unitPrice: 7 },
    { name: 'Huile Lesieur 5L', unit: 'pièce', qty: 1, unitPrice: 95 },
  ] });
  await D.saveTrip(db, { store: 'BIM', date: '2026-10-08', items: [{ name: 'Lait Centrale 1L', unit: 'pièce', qty: 1, unitPrice: 7.2 }] });
  // promo price stays out of the usual price
  await D.saveTrip(db, { store: 'Carrefour', date: '2026-10-15', items: [{ name: 'Lait Centrale 1L', unit: 'pièce', qty: 4, unitPrice: 5, promo: true }] });
  let milk = (await D.findProduct(db, 'lait centrale 1l'))!;
  assert.equal(milk.avg_price!.toFixed(2), ((7 + 7.2) / 2).toFixed(2), 'promo excluded from usual price');
  const hist = await D.productHistory(db, milk.id);
  assert.equal(hist.filter((h) => h.promo).length, 1);

  // alias: a receipt spelling linked once resolves by itself next time
  await D.addAlias(db, 'LAIT CENTRALE DEMI ECR', milk.id);
  assert.equal((await D.findProduct(db, 'Lait centrale demi ecr'))!.id, milk.id);
  await D.saveTrip(db, { store: 'Marjane', date: '2026-11-02', items: [{ name: 'LAIT CENTRALE DEMI ECR', unit: 'pièce', qty: 1, unitPrice: 7.5 }] });
  milk = (await D.getProduct(db, milk.id))!;
  assert.equal(milk.n, 4, 'scanned spelling joined the same history');
  assert.equal((await D.listProducts(db)).length, 2);
  assert.deepEqual(await D.listAliases(db, milk.id), ['lait centrale demi ecr']);

  // rename keeps the old spelling as an alias; merge moves aliases to the survivor
  const huile = (await D.findProduct(db, 'Huile Lesieur 5L'))!;
  await D.updateProduct(db, huile.id, 'Huile de table 5L', 'pièce');
  assert.equal((await D.findProduct(db, 'huile lesieur 5l'))!.id, huile.id);
  const t5 = await D.saveTrip(db, { store: 'BIM', date: '2026-11-03', items: [{ name: 'Lait UHT 1L', unit: 'pièce', qty: 1, unitPrice: 7 }] });
  const uht = (await D.findProduct(db, 'Lait UHT 1L'))!;
  const survivor = await D.updateProduct(db, uht.id, 'Lait Centrale 1L', 'pièce');
  assert.equal(survivor, milk.id);
  assert.equal((await D.findProduct(db, 'lait uht 1l'))!.id, milk.id, 'merged name points at the survivor');

  // backup round trip keeps promo and aliases
  const { csv } = await D.exportCsv(db);
  assert.match(csv, /;promo;course/);
  const db2 = adapter();
  await D.onOpen(db2);
  await D.importCsv(db2, csv);
  const milk2 = (await D.findProduct(db2, 'LAIT CENTRALE DEMI ECR'))!;
  assert.equal(milk2.name, 'Lait Centrale 1L');
  assert.equal((await D.productHistory(db2, milk2.id)).filter((h) => h.promo).length, 1);

  // month: price effect = (now − before) × qty
  const nov = await D.monthStats(db, '2026-11');
  assert.ok(nov.priceEffect > 0, 'milk dearer in November');
  void t1; void t5;

  // a v4 database (version 4) upgrades in place without losing anything
  const old = adapter();
  await old.execAsync(`CREATE TABLE stores (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, key TEXT NOT NULL UNIQUE);
    CREATE TABLE products (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, key TEXT NOT NULL UNIQUE, unit TEXT NOT NULL DEFAULT 'pièce');
    CREATE TABLE trips (id INTEGER PRIMARY KEY NOT NULL, store_id INTEGER NOT NULL REFERENCES stores(id), date TEXT NOT NULL);
    CREATE TABLE items (id INTEGER PRIMARY KEY NOT NULL, trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), qty REAL NOT NULL, unit_price REAL NOT NULL);
    CREATE TABLE prefs (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE list_items (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, key TEXT NOT NULL UNIQUE, done INTEGER NOT NULL DEFAULT 0);
    INSERT INTO stores VALUES (1, 'BIM', 'bim'); INSERT INTO products VALUES (1, 'Sucre', 'sucre', 'kg');
    INSERT INTO trips VALUES (1, 1, '2026-09-01'); INSERT INTO items VALUES (1, 1, 1, 2, 9.5);
    PRAGMA user_version = 4;`);
  await D.onOpen(old);
  const sugar = (await D.getTrip(old, 1))!;
  assert.equal(sugar.items[0].unit_price, 9.5);
  assert.equal(sugar.items[0].promo, 0);
  // a phone whose user_version is already 5 but has no aliases table / promo column is repaired
  const ahead = adapter();
  await ahead.execAsync(`CREATE TABLE stores (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, key TEXT NOT NULL UNIQUE);
    CREATE TABLE products (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, key TEXT NOT NULL UNIQUE, unit TEXT NOT NULL DEFAULT 'pièce');
    CREATE TABLE trips (id INTEGER PRIMARY KEY NOT NULL, store_id INTEGER NOT NULL REFERENCES stores(id), date TEXT NOT NULL);
    CREATE TABLE items (id INTEGER PRIMARY KEY NOT NULL, trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), qty REAL NOT NULL, unit_price REAL NOT NULL);
    INSERT INTO stores VALUES (1, 'BIM', 'bim'); INSERT INTO products VALUES (1, 'Sucre', 'sucre', 'kg');
    INSERT INTO trips VALUES (1, 1, '2026-09-01'); INSERT INTO items VALUES (1, 1, 1, 2, 9.5);
    PRAGMA user_version = 5;`);
  await D.onOpen(ahead);
  assert.deepEqual(await D.schemaInfo(ahead), { version: 5, ok: true });
  assert.equal((await D.getTrip(ahead, 1))!.items[0].promo, 0, 'trip opens');
  assert.equal((await D.listProducts(ahead)).length, 1, 'products list works');
  assert.equal(await D.findProduct(ahead, 'Sucre').then((p) => p!.name), 'Sucre', 'scan lookup works');
  console.log('v4 tests passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
