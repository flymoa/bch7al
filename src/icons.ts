// Picks an icon from a product or store name by keywords (French, Darija in Latin letters, English).
// Pure module (no React Native import) so Node tests can use it.
import { productKey } from './format';

export type GuessIcon =
  | 'dairy' | 'egg' | 'bread' | 'grains' | 'bottle' | 'coffee' | 'meat' | 'fish' | 'shrimp' | 'veg' | 'pepper' | 'herbs'
  | 'fruit' | 'drink' | 'sweets' | 'cleaning' | 'paper' | 'pack' | 'products' | 'market' | 'store' | 'cart';

const PRODUCT_RULES: [string[], GuessIcon][] = [
  [['lait', 'milk', 'hlib', 'halib', 'yaourt', 'yogourt', 'raib', 'lben', 'leben', 'danone', 'fromage', 'cheese', 'jben', 'vache qui rit', 'beurre', 'zebda', 'smen'], 'dairy'],
  [['oeuf', 'oeufs', 'egg', 'bid'], 'egg'],
  [['pain', 'khobz', 'baguette', 'harcha', 'msemen', 'batbout'], 'bread'],
  [['farine', 'semoule', 'dqiq', 'smida', 'ble', 'orge', 'riz', 'rice', 'pates', 'spaghetti', 'macaroni', 'vermicelle', 'chaariya', 'couscous', 'mais', 'lentille', 'pois chiche', 'loubia', 'haricot'], 'grains'],
  [['huile', 'oil', 'zit', 'olive', 'vinaigre'], 'bottle'],
  [['the ', 'the', 'atay', 'tea', 'sultan', 'cafe', 'coffee', 'qahwa', 'nescafe'], 'coffee'],
  [['poulet', 'djaj', 'chicken', 'dinde', 'pilon', 'viande', 'boeuf', 'lham', 'khrouf', 'agneau', 'mouton', 'kefta', 'hachee', 'steak', 'merguez', 'saucisse', 'cachir', 'kachir'], 'meat'],
  [['crevette', 'calamar', 'poulpe'], 'shrimp'],
  [['poisson', 'hout', 'fish', 'sardine', 'thon', 'merlan', 'dorade'], 'fish'],
  [['piment', 'harissa', 'felfla', 'poivron'], 'pepper'],
  [['persil', 'maadnous', 'coriandre', 'qosbor', 'salade', 'laitue', 'epinard', 'menthe', 'naanaa'], 'herbs'],
  [['tomate', 'tomates', 'mticha', 'maticha', 'carotte', 'khizou', 'pomme de terre', 'batata', 'oignon', 'bsla', 'courgette', 'aubergine', 'legume', 'navet', 'chou'], 'veg'],
  [['orange', 'citron', 'limoun', 'mandarine', 'clementine', 'pasteque', 'dellah', 'melon', 'battikh', 'pomme', 'tfah', 'banane', 'banan', 'poire', 'fraise', 'raisin', 'fruit', 'datte', 'tmer'], 'fruit'],
  [['eau', 'water', 'sidi ali', 'ain saiss', 'oulmes', 'bahia', 'coca', 'soda', 'jus', 'juice', 'boisson', 'fanta', 'pepsi', 'hawai'], 'drink'],
  [['sucre', 'sugar', 'skar', 'gateau', 'biscuit', 'chocolat', 'gaufrette', 'henrys', 'tonic', 'bonbon', 'confiture'], 'sweets'],
  [['lessive', 'javel', 'savon', 'tide', 'ariel', 'omo', 'detergent', 'nettoyant', 'liquide vaisselle', 'pril', 'dentifrice', 'shampoing', 'gel douche', 'deodorant'], 'cleaning'],
  [['papier', 'mouchoir', 'sopalin', 'serviette', 'couche', 'pampers'], 'paper'],
  [['timbre'], 'pack'],
];

const STORE_RULES: [string[], GuessIcon][] = [
  [['souk', 'marche', 'souq', 'jouteya'], 'market'],
  [['hanout', 'epicerie', 'mol hanout', 'superette'], 'store'],
  [['boucher', 'gezzar', 'jazzar'], 'meat'],
  [['boulanger', 'patisserie', 'ferran'], 'bread'],
  [['poissonn', 'hout'], 'fish'],
  [['khodar', 'legumes'], 'veg'],
  [['marjane', 'carrefour', 'bim', 'acima', 'aswak', 'label', 'kazyon', 'atacadao', 'metro', 'supermarche', 'hyper'], 'cart'],
];

function match(rules: [string[], GuessIcon][], name: string): GuessIcon | null {
  const key = ' ' + productKey(name) + ' ';
  for (const [words, icon] of rules) {
    for (const w of words) {
      const k = productKey(w);
      if (key.includes(' ' + k + ' ') || key.includes(' ' + k + 's ')) return icon;
    }
  }
  return null;
}

export function productIcon(name: string): GuessIcon {
  return match(PRODUCT_RULES, name) ?? 'products';
}

export function storeIcon(name: string): GuessIcon {
  return match(STORE_RULES, name) ?? 'store';
}
