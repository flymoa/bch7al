# bch7al? — carnet de courses

Personal Android app to record every grocery trip and build your own price history. All data stays on the phone (SQLite), no account, no internet needed.

## Screens (v4 « Majorelle Nuit »)
Four tabs and one big **+** (Scanner le ticket / Saisie rapide):
- **Accueil**: the « bch7al … ? » question, the month on a night block (total, vs last month, budget), last trips, what moved this month
- **Produits**: every product, search first; last price, price per kg / L from the pack size, sparkline, last move; filters Récents · Fréquents · En hausse · A–Z
- **Liste**: what to buy, and the store that is cheapest for the whole list
- **Mois**: « Ton mois » — total, how much of the change is prices vs quantities, what rose / fell, your own inflation, spend by store and by week
- **bch7al ?** (from the search): your best price and where, then type the shelf price → Ghali / Normal / Rkhis
- **Produit**: step chart with your usual-price band, price per store, every purchase, other names read on tickets (aliases), rename / merge
- **Nouvelle course**: store, date, items (pièce / kg / L / paquet), promo flag; after a scan only « N articles lus · Ticket X DH », dashed notes when something needs a look, « Réessayer » when Gemini fails, « Même produit que … ? » for receipt spellings
- **Réglages**: backup to a CSV file and restore (promo flags and aliases included), budget, Gemini key, appearance

Design system: `src/tokens.ts` is the single source of truth; `DESIGN.md` is generated from it (`npm run design:doc`).

## Install on your phone (simplest: cloud build, no Android Studio)
1. Install Node.js 20+ on your computer.
2. In this folder: `npm install --legacy-peer-deps`
3. Create a free account on https://expo.dev, then `npx eas-cli@latest login`
4. `npx eas-cli@latest build -p android --profile preview`
5. When it finishes (about 10–15 min), open the link on your phone, download the **.apk** and install it (allow "install unknown apps" when asked).

## Develop
- `npx expo run:android` with a phone plugged in (USB debugging on) and Android Studio installed, or
- after one preview/dev build, `npx expo start` for live reload.

Checks: `npx tsc --noEmit`, `npx expo lint`, `npm test` (database, receipt, Gemini and v4 tests, Node 22+) and `npm run design:doc -- --check`.

## Back up regularly
Data lives only on the phone. Use **Réglages → Sauvegarder mes courses** every few weeks; uninstalling the app deletes its data.
