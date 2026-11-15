# bch7al? — carnet de courses

Personal Android app to record every grocery trip and build your own price history. All data stays on the phone (SQLite), no account, no internet needed.

## Screens
- **Accueil**: "Bch7al…" price search, shopping list and month tiles, last trips, most-bought products (v3 "Majorelle" design)
- **Nouvelle course**: store, date (arrows to go back in time), items with unit (pièce / kg / L / paquet), price per unit and quantity. Products you already bought appear as one-tap suggestions; each line shows the change since last time. Tap a line to correct it.
- **Mes courses**: trips by month; open one to see, edit or delete it
- **Mes produits**: search all products; open one for price history, lowest/highest/average, and last price per store. Rename a product, or give it the name of another to merge the two.
- **Réglages**: backup to a CSV file (share to Drive, e-mail, WhatsApp; opens in Excel) and restore

## Install on your phone (simplest: cloud build, no Android Studio)
1. Install Node.js 20+ on your computer.
2. In this folder: `npm install --legacy-peer-deps`
3. Create a free account on https://expo.dev, then `npx eas-cli@latest login`
4. `npx eas-cli@latest build -p android --profile preview`
5. When it finishes (about 10–15 min), open the link on your phone, download the **.apk** and install it (allow "install unknown apps" when asked).

## Develop
- `npx expo run:android` with a phone plugged in (USB debugging on) and Android Studio installed, or
- after one preview/dev build, `npx expo start` for live reload.

Checks: `npx tsc --noEmit` and `npx tsx scripts/test-db.ts` (database tests, Node 22+).

## Back up regularly
Data lives only on the phone. Use **Réglages → Sauvegarder mes courses** every few weeks; uninstalling the app deletes its data.
