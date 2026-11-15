// The bch7al? icon set: 24 px grid, 2 px stroke, rounded ends. Takes the Ionicons
// names the screens already use; anything not drawn here falls back to Ionicons.
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Shape = { p?: string[]; c?: [number, number, number][]; r?: [number, number, number, number, number][] };

const HOME: Shape = { p: ['M4 11.5 12 4l8 7.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z'] };
const TAG: Shape = { p: ['M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0z', 'M9.3 9.3h.01'] };
const SCAN: Shape = { p: ['M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2', 'M8 9.5h8M8 12h8M8 14.5h5'] };
const LIST: Shape = { p: ['M9 6.5h11M9 12h11M9 17.5h11', 'm3.5 6.5 1.2 1.2L7 5.4M3.5 12l1.2 1.2L7 10.9', 'M4.5 17.5h.01'] };
const CHART: Shape = { p: ['M5 20v-6M10 20V9M15 20v-4M20 20V5'] };
const PLUS: Shape = { p: ['M12 5v14M5 12h14'] };
const MINUS: Shape = { p: ['M5 12h14'] };
const GEAR: Shape = { c: [[12, 12, 3]], p: ['M10.3 3.5h3.4l.5 2.4 1.7 1 2.3-.8 1.7 2.9-1.8 1.6v2l1.8 1.6-1.7 2.9-2.3-.8-1.7 1-.5 2.4h-3.4l-.5-2.4-1.7-1-2.3.8-1.7-2.9L5.9 13v-2L4.1 9.4l1.7-2.9 2.3.8 1.7-1z'] };
const STORE: Shape = { p: ['M4 9.5 5.5 4.5h13L20 9.5', 'M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0', 'M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20'] };
const BASKET: Shape = { p: ['M3.5 9.5h17l-1.8 9.2a1.5 1.5 0 0 1-1.5 1.3H6.8a1.5 1.5 0 0 1-1.5-1.3z', 'm8 9.5 3-5.5M16 9.5l-3-5.5M9.5 13.5v3M14.5 13.5v3'] };
const RECEIPT: Shape = { p: ['M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z', 'M9 8h6M9 11.5h6M9 15h3.5'] };
const SEARCH: Shape = { c: [[11, 11, 6.5]], p: ['m20 20-4.4-4.4'] };
const DOWN: Shape = { p: ['M12 5v14M6.5 13.5 12 19l5.5-5.5'] };
const UP: Shape = { p: ['M12 19V5M6.5 10.5 12 5l5.5 5.5'] };
const BACK: Shape = { p: ['M15 5.5 8.5 12l6.5 6.5'] };
const NEXT: Shape = { p: ['m9 5.5 6.5 6.5L9 18.5'] };
const CHECK: Shape = { p: ['m5 12.5 4.5 4.5L19 7.5'] };
const CLOSE: Shape = { p: ['M6.5 6.5l11 11M17.5 6.5l-11 11'] };
const FLASH: Shape = { p: ['M13 3 6 13.5h5L10 21l8-11h-5z'] };
const IMAGE: Shape = { r: [[3.5, 4.5, 17, 15, 3]], c: [[9, 10, 1.6]], p: ['m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5'] };
const CLOUD: Shape = { p: ['M7 18.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18 9.6a4.5 4.5 0 0 1-.5 8.9z', 'M12 16v-5M9.5 13 12 10.5l2.5 2.5'] };
const SHARE: Shape = { p: ['M12 15V4M8 7.5 12 3.5l4 4', 'M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5'] };
const DOWNLOAD: Shape = { p: ['M12 3.5V15M8 11l4 4 4-4', 'M5 16.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-2.5'] };
const TRASH: Shape = { p: ['M4.5 6.5h15M9.5 6.5V4.5h5v2', 'M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-13', 'M10 10.5v6M14 10.5v6'] };
const EDIT: Shape = { p: ['M4.5 19.5l1-4.5L15.8 4.7a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L9 18.5z', 'M13.5 7l3.5 3.5'] };
const SPARK: Shape = { p: ['M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8z', 'M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'] };
const CAMERA: Shape = { p: ['M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z'], c: [[12, 13, 3.5]] };
const DOC: Shape = { p: ['M6.5 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z', 'M13.5 3.5v4h4M8.5 12.5h7M8.5 16h5'] };
const CUBE: Shape = { p: ['M12 3.5l7.5 4v9L12 20.5l-7.5-4v-9z', 'M4.5 7.5 12 11.5l7.5-4M12 11.5v9'] };
const COPY: Shape = { r: [[8.5, 8.5, 11, 11, 2.5]], p: ['M15.5 5.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5'] };
const SCALE: Shape = { p: ['M5 20.5h14', 'M7 20.5 9 9.5h6l2 11', 'M12 9.5V5.5M10 5.5h4'] };
const WALLET: Shape = { p: ['M4 7.5A2 2 0 0 1 6 5.5h11.5v3', 'M4 7.5v10A2 2 0 0 0 6 19.5h13.5v-11H6A2 2 0 0 1 4 7.5z'], c: [[16, 14, 1.2]] };
const TREND_UP: Shape = { p: ['M3.5 17 9.5 11l4 4L20.5 8', 'M15 8h5.5v5.5'] };
const TREND_DOWN: Shape = { p: ['M3.5 7 9.5 13l4-4 7 7', 'M15 16h5.5v-5.5'] };
const PULSE: Shape = { p: ['M3.5 12h4l2-5 4 10 2-5h5'] };
const KEY: Shape = { c: [[8, 15, 4]], p: ['m11 12 8.5-8.5M16 7l2.5 2.5M14 9l1.5 1.5'] };
const MOON: Shape = { p: ['M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z'] };
const CAL: Shape = { r: [[4, 5.5, 16, 15, 2.5]], p: ['M4 10h16M8.5 3.5v4M15.5 3.5v4'] };
const STAR: Shape = { p: ['M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z'] };

