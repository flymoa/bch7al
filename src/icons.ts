// Picks an icon from a product or store name by keywords (French, Darija in Latin letters, English).
import { productKey } from './format';

export type IconName = string;

const PRODUCT_RULES: [string[], IconName][] = [
  [['lait', 'milk', 'hlib', 'halib', 'yaourt', 'yogourt', 'raib', 'lben', 'leben', 'danone'], 'cup-water'],
  [['fromage', 'cheese', 'jben', 'vache qui rit'], 'cheese'],
  [['beurre', 'zebda', 'smen'], 'cheese'],
  [['oeuf', 'oeufs', 'egg', 'bid'], 'egg-outline'],
  [['pain', 'khobz', 'baguette', 'harcha', 'msemen', 'batbout'], 'baguette'],
  [['farine', 'semoule', 'dqiq', 'smida', 'ble', 'orge'], 'barley'],
  [['riz', 'rice'], 'rice'],
  [['pates', 'spaghetti', 'macaroni', 'vermicelle', 'chaariya', 'couscous'], 'pasta'],
  [['huile', 'oil', 'zit', 'olive'], 'bottle-tonic-outline'],
  [['sucre', 'sugar', 'skar', 'sel', 'melh', 'epice', 'poivre', 'cumin', 'kamoun', 'paprika', 'tahmira'], 'shaker-outline'],
  [['the ', 'the', 'atay', 'tea', 'sultan', 'menthe', 'naanaa'], 'tea-outline'],
  [['cafe', 'coffee', 'qahwa', 'nescafe'], 'coffee-outline'],
  [['poulet', 'djaj', 'chicken', 'dinde', 'pilon'], 'food-drumstick'],
  [['viande', 'boeuf', 'lham', 'khrouf', 'agneau', 'mouton', 'kefta', 'hachee', 'steak'], 'food-steak'],
  [['merguez', 'saucisse', 'cachir', 'kachir'], 'sausage'],
  [['poisson', 'hout', 'fish', 'sardine', 'thon', 'crevette', 'calamar'], 'fish'],
  [['tomate', 'tomates', 'mticha', 'maticha'], 'fruit-cherries'],
  [['carotte', 'khizou', 'pomme de terre', 'batata', 'oignon', 'bsla', 'courgette', 'poivron', 'aubergine', 'legume', 'navet', 'chou'], 'carrot'],
  [['piment', 'harissa', 'felfla'], 'chili-mild'],
  [['persil', 'maadnous', 'coriandre', 'qosbor', 'salade', 'laitue', 'epinard'], 'leaf'],
  [['orange', 'citron', 'limoun', 'mandarine', 'clementine'], 'fruit-citrus'],
  [['pasteque', 'dellah', 'melon', 'battikh'], 'fruit-watermelon'],
  [['pomme', 'tfah', 'banane', 'banan', 'poire', 'fraise', 'raisin', 'fruit', 'datte', 'tmer'], 'food-apple'],
  [['mais', 'corn'], 'corn'],
  [['eau', 'water', 'sidi ali', 'ain saiss', 'oulmes', 'bahia'], 'water-outline'],
  [['coca', 'soda', 'jus', 'juice', 'boisson', 'fanta', 'pepsi', 'hawai'], 'bottle-soda-outline'],
  [['gateau', 'biscuit', 'chocolat', 'gaufrette', 'henrys', 'tonic', 'bonbon', 'confiture'], 'cupcake'],
  [['lessive', 'javel', 'savon', 'tide', 'ariel', 'omo', 'detergent', 'nettoyant', 'liquide vaisselle', 'pril'], 'spray-bottle'],
  [['papier', 'mouchoir', 'sopalin', 'serviette'], 'paper-roll-outline'],
  [['dentifrice', 'brosse', 'shampoing', 'gel douche', 'deodorant'], 'toothbrush-paste'],
  [['couche', 'pampers', 'bebe', 'biberon'], 'baby-bottle-outline'],
];

const STORE_RULES: [string[], IconName][] = [
  [['souk', 'marche', 'souq', 'jouteya'], 'basket-outline'],
  [['hanout', 'epicerie', 'mol hanout', 'superette'], 'storefront-outline'],
  [['boucher', 'gezzar', 'jazzar'], 'food-steak'],
  [['boulanger', 'patisserie', 'ferran'], 'baguette'],
  [['poissonn', 'hout'], 'fish'],
  [['marjane', 'carrefour', 'bim', 'acima', 'aswak', 'label', 'kazyon', 'atacadao', 'metro', 'supermarche', 'hyper'], 'cart'],
];

function match(rules: [string[], IconName][], name: string): IconName | null {
  const key = ' ' + productKey(name) + ' ';
  for (const [words, icon] of rules) {
    for (const w of words) {
      const k = productKey(w);
      // whole-word match, plus plural "s"
      if (key.includes(' ' + k + ' ') || key.includes(' ' + k + 's ')) return icon;
    }
  }
  return null;
}

export function productIcon(name: string): IconName {
  return match(PRODUCT_RULES, name) ?? 'tag-outline';
}

export function storeIcon(name: string): IconName {
  return match(STORE_RULES, name) ?? 'store-outline';
}
