import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from '@/components/icon';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { bubble, colors, fonts, shadow, sheet } from '@/theme';
import { pct, pctChange, type Verdict } from '@/format';
import { productIcon, storeIcon } from '@/icons';
import { usePressScale } from './motion';
import { radius, space, tabular, type } from '@/tokens';
import { Animated } from 'react-native';

type IconName = string;

export type Tab = 'home' | 'ask' | 'list' | 'stats';

/** `night`: the area under the status bar is navy, for screens that open on a navy block. */
export function Screen({ children, bottomBar, night }: { children: ReactNode; bottomBar?: Tab; night?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={[s.screen, night && { backgroundColor: colors.night }]} edges={['top', 'left', 'right']}>
      <View style={[s.flex, night && { backgroundColor: colors.bg }]}>{children}</View>
      {bottomBar ? <BottomBar active={bottomBar} bottom={insets.bottom} /> : <View style={{ height: insets.bottom, backgroundColor: colors.bg }} />}
    </SafeAreaView>
  );
}

export function Header({ title, back = true, right }: { title: string; back?: boolean; right?: ReactNode }) {
  return (
    <View style={s.header}>
      {back ? (
        <RoundButton icon="chevron-back" label="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      ) : (
        <View style={s.roundSpace} />
      )}
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      {right ?? <View style={s.roundSpace} />}
    </View>
  );
}

export function RoundButton({ icon, label, onPress, tone = 'plain' }: { icon: IconName; label: string; onPress: () => void; tone?: 'plain' | 'danger' }) {
  const press = usePressScale(0.88);
  return (
    <Animated.View style={press.style}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={s.round}>
        <Icon name={icon} size={22} color={tone === 'danger' ? colors.danger : colors.ink} />
      </Pressable>
    </Animated.View>
  );
}

/** `outlined`: the "ghali" box, white with an ink outline and no shadow. */
export function Card({ children, style, outlined }: { children: ReactNode; style?: StyleProp<ViewStyle>; outlined?: boolean }) {
  return <View style={[s.card, outlined && s.cardOutlined, style]}>{children}</View>;
}

/** Old name kept for callers: a single pressable list row. Prefer ListGroup + ListRow. */
export function RowCard({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.group, s.row, pressed && s.rowPressed]}>
      {children}
    </Pressable>
  );
}

/** One flat container for N rows. No shadow per row: the rows share it.
 * `bleed`: inside a padded Card, the rows run edge to edge so the card is the one container. */
export function ListGroup({ children, style, bleed }: { children: ReactNode; style?: StyleProp<ViewStyle>; bleed?: boolean }) {
  return <View style={[s.group, bleed && s.groupBleed, style]}>{children}</View>;
}

export const LEAD = 40;

/**
 * A quiet list row. Name + muted meta on the left, the price on the right as the hero,
 * an optional verdict under it. `first` hides the hairline; `first`/`last` round the corners
 * so rows also work on their own inside a FlatList.
 */
export function ListRow({ label, onPress, leading, title, meta, price, unit, verdict, right, first, last, children }: {
  label?: string; onPress?: () => void; leading?: ReactNode; title?: ReactNode; meta?: ReactNode; price?: string; unit?: string;
  verdict?: ReactNode; right?: ReactNode; first?: boolean; last?: boolean; children?: ReactNode;
}) {
  const body = (
    <>
      {first ? null : <View style={[s.divider, { left: leading ? space.lg + LEAD + space.md : space.lg }]} />}
      {leading}
      <View style={s.rowText}>
        {typeof title === 'string' ? <Text style={t.name} numberOfLines={1}>{title}</Text> : title}
        {meta == null ? null : typeof meta === 'string' ? <Text style={t.meta} numberOfLines={1}>{meta}</Text> : meta}
        {children}
      </View>
      {right}
      {price !== undefined || verdict ? (
        <View style={s.rowRight}>
          {price !== undefined ? (
            <Text style={t.price} numberOfLines={1}>{price}{unit ? <Text style={t.unit}> {unit}</Text> : null}</Text>
          ) : null}
          {verdict}
        </View>
      ) : null}
    </>
  );
  const edges = [s.flatRow, first && s.rowFirst, last && s.rowLast];
  if (!onPress) return <View style={edges} accessible={!!label} accessibilityLabel={label}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [...edges, pressed && s.rowPressed]}>
      {body}
    </Pressable>
  );
}

