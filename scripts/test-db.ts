// Runs the real database code against an in-memory SQLite in Node.
// Usage: npx tsx scripts/test-db.ts
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import * as D from '../src/db';
import { qtyLabel, money, parseNumber, productKey, parseCsv, toCsv, addDays, pctChange, verdict } from '../src/format';

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
  assert.equal(qtyLabel(0.75, 'kg'), '750 g');
  assert.equal(qtyLabel(1.5, 'kg'), '1,5 kg');
  assert.equal(qtyLabel(0.33, 'L'), '330 mL');
  assert.equal(qtyLabel(3, 'pièce'), '3');
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
    { name: 'huile lesieur 5l', unit: 'pièce', qty: 1, unitPrice: 98 }, // same product, other spelling
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

  // statistics on a fresh database
  const sdb = adapter();
  await D.onOpen(sdb);
  await D.saveTrip(sdb, { store: 'BIM', date: '2026-10-05', items: [
    { name: 'Lait', unit: 'L', qty: 4, unitPrice: 7 }, { name: 'Riz', unit: 'kg', qty: 1, unitPrice: 10 }] });
  await D.saveTrip(sdb, { store: 'BIM', date: '2026-11-03', items: [
    { name: 'Lait', unit: 'L', qty: 4, unitPrice: 7.7 }, { name: 'Riz', unit: 'kg', qty: 1, unitPrice: 9 }, { name: 'Sucre', unit: 'kg', qty: 2, unitPrice: 10 }] });
  await D.saveTrip(sdb, { store: 'Souk', date: '2026-11-08', items: [{ name: 'Tomates', unit: 'kg', qty: 2, unitPrice: 6 }] });
  const ms = await D.monthStats(sdb, '2026-11');
  assert.equal(ms.trips, 2);
  assert.equal(Math.round(ms.total * 100) / 100, 30.8 + 9 + 20 + 12);
  assert.equal(ms.prevTotal, 38);
  assert.deepEqual(ms.byStore.map((x) => x.store), ['BIM', 'Souk']);
  assert.equal(ms.topProducts[0].name, 'Lait');
  assert.equal(ms.compared, 2, 'only products with an earlier price are compared');
  // lait +10 % on 30.8 MAD, riz -10 % on 9 MAD -> (10*30.8 - 10*9) / 39.8
  assert.equal(ms.inflation!.toFixed(3), ((10 * 30.8 - 10 * 9) / 39.8).toFixed(3));
  assert.equal(ms.moves[0].name, 'Lait');
  const empty = await D.monthStats(sdb, '2025-01');
  assert.equal(empty.inflation, null);
  assert.equal(empty.total, 0);
  const jan = await D.monthStats(sdb, '2027-01');
  assert.equal(jan.prevTotal, 0);
  await D.setPref(sdb, 'budget', '2000');
  await D.setPref(sdb, 'budget', '2500');
  assert.equal(await D.getPref(sdb, 'budget'), '2500');
  assert.equal(await D.getPref(sdb, 'nope'), null);

  // bch7al ? : latest price per store, cheapest first
  await D.saveTrip(sdb, { store: 'Marjane', date: '2026-11-10', items: [
    { name: 'Lait', unit: 'L', qty: 2, unitPrice: 7.2 }, { name: 'Sucre', unit: 'kg', qty: 1, unitPrice: 11 }] });
  const milk = (await D.listProducts(sdb, "lait"))[0];
  assert.equal(milk.avg_price!.toFixed(2), ((7 + 7.7 + 7.2) / 3).toFixed(2));
  const where = await D.pricesByStore(sdb, milk.id);
  assert.deepEqual(where.map((w) => [w.store, w.price, w.n, w.latest]), [['Marjane', 7.2, 1, true], ['BIM', 7.7, 2, false]]);
  assert.deepEqual(verdict(6.5, 7), { kind: 'good', change: ((6.5 - 7) / 7) * 100 });
  assert.equal(verdict(7.1, 7)!.kind, 'normal');
  assert.equal(verdict(8, 7)!.kind, 'high');
  assert.equal(verdict(8, null), null);

  // shopping list
  assert.equal(await D.addListItem(sdb, 'lait'), true);
  assert.equal(await D.addListItem(sdb, ' LAIT '), false, 'same article is not added twice');
  await D.addListItem(sdb, 'Sucre');
  await D.addListItem(sdb, 'Tomates');
  await D.addListItem(sdb, 'Savon noir');
  assert.equal(await D.listCount(sdb), 4);
  let plan = await D.listPlan(sdb);
  assert.deepEqual(plan.lines.map((l) => [l.name, l.best?.store ?? null, l.best?.price ?? null]), [
    ['Lait', 'Marjane', 7.2], ['Sucre', 'BIM', 10], ['Tomates', 'Souk', 6], ['Savon noir', null, null]]);
  assert.equal(plan.known, 3);
  // BIM and Marjane both have lait + sucre: Marjane 18.2, BIM 17.7 -> BIM first
  assert.deepEqual(plan.stores.map((x) => [x.store, x.covered, Math.round(x.total * 100) / 100]), [['BIM', 2, 17.7], ['Marjane', 2, 18.2], ['Souk', 1, 6]]);
  await D.setListDone(sdb, plan.lines[1].id, true);
  plan = await D.listPlan(sdb);
  assert.equal(plan.todo, 3);
  assert.equal(plan.lines[plan.lines.length - 1].name, 'Sucre', 'ticked articles go last');
  assert.deepEqual(plan.stores.map((x) => x.store).sort(), ['BIM', 'Marjane', 'Souk']);
  assert.equal(plan.stores.find((x) => x.store === 'BIM')!.covered, 1, 'only what is left to buy is compared');
  await D.clearListDone(sdb);
  assert.equal((await D.listPlan(sdb)).lines.length, 3);
  await D.removeListItem(sdb, plan.lines[0].id);
  assert.equal(await D.listCount(sdb), 2);

  // Ton mois
  const recap = await D.monthRecap(sdb, '2026-11');
  assert.equal(recap.trips, 3);
  assert.equal(recap.mainStore!.store, 'BIM');
  // Marjane: lait 7.2 vs BIM average 7.35 on 2 L (+0.30), sucre 11 vs 10 (-1) -> -0.70
  // BIM: lait 7.7 vs Marjane 7.2 on 4 L (-2), sucre 10 vs 11 on 2 kg (+2) -> 0
  assert.equal(recap.bestStore, null);
  assert.equal(recap.rise!.name, 'Lait');
  assert.equal(recap.drop!.name, 'Riz');
  await D.saveTrip(sdb, { store: 'Souk', date: '2026-11-12', items: [{ name: 'Sucre', unit: 'kg', qty: 5, unitPrice: 9 }] });
  const recap2 = await D.monthRecap(sdb, '2026-11');
  assert.deepEqual(recap2.bestStore, { store: 'Souk', saved: 7.5 });
  assert.equal(D.previousMonth('2026-01'), '2025-12');
  assert.equal((await D.monthRecap(sdb, '2020-01')).mainStore, null);

  // Arabic names: kept in the key, distinct from each other, and savable
  assert.equal(productKey('فطر اسود عبار'), 'فطر اسود عبار');
  assert.notEqual(productKey('مايفين 180غ'), productKey('حليب 180غ'));
  assert.equal(productKey('أرز'), productKey('ارز'));
  assert.equal(productKey('زيت ١ لتر'), productKey('زيت 1 لتر'));
  await D.saveTrip(sdb, { store: 'Soufi', date: '2026-11-12', items: [
    { name: 'فطر اسود عبار', unit: 'kg', qty: 0.04, unitPrice: 270 }, { name: 'مايفين 180غ', unit: 'pièce', qty: 1, unitPrice: 7 },
    { name: 'شعرية صنية 250 غ', unit: 'pièce', qty: 2, unitPrice: 9 }] });
  assert.equal((await D.listProducts(sdb, 'فطر')).length, 1);
  assert.equal((await D.listProducts(sdb, 'مايفين')).length, 1);

  // Upgrade: Arabic products saved with the old digit-only keys get proper keys
  const old = adapter();
  await D.onOpen(old);
  await old.runAsync('INSERT INTO stores (name, key) VALUES (?, ?)', ['Soufi', 'soufi']);
  await old.runAsync('INSERT INTO products (name, key, unit) VALUES (?, ?, ?)', ['مايفين 180غ', '180', 'pièce']);
  await old.runAsync('INSERT INTO trips (store_id, date) VALUES (1, ?)', ['2026-11-01']);
  await old.runAsync('INSERT INTO items (trip_id, product_id, qty, unit_price) VALUES (1, 1, 1, 7)', []);
  await old.execAsync('PRAGMA user_version = 3');
  await D.onOpen(old);
  assert.equal((await old.getFirstAsync('SELECT key FROM products WHERE id = 1')).key, productKey('مايفين 180غ'));
  await D.saveTrip(old, { store: 'Soufi', date: '2026-11-12', items: [{ name: 'مايفين 180غ', unit: 'pièce', qty: 1, unitPrice: 7.5 }] });
  assert.equal((await D.listProducts(old, 'مايفين'))[0].n, 2, 'new purchase joins the old history');

  console.log('All database checks passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
