// Runs the real database code against an in-memory SQLite in Node.
// Usage: npx tsx scripts/test-db.ts
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import * as D from '../src/db';
import { money, parseNumber, productKey, parseCsv, toCsv, addDays, pctChange } from '../src/format';

function adapter(): any {
  const raw = new DatabaseSync(':memory:');
  return {
    async execAsync(sql: string) { raw.exec(sql); },
    async runAsync(sql: string, params: any[] = []) {
      const r = raw.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getAllAsync(sql: string, params: any[] = []) { return raw.prepare(sql).all(...params).map((r: any) => ({ ...r })); },
    async getFirstAsync(sql: string, params: any[] = []) { const r = raw.prepare(sql).get(...params); return r ? { ...r } : null; },
    async withTransactionAsync(fn: () => Promise<void>) {
      raw.exec('BEGIN');
      try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
  };
}

async function main() {
  // format helpers
  assert.equal(money(1240.5), '1 240,50');
  assert.equal(money(6.5), '6,50');
  assert.equal(parseNumber('12,50'), 12.5);
  assert.equal(parseNumber(' 7 '), 7);
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('')));
  assert.equal(productKey('  Lait   Centrale 1L '), productKey('lait centrale 1l'));
  assert.equal(productKey('Œufs'), productKey('œufs'));
  assert.equal(productKey('Thé Sultan'), 'the sultan');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
  assert.equal(pctChange(100, 104.3)!.toFixed(1), '4.3');
  assert.deepEqual(parseCsv(toCsv([['a;b', 'c"d', 3]])), [['a;b', 'c"d', '3']]);

  const db = adapter();
  await D.onOpen(db);
  await D.onOpen(db); // migration is safe to run twice

  const t1 = await D.saveTrip(db, { store: 'Marjane', date: '2026-10-24', items: [
    { name: 'Huile Lesieur 5L', unit: 'pièce', qty: 1, unitPrice: 96.5 },
    { name: 'Tomates', unit: 'kg', qty: 2, unitPrice: 8 },
  ] });
  const t2 = await D.saveTrip(db, { store: 'marjane ', date: '2026-11-09', items: [
    { name: 'huile lesieur 5l', unit: 'kg', qty: 1, unitPrice: 98 }, // same product, other spelling, unit ignored
    { name: 'Lait Centrale 1L', unit: 'pièce', qty: 6, unitPrice: 7.5 },
  ] });
  await D.saveTrip(db, { store: 'Souk', date: '2026-11-06', items: [
    { name: 'TOMATES', unit: 'kg', qty: 1.5, unitPrice: 6.5 },
  ] });

  assert.deepEqual(await D.listStores(db), ['Marjane', 'Souk']);
  const products = await D.listProducts(db);
  assert.equal(products.length, 3, 'spelling variants must not create duplicates');
  const huile = products.find((p) => p.name === 'Huile Lesieur 5L')!;
  assert.equal(huile.unit, 'pièce');
  assert.equal(huile.n, 2);
  assert.equal(huile.last_price, 98);
  assert.equal(huile.prev_price, 96.5);
  const tomates = products.find((p) => productKey(p.name) === 'tomates')!;
  assert.equal(tomates.last_price, 6.5);
  assert.equal(tomates.prev_price, 8);
  assert.equal((await D.listProducts(db, 'LAIT')).length, 1);
  assert.equal((await D.listProducts(db, '', 'frequent'))[0].n, 2);

  const nov = await D.monthSummary(db, '2026-11');
  assert.equal(nov.trips, 2);
  assert.equal(nov.items, 3);
  assert.equal(Math.round(nov.total * 100) / 100, 98 + 45 + 9.75);
  assert.deepEqual(await D.monthSummary(db, '2025-01'), { trips: 0, total: 0, items: 0 });
  assert.deepEqual(await D.listMonths(db), ['2026-11', '2026-10']);
  const trips = await D.listTrips(db, '2026-11');
  assert.deepEqual(trips.map((t) => t.date), ['2026-11-09', '2026-11-06']);
  assert.equal(trips[0].total, 143);
  assert.equal((await D.listTrips(db)).length, 3);

  const hist = await D.productHistory(db, huile.id);
  assert.deepEqual(hist.map((h) => h.unit_price), [96.5, 98]);

  // edit a trip: items are replaced, not duplicated
  await D.saveTrip(db, { id: t2, store: 'BIM', date: '2026-11-10', items: [
    { name: 'Huile Lesieur 5L', unit: 'pièce', qty: 2, unitPrice: 97 },
  ] });
  const edited = (await D.getTrip(db, t2))!;
  assert.equal(edited.trip.store, 'BIM');
  assert.equal(edited.trip.date, '2026-11-10');
  assert.equal(edited.items.length, 1);
  assert.equal(edited.trip.total, 194);

  // invalid trips change nothing
  await assert.rejects(D.saveTrip(db, { store: 'BIM', date: '2026-11-10', items: [] }));
  await assert.rejects(D.saveTrip(db, { store: '', date: '2026-11-10', items: [{ name: 'x', unit: 'kg', qty: 1, unitPrice: 1 }] }));
  await assert.rejects(D.saveTrip(db, { store: 'BIM', date: '2026-11-10', items: [
    { name: 'Riz', unit: 'kg', qty: 1, unitPrice: 10 }, { name: 'Bad', unit: 'kg', qty: 0, unitPrice: 10 },
  ] }));
  assert.equal((await D.listProducts(db, 'riz')).length, 0, 'failed save must roll back');
  assert.equal((await D.counts(db)).trips, 3);

  // the edit removed the only purchase of milk, so that product is gone
  assert.equal((await D.listProducts(db, 'lait')).length, 0);
  const t4 = await D.saveTrip(db, { store: 'Hanout', date: '2026-11-11', items: [{ name: 'Lait Centrale 1L', unit: 'pièce', qty: 2, unitPrice: 7.8 }] });

  // rename, then merge by renaming onto an existing product
  const lait = (await D.listProducts(db, 'lait'))[0];
  assert.equal(await D.updateProduct(db, lait.id, 'Lait entier 1L', 'L'), lait.id);
  assert.equal((await D.getProduct(db, lait.id))!.unit, 'L');
  const merged = await D.updateProduct(db, tomates.id, 'huile lesieur 5L', 'kg');
  assert.equal(merged, huile.id);
  assert.equal(await D.getProduct(db, tomates.id), null);
  assert.equal((await D.getProduct(db, huile.id))!.n, 4);

  // backup round trip
  const before = await D.exportCsv(db);
  const snapshot = JSON.stringify([await D.listTrips(db), await D.listProducts(db)].map((l) => l.map((r: any) => ({ ...r, id: 0 }))));
  await D.deleteTrip(db, t1);
  await D.deleteTrip(db, t4);
  assert.equal((await D.listProducts(db, 'lait')).length, 0, 'deleting the last purchase removes the product');
  assert.equal((await D.counts(db)).trips, 2);
  assert.equal(await D.getTrip(db, t1), null);
  const restored = await D.importCsv(db, before.csv);
  assert.equal(restored.items, before.rows);
  assert.equal(restored.trips, 4);
  const after = JSON.stringify([await D.listTrips(db), await D.listProducts(db)].map((l) => l.map((r: any) => ({ ...r, id: 0 }))));
  assert.equal(after, snapshot, 'restore must give back the same data');
  assert.equal((await D.exportCsv(db)).csv.replace(/;\d+\n/g, '\n'), before.csv.replace(/;\d+\n/g, '\n'));

  // a broken backup must not wipe the data
  await assert.rejects(D.importCsv(db, 'date;magasin;produit;unite;quantite;prix_unitaire\n2026-11-01;BIM;Riz;kg;abc;10\n'));
  await assert.rejects(D.importCsv(db, 'nope;nope\n1;2\n'));
  assert.equal((await D.counts(db)).trips, 4);

  console.log('All database checks passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