/** Small icon-only button with a 44dp hit area, for quiet row actions. */
export function IconButton({ icon, label, onPress, tone = 'plain' }: { icon: IconName; label: string; onPress: () => void; tone?: 'plain' | 'danger' }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.iconBtn, pressed && s.rowPressed]}>
      <Icon name={icon} size={20} color={tone === 'danger' ? colors.danger : colors.muted} />
    </Pressable>
  );
}

/** Rounded square with an icon guessed from the name: a product icon, or a store icon with kind="store". */
export function Tile({ text, size = LEAD, kind = 'product' }: { text: string; size?: number; kind?: 'product' | 'store' }) {
  const icon = kind === 'store' ? storeIcon(text) : productIcon(text);
  return (
    <View style={[s.tile, { width: size, height: size, borderRadius: size / 3 }, s.bubbleTile]}>
      <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={Math.round(size * 0.52)} color={colors.softText} />
    </View>
  );
}

export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: 'down' | 'up' | 'neutral'; icon?: IconName }) {
  const bg = tone === 'down' ? colors.soft : tone === 'up' ? colors.upBg : colors.neutral;
  const fg = tone === 'down' ? colors.softText : tone === 'up' ? colors.upText : colors.muted;
  return (
    <View style={[s.chip, { backgroundColor: bg }, tone === 'up' && s.chipUp]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Soft blue with a down arrow when the price dropped, navy outline with an up arrow when it rose. */
export function ChangeChip({ from, to }: { from: number | null; to: number | null }) {
  const change = pctChange(from, to);
  if (change === null) return null;
  if (Math.abs(change) < 0.05) return <Chip label="Même prix" />;
  return <Chip label={pct(change)} tone={change < 0 ? 'down' : 'up'} icon={change < 0 ? 'arrow-down' : 'arrow-up'} />;
}

export function Pill({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  const press = usePressScale(0.92);
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[s.pill, active && s.pillActive, disabled && !active && s.disabled]}
      >
        <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function Button({ label, onPress, icon, tone = 'primary', disabled, style }: {
  label: string; onPress: () => void; icon?: IconName; tone?: 'primary' | 'dark' | 'light' | 'danger'; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'primary' ? colors.blue : tone === 'dark' ? colors.ink : colors.card;
  const fg = tone === 'light' ? colors.blue : tone === 'danger' ? colors.danger : tone === 'dark' ? colors.onInk : colors.white;
  const press = usePressScale(0.96);
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[s.button, { backgroundColor: bg }, (tone === 'light' || tone === 'danger') && s.buttonOutline, disabled && s.disabled, style]}
      >
        {icon ? <Icon name={icon} size={22} color={fg} /> : null}
        <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const VERDICT_LABEL = { good: 'Mzyan', normal: 'Normal', high: 'Ghali' } as const;

/** Mzyan (solid blue, arrow down), Normal (soft), Ghali (navy outline, arrow up). */
export function VerdictBadge({ v, onNight }: { v: Verdict; onNight?: boolean }) {
  const good = v.kind === 'good';
  const high = v.kind === 'high';
  return (
    <View
      accessibilityLabel={VERDICT_LABEL[v.kind]}
      style={[s.badge, good ? { backgroundColor: onNight ? colors.nightBlue : colors.blue } : high ? [s.badgeHigh, onNight && { borderColor: colors.white, backgroundColor: 'transparent' }] : { backgroundColor: onNight ? colors.nightSoft : colors.soft }]}
    >
      {good ? <Icon name="arrow-down" size={12} color={colors.white} /> : high ? <Icon name="arrow-up" size={12} color={onNight ? colors.white : colors.upText} /> : null}
      <Text style={[s.badgeText, { color: good || onNight ? colors.white : high ? colors.upText : colors.ink }]}>{VERDICT_LABEL[v.kind]}</Text>
    </View>
  );
}

/** One segment per article: good first, then normal, then high. */
export function VerdictStrip({ verdicts, onNight }: { verdicts: (Verdict | null)[]; onNight?: boolean }) {
  const known = verdicts.filter((v): v is Verdict => v !== null);
  if (known.length === 0) return null;
  const order = { good: 0, normal: 1, high: 2 } as const;
  const sorted = [...known].sort((a, b) => order[a.kind] - order[b.kind]);
  const n = (k: Verdict['kind']) => known.filter((v) => v.kind === k).length;
  return (
    <View style={s.stripWrap}>
      <View style={s.strip} accessible accessibilityLabel={`${n('good')} mzyan, ${n('normal')} normal, ${n('high')} ghali`}>
        {sorted.map((v, i) => (
          <View
            key={i}
            style={[
              s.seg,
              v.kind === 'good'
                ? { backgroundColor: onNight ? colors.nightBlue : colors.blue }
                : v.kind === 'normal'
                  ? { backgroundColor: onNight ? colors.nightSoft : colors.barSoft }
                  : onNight
                    ? { backgroundColor: colors.white }
                    : s.segHigh,
            ]}
          />
        ))}
      </View>
      <Text style={[s.stripText, onNight && { color: colors.onNight }]}>
        <Text style={[s.stripStrong, { color: onNight ? colors.white : colors.blue }]}>{n('good')} mzyan</Text> · {n('normal')} normal ·{' '}
        <Text style={[s.stripStrong, { color: onNight ? colors.white : colors.ink }]}>{n('high')} ghali</Text>
      </Text>
    </View>
  );
}

export function SectionTitle({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{children}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12} style={s.sectionAction}>
          <Text style={s.sectionActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: { label: string; icon?: IconName; onPress: () => void } }) {
  return (
    <Card style={s.empty}>
      <View style={s.emptyIcon}>
        <MaterialCommunityIcons name="basket-outline" size={34} color={colors.blue} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
      {action ? <Button label={action.label} icon={action.icon} onPress={action.onPress} style={s.emptyAction} /> : null}
    </Card>
  );
}

export function Txt({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text style={[s.txt, style]} numberOfLines={numberOfLines}>{children}</Text>;
}

function PlusButton() {
  const press = usePressScale(0.86);
  return (
    <Animated.View style={[s.plusWrap, press.style]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Scanner un ticket" onPress={() => router.push(Platform.OS === 'web' ? '/trip/new?scan=camera' : '/camera')} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={s.plus}>
        <Icon name="scan" size={28} color={colors.white} />
      </Pressable>
    </Animated.View>
  );
}

function BottomBar({ active, bottom }: { active: Tab; bottom: number }) {
  const items: { key: Tab; label: string; icon: IconName; href: '/' | '/ask' | '/list' | '/stats' }[] = [
    { key: 'home', label: 'Accueil', icon: 'home-outline', href: '/' },
    { key: 'ask', label: 'Prix', icon: 'pricetag-outline', href: '/ask' },
    { key: 'list', label: 'Liste', icon: 'list-outline', href: '/list' },
    { key: 'stats', label: 'Mois', icon: 'stats-chart-outline', href: '/stats' },
  ];
  const tab = (it: (typeof items)[number]) => (
    <Pressable
      key={it.key}
      accessibilityRole="tab"
      accessibilityState={{ selected: active === it.key }}
      onPress={() => active !== it.key && router.replace(it.href)}
      style={s.tab}
    >
      <View style={[s.tabPill, active === it.key && s.tabPillOn]}>
        <Icon name={it.icon} size={24} color={active === it.key ? colors.blue : colors.muted} />
      </View>
      <Text style={[s.tabText, active === it.key && s.tabTextOn]}>{it.label}</Text>
    </Pressable>
  );
  return (
    <View style={[s.bar, { paddingBottom: space.sm + bottom }]}>
      {items.slice(0, 2).map(tab)}
      <PlusButton />
      {items.slice(2).map(tab)}
    </View>
  );
}

export const s = sheet(() => ({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: space.md },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.titleBold, fontSize: type.title, color: colors.ink },
  round: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  roundSpace: { width: 44, height: 44 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.md, paddingHorizontal: space.lg },
  tile: { backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  bubbleTile: { borderBottomLeftRadius: radius.sm },
  tileText: { fontFamily: fonts.titleBold, color: colors.softText },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs, borderWidth: 1.5, borderColor: 'transparent', alignSelf: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 28, paddingHorizontal: space.md, borderRadius: radius.pill, alignSelf: 'center' },
  badgeHigh: { borderWidth: 2, borderColor: colors.upText, backgroundColor: colors.upBg, paddingHorizontal: space.sm },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: type.caption },
  stripWrap: { gap: space.sm },
  strip: { flexDirection: 'row', gap: space.xs },
  seg: { flex: 1, height: space.sm, borderRadius: space.xs },
  segHigh: { borderWidth: 2, borderColor: colors.upText, backgroundColor: colors.upBg },
  stripText: { fontFamily: fonts.body, fontSize: type.body, color: colors.muted },
  stripStrong: { fontFamily: fonts.bodyBold },
  chipUp: { borderColor: colors.upText },
  upBox: { borderWidth: 2, borderColor: colors.upText },
  chipText: { fontFamily: fonts.bodyBold, fontSize: type.caption },
  pill: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.ink },
  pillTextActive: { color: colors.onInk },
  button: { minHeight: 56, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xl },
  buttonOutline: { borderWidth: 1.5, borderColor: colors.line },
  buttonText: { fontFamily: fonts.title, fontSize: type.bodyLg },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs, paddingTop: space.xl, paddingBottom: space.sm },
  sectionTitle: { fontFamily: fonts.title, fontSize: type.title, color: colors.ink },
  sectionAction: { minHeight: 44, justifyContent: 'center' },
  sectionActionText: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.blue },
  empty: { padding: space.xl, alignItems: 'center', gap: space.sm },
  emptyIcon: { width: 64, height: 64, ...bubble(radius.lg), backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  emptyTitle: { fontFamily: fonts.title, fontSize: type.bodyLg, color: colors.ink, textAlign: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: type.body, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  emptyAction: { marginTop: space.md, alignSelf: 'stretch' },
  txt: { fontFamily: fonts.body, fontSize: type.body, color: colors.ink },
  bar: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: space.sm, paddingTop: space.sm, shadowColor: colors.shadow, shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  tabPill: { width: 56, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabPillOn: { backgroundColor: colors.soft },
  tabTextOn: { color: colors.blue, fontFamily: fonts.bodyBold },
  tab: { minWidth: 62, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: type.caption, color: colors.muted },
  plusWrap: { marginTop: -space.xxl },
  plus: { width: 62, height: 62, ...bubble(radius.lg), backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', shadowColor: colors.blue, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  rowPressed: { backgroundColor: colors.cardPressed },
  cardOutlined: { backgroundColor: colors.upBg, borderWidth: 2, borderColor: colors.upText, shadowOpacity: 0, elevation: 0 },
  groupBleed: { marginHorizontal: -space.lg, borderRadius: 0, backgroundColor: 'transparent' },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  flatRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: colors.card },
  rowFirst: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  rowLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  divider: { position: 'absolute', top: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  rowText: { flex: 1, minWidth: 0, gap: space.xs / 2 },
  rowRight: { alignItems: 'flex-end', gap: space.xs },
  iconBtn: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
}));

// Shared text styles used by the screens.
export const t = sheet(() => ({
  name: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: type.caption, color: colors.muted },
  price: { fontFamily: fonts.titleBold, fontSize: type.title, color: colors.ink, textAlign: 'right', ...tabular },
  unit: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.muted },
  label: { fontFamily: fonts.bodyBold, fontSize: type.caption, color: colors.muted },
}));
