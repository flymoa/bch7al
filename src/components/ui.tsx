import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, shadow, sheet } from '@/theme';
import { pct, pctChange, type Verdict } from '@/format';
import { productIcon, storeIcon } from '@/icons';
import { usePressScale } from './motion';
import { Animated } from 'react-native';

type IconName = keyof typeof Ionicons.glyphMap;

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
        <Ionicons name={icon} size={22} color={tone === 'danger' ? colors.danger : colors.ink} />
      </Pressable>
    </Animated.View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Row card that can be pressed. */
export function RowCard({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  const press = usePressScale(0.975);
  return (
    <Animated.View style={press.style}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={({ pressed }) => [s.card, s.row, pressed && s.rowPressed]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Rounded square with an icon guessed from the name: a product icon, or a store icon with kind="store". */
export function Tile({ text, size = 46, kind = 'product' }: { text: string; size?: number; kind?: 'product' | 'store' }) {
  const icon = kind === 'store' ? storeIcon(text) : productIcon(text);
  return (
    <View style={[s.tile, { width: size, height: size, borderRadius: size / 3 }]}>
      <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={Math.round(size * 0.52)} color={colors.softText} />
    </View>
  );
}

export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: 'down' | 'up' | 'neutral'; icon?: IconName }) {
  const bg = tone === 'down' ? colors.soft : tone === 'up' ? colors.upBg : colors.neutral;
  const fg = tone === 'down' ? colors.softText : tone === 'up' ? colors.upText : colors.muted;
  return (
    <View style={[s.chip, { backgroundColor: bg }, tone === 'up' && s.chipUp]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
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
        {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
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
      {good ? <Ionicons name="arrow-down" size={12} color={colors.white} /> : high ? <Ionicons name="arrow-up" size={12} color={onNight ? colors.white : colors.upText} /> : null}
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
                  ? { backgroundColor: onNight ? '#2A3F8C' : colors.barSoft }
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

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <Card style={s.empty}>
      <View style={s.emptyIcon}>
        <MaterialCommunityIcons name="basket-outline" size={34} color={colors.blue} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
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
      <Pressable accessibilityRole="button" accessibilityLabel="Scanner un ticket" onPress={() => router.push('/trip/new?scan=camera')} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={s.plus}>
        <Ionicons name="scan" size={28} color={colors.white} />
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
      <Ionicons name={(active === it.key ? it.icon.replace('-outline', '') : it.icon) as IconName} size={24} color={active === it.key ? colors.blue : colors.muted} />
      <Text style={[s.tabText, active === it.key && { color: colors.blue }]}>{it.label}</Text>
    </Pressable>
  );
  return (
    <View style={[s.bar, { paddingBottom: 8 + bottom }]}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 10 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.title, fontSize: 20, color: colors.ink },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  roundSpace: { width: 44, height: 44 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 14, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 10 },
  tile: { backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: fonts.titleBold, color: colors.softText },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 28, paddingHorizontal: 10, borderRadius: 14, alignSelf: 'center' },
  badgeHigh: { borderWidth: 2, borderColor: colors.upText, backgroundColor: colors.upBg, paddingHorizontal: 8 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  stripWrap: { gap: 8 },
  strip: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 10, borderRadius: 5 },
  segHigh: { borderWidth: 2, borderColor: colors.upText, backgroundColor: colors.upBg },
  stripText: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  stripStrong: { fontFamily: fonts.bodyBold },
  chipUp: { borderWidth: 1.5, borderColor: colors.upText, paddingVertical: 0.5 },
  upBox: { borderWidth: 2, borderColor: colors.upText },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  pill: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  pillTextActive: { color: colors.onInk },
  button: { minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  buttonOutline: { borderWidth: 2, borderColor: colors.border },
  buttonText: { fontFamily: fonts.title, fontSize: 18 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontFamily: fonts.title, fontSize: 19, color: colors.ink },
  sectionAction: { minHeight: 32, justifyContent: 'center' },
  sectionActionText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.blue },
  empty: { padding: 22, alignItems: 'center', gap: 6 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.ink, textAlign: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  txt: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  bar: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8 },
  tab: { minWidth: 62, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted },
  plusWrap: { marginTop: -34 },
  plus: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.bg, shadowColor: colors.blue, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  rowPressed: { backgroundColor: colors.cardPressed },
}));

// Shared text styles used by the screens.
export const t = sheet(() => ({
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  price: { fontFamily: fonts.title, fontSize: 18, color: colors.ink },
  unit: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted },
}));