const SHAPES: Record<string, Shape> = {
  home: HOME, 'home-outline': HOME,
  pricetag: TAG, 'pricetag-outline': TAG,
  scan: SCAN, 'scan-outline': SCAN,
  list: LIST, 'list-outline': LIST, 'checkbox-outline': LIST,
  'stats-chart': CHART, 'stats-chart-outline': CHART,
  add: PLUS, remove: MINUS,
  settings: GEAR, 'settings-outline': GEAR,
  'storefront-outline': STORE, storefront: STORE,
  'basket-outline': BASKET,
  'receipt-outline': RECEIPT,
  search: SEARCH,
  'arrow-down': DOWN, 'arrow-up': UP,
  'chevron-back': BACK, 'chevron-forward': NEXT,
  checkmark: CHECK, 'checkmark-circle': CHECK,
  close: CLOSE, 'close-circle': CLOSE,
  flash: FLASH, 'flash-outline': FLASH,
  'images-outline': IMAGE, image: IMAGE,
  'cloud-upload-outline': CLOUD,
  'share-outline': SHARE, 'download-outline': DOWNLOAD,
  'trash-outline': TRASH, 'create-outline': EDIT,
  'sparkles-outline': SPARK, 'camera-outline': CAMERA,
  'document-text-outline': DOC, 'cube-outline': CUBE, 'copy-outline': COPY,
  'scale-outline': SCALE, 'wallet-outline': WALLET,
  'trending-up': TREND_UP, 'trending-down': TREND_DOWN, 'pulse-outline': PULSE,
  'key-outline': KEY, 'moon-outline': MOON, 'calendar-outline': CAL, 'thumbs-up': STAR, 'alert-circle': UP,
};

export type IconName = string;

export function Icon({ name, size = 24, color, strokeWidth = 2 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  const shape = SHAPES[name];
  if (!shape) return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
  const common = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {shape.r?.map(([x, y, w, h, rr], i) => <Rect key={'r' + i} x={x} y={y} width={w} height={h} rx={rr} {...common} />)}
      {shape.c?.map(([cx, cy, r], i) => <Circle key={'c' + i} cx={cx} cy={cy} r={r} {...common} />)}
      {shape.p?.map((d, i) => <Path key={'p' + i} d={d} {...common} />)}
    </Svg>
  );
}
