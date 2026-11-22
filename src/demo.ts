// Web preview only: a few realistic Moroccan trips so every screen has something to show.
// Never imported by the phone app (see sqlite.web.tsx). Add ?vide to the URL to start empty.
import { addAlias, addListItem, counts, findProduct, saveTrip, setPref, type Db } from './db';
import { addDays, todayIso } from './format';

export async function seedDemo(db: Db): Promise<void> {
  if ((await counts(db)).trips > 0) return;
  const d = (n: number) => addDays(todayIso(), -n);
  const trips = [
    { store: 'Marjane', date: d(62), items: [['Huile Lesieur 5L', 'pièce', 1, 92], ['Lait Centrale 1L', 'pièce', 6, 7], ['Farine Mouna 5kg', 'pièce', 1, 45], ['Thé Sultan 200g', 'pièce', 2, 17.5], ['Sucre en morceaux 1kg', 'pièce', 2, 13.5]] },
    { store: 'Souk', date: d(55), items: [['Tomates', 'kg', 2, 6], ['Pommes de terre', 'kg', 3, 5], ['Oignons', 'kg', 2, 4.5], ['Coriandre', 'pièce', 1, 2]] },
    { store: 'BIM', date: d(41), items: [['Lait Centrale 1L', 'pièce', 6, 7.2], ['Huile Lesieur 5L', 'pièce', 1, 89.9], ['Pâtes Dari 500g', 'pièce', 3, 5.5], ['Oeufs x30', 'paquet', 1, 36]] },
    { store: 'Hanout', date: d(33), items: [['Pain', 'pièce', 4, 1.2], ['Lait Centrale 1L', 'pièce', 2, 7.5], ['Thé Sultan 200g', 'pièce', 1, 18]] },
    { store: 'Souk', date: d(26), items: [['Tomates', 'kg', 2, 8], ['Pommes de terre', 'kg', 3, 5.5], ['Sardines', 'kg', 1, 25], ['Coriandre', 'pièce', 1, 2]] },
    { store: 'Marjane', date: d(19), items: [['Huile Lesieur 5L', 'pièce', 1, 96.5], ['Lait Centrale 1L', 'pièce', 6, 7.5], ['Farine Mouna 5kg', 'pièce', 1, 47], ['Sucre en morceaux 1kg', 'pièce', 2, 13.5], ['Pâtes Dari 500g', 'pièce', 2, 5.2, true]] },
    { store: 'BIM', date: d(9), items: [['Lait Centrale 1L', 'pièce', 6, 7.3], ['Oeufs x30', 'paquet', 1, 39], ['Huile Lesieur 5L', 'pièce', 1, 94]] },
    { store: 'Souk', date: d(4), items: [['Tomates', 'kg', 1.5, 9.5], ['Oignons', 'kg', 2, 5], ['Sardines', 'kg', 1, 30], ['Coriandre', 'pièce', 2, 2]] },
    { store: 'Hanout', date: d(1), items: [['Pain', 'pièce', 6, 1.2], ['Lait Centrale 1L', 'pièce', 2, 7.5], ['Thé Sultan 200g', 'pièce', 1, 19]] },
  ] as const;
  for (const t of trips) {
    await saveTrip(db, { store: t.store, date: t.date, items: t.items.map((i) => ({ name: i[0], unit: i[1], qty: i[2], unitPrice: i[3], promo: i.length > 4 })) });
  }
  const milk = await findProduct(db, 'Lait Centrale 1L');
  if (milk) await addAlias(db, 'LAIT CENTRALE DEMI ECR 1L', milk.id);
  for (const x of ['Huile Lesieur 5L', 'Tomates', 'Lait Centrale 1L', 'Sardines']) await addListItem(db, x);
  await setPref(db, 'budget', '3000');
  await setPref(db, 'lastBackup', todayIso());
}
