// The bch7al? icon set: Phosphor (MIT). Regular for UI, Fill for the selected tab and
// active chips, Duotone for empty states. Icons always take the content colour — never
// multicolour, never an emoji. Each icon is imported on its own to keep the app small.
import type { IconProps, IconWeight } from 'phosphor-react-native';
import { ArrowClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { BarcodeIcon } from 'phosphor-react-native/src/icons/Barcode';
import { BasketIcon } from 'phosphor-react-native/src/icons/Basket';
import { BreadIcon } from 'phosphor-react-native/src/icons/Bread';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp';
import { CarrotIcon } from 'phosphor-react-native/src/icons/Carrot';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CheeseIcon } from 'phosphor-react-native/src/icons/Cheese';
import { CloudSlashIcon } from 'phosphor-react-native/src/icons/CloudSlash';
import { CoffeeIcon } from 'phosphor-react-native/src/icons/Coffee';
import { CoinsIcon } from 'phosphor-react-native/src/icons/Coins';
import { CookieIcon } from 'phosphor-react-native/src/icons/Cookie';
import { CowIcon } from 'phosphor-react-native/src/icons/Cow';
import { DownloadSimpleIcon } from 'phosphor-react-native/src/icons/DownloadSimple';
import { DropIcon } from 'phosphor-react-native/src/icons/Drop';
import { EggIcon } from 'phosphor-react-native/src/icons/Egg';
import { EqualsIcon } from 'phosphor-react-native/src/icons/Equals';
import { ExportIcon } from 'phosphor-react-native/src/icons/Export';
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText';
import { FishIcon } from 'phosphor-react-native/src/icons/Fish';
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix';
import { GitMergeIcon } from 'phosphor-react-native/src/icons/GitMerge';
import { GrainsIcon } from 'phosphor-react-native/src/icons/Grains';
import { HouseSimpleIcon } from 'phosphor-react-native/src/icons/HouseSimple';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { KeyIcon } from 'phosphor-react-native/src/icons/Key';
import { LeafIcon } from 'phosphor-react-native/src/icons/Leaf';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { LightningSlashIcon } from 'phosphor-react-native/src/icons/LightningSlash';
import { LinkSimpleIcon } from 'phosphor-react-native/src/icons/LinkSimple';
import { ListChecksIcon } from 'phosphor-react-native/src/icons/ListChecks';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
import { MoonIcon } from 'phosphor-react-native/src/icons/Moon';
import { NotebookIcon } from 'phosphor-react-native/src/icons/Notebook';
import { OrangeSliceIcon } from 'phosphor-react-native/src/icons/OrangeSlice';
import { PackageIcon } from 'phosphor-react-native/src/icons/Package';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { PepperIcon } from 'phosphor-react-native/src/icons/Pepper';
import { PercentIcon } from 'phosphor-react-native/src/icons/Percent';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { ReceiptIcon } from 'phosphor-react-native/src/icons/Receipt';
import { ScalesIcon } from 'phosphor-react-native/src/icons/Scales';
import { ScanIcon } from 'phosphor-react-native/src/icons/Scan';
import { ShoppingCartSimpleIcon } from 'phosphor-react-native/src/icons/ShoppingCartSimple';
import { ShrimpIcon } from 'phosphor-react-native/src/icons/Shrimp';
import { SprayBottleIcon } from 'phosphor-react-native/src/icons/SprayBottle';
import { StorefrontIcon } from 'phosphor-react-native/src/icons/Storefront';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { TagIcon } from 'phosphor-react-native/src/icons/Tag';
import { ToiletPaperIcon } from 'phosphor-react-native/src/icons/ToiletPaper';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { TrendDownIcon } from 'phosphor-react-native/src/icons/TrendDown';
import { TrendUpIcon } from 'phosphor-react-native/src/icons/TrendUp';
import { WarningDiamondIcon } from 'phosphor-react-native/src/icons/WarningDiamond';
import { WarningOctagonIcon } from 'phosphor-react-native/src/icons/WarningOctagon';
import { WineIcon } from 'phosphor-react-native/src/icons/Wine';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import type { ComponentType } from 'react';
import { colors } from '@/theme';
import { size as sizes } from '@/tokens';

/** One name per app concept (see DESIGN.md → Icons). */
const ICONS = {
  // navigation
  home: HouseSimpleIcon,
  products: TagIcon,
  list: ListChecksIcon,
  month: CalendarBlankIcon,
  search: MagnifyingGlassIcon,
  settings: GearSixIcon,
  back: CaretLeftIcon,
  next: CaretRightIcon,
  up: CaretUpIcon,
  down: CaretDownIcon,
  close: XIcon,
  check: CheckIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  // logging
  scan: ScanIcon,
  manual: PencilSimpleIcon,
  edit: PencilSimpleIcon,
  camera: CameraIcon,
  gallery: ImageIcon,
  flash: LightningIcon,
  flashOff: LightningSlashIcon,
  receipt: ReceiptIcon,
  text: FileTextIcon,
  store: StorefrontIcon,
  market: BasketIcon,
  cart: ShoppingCartSimpleIcon,
  weight: ScalesIcon,
  money: CoinsIcon,
  barcode: BarcodeIcon,
  // price states
  priceUp: TrendUpIcon,
  priceDown: TrendDownIcon,
  same: EqualsIcon,
  promo: PercentIcon,
  check2: WarningDiamondIcon,
  error: WarningOctagonIcon,
  retry: ArrowClockwiseIcon,
  offline: CloudSlashIcon,
  merge: GitMergeIcon,
  link: LinkSimpleIcon,
  // data
  export: ExportIcon,
  import: DownloadSimpleIcon,
  credit: NotebookIcon,
  delete: TrashIcon,
  key: KeyIcon,
  sun: SunIcon,
  moon: MoonIcon,
  // products (drawn in the content colour, never in food colours)
  bread: BreadIcon,
  egg: EggIcon,
  fish: FishIcon,
  shrimp: ShrimpIcon,
  meat: CowIcon,
  veg: CarrotIcon,
  herbs: LeafIcon,
  fruit: OrangeSliceIcon,
  pepper: PepperIcon,
  grains: GrainsIcon,
  dairy: CheeseIcon,
  drink: DropIcon,
  coffee: CoffeeIcon,
  sweets: CookieIcon,
  bottle: WineIcon,
  cleaning: SprayBottleIcon,
  paper: ToiletPaperIcon,
  pack: PackageIcon,
} satisfies Record<string, ComponentType<IconProps>>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = sizes.icon, color, weight = 'regular', duotone }: { name: IconName; size?: number; color?: string; weight?: IconWeight; duotone?: string }) {
  const C = ICONS[name] ?? TagIcon;
  return <C size={size} color={color ?? colors.ink} weight={weight} duotoneColor={duotone} duotoneOpacity={duotone ? 1 : undefined} />;
}
