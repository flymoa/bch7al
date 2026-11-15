// Usual price (last 3 purchases), ticket verdicts, backup of list + budget, migration resume.
// Usage: npx tsx scripts/test-fixes.ts
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as D from '../src/db';
const mk = () => { const raw = new DatabaseSync(':memory:'); return { raw, db: { async execAsync(s: string) { raw.exec(s); }, async runAsync(s: string, p: any[] = []) { const r = raw.prepare(s).run(...p); return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) }; }, async getAllAsync(s: string, p: any[] = []) { return raw.prepare(s).all(...p).map((r: any) => ({ ...r })); }, async getFirstAsync(s: string, p: any[] = []) { const r = raw.prepare(s).get(...p); return r ? { ...r } : null; }, async withTransactionAsync(f: any) { raw.exec('BEGIN'); try { await f(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } } } as any }; };
const it = (unitPrice: number) => ({ name: 'Lait', unit: 'pièce', qty: 1, unitPrice });
(async () => {
  const { db, raw } = mk();
  await D.onOpen(db);
  const ids: number[] = [];
  for (const [d, p] of [['2026-01-01', 5], ['2026-03-01', 6], ['2026-06-01', 7], ['2026-09-01', 7], ['2026-11-01', 7.2]] as const)
    ids.push(await D.saveTrip(db, { store: 'BIM', date: d, items: [it(p)] }));
  const p = (await D.listProducts(db))[0];
  assert.equal(Math.round(p.avg_price! * 100), Math.round(((7 + 7 + 7.2) / 3) * 100)); // last 3 only
  const v1 = Object.values(await D.tripVerdicts(db, ids[0]))[0];
  assert.equal(v1, null); // nothing before the first trip
  const v5 = Object.values(await D.tripVerdicts(db, ids[4]))[0]!;
  assert.equal(v5.kind, 'high');

  // backup round trip with list + budget
  await D.addListItem(db, 'Huile'); await D.setPref(db, 'budget', '2000');
  const { csv } = await D.exportCsv(db);
  const b = mk(); await D.onOpen(b.db);
  const r = await D.importCsv(b.db, csv);
  assert.equal(r.trips, 5);
  assert.equal((await D.listPlan(b.db)).lines[0].name, 'Huile');
  assert.equal(await D.getPref(b.db, 'budget'), '2000');
  // migration resumes after a crash at version 1
  const c = mk(); await D.onOpen(c.db); c.raw.exec('PRAGMA user_version = 1'); await D.onOpen(c.db);
  console.log('ok');
})();
