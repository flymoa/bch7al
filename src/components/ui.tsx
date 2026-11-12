import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '@/theme';
import { pct, pctChange } from '@/format';

type IconName = keyof typeof Ionicons.glyphMap;

export function Screen({ children, bottomBar }: { children: ReactNode; bottomBar?: 'home' | 'trips' | 'products' | 'settings' }) {
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={s.flex}>{children}</View>
      {bottomBar ? <BottomBar active={bottomBar} /> : null}
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
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.round, pressed && s.pressed]}>
      <Ionicons name={icon} size={22} color={tone === 'danger' ? colors.danger : colors.ink} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Row card that can be pressed. */
export function RowCard({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.card, s.row, pressed && s.pressed]}>
      {children}
    </Pressable>
  );
}

export function Tile({ text, size = 46 }: { text: string; size?: number }) {
  const letter = (text.trim().charAt(0) || '?').toUpperCase();
  return (
    <View style={[s.tile, { width: size, height: size, borderRadius: size / 3 }]}>
      <Text style={[s.tileText, { fontSize: size * 0.44 }]}>{letter}</Text>
    </View>
  );
}

export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: 'down' | 'up' | 'neutral'; icon?: IconName }) {
  const bg = tone === 'down' ? colors.soft : tone === 'up' ? colors.upBg : colors.neutral;
  const fg = tone === 'down' ? colors.softText : tone === 'up' ? colors.upText : colors.muted;
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Blue with a down arrow when the price dropped, orange with an up arrow when it rose. */
export function ChangeChip({ from, to }: { from: number | null; to: number | null }) {
  const change = pctChange(from, to);
  if (change === null) return null;
  if (Math.abs(change) < 0.05) return <Chip label="Même prix" />;
  return <Chip label={pct(change)} tone={change < 0 ? 'down' : 'up'} icon={change < 0 ? 'arrow-down' : 'arrow-up'} />;
}

export function Pill({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.pill, active && s.pillActive, disabled && !active && s.disabled, pressed && s.pressed]}
    >
      <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Button({ label, onPress, icon, tone = 'primary', disabled, style }: {
  label: string; onPress: () => void; icon?: IconName; tone?: 'primary' | 'dark' | 'light' | 'danger'; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'primary' ? colors.blue : tone === 'dark' ? colors.ink : colors.card;
  const fg = tone === 'light' ? colors.blue : tone === 'danger' ? colors.danger : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.button, { backgroundColor: bg }, (tone === 'light' || tone === 'danger') && s.buttonOutline, disabled && s.disabled, pressed && s.pressed, style]}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
      <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
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
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </Card>
  );
}

export function Txt({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text style={[s.txt, style]} numberOfLines={numberOfLines}>{children}</Text>;
}

function BottomBar({ active }: { active: 'home' | 'trips' | 'products' | 'settings' }) {
  const items: { key: typeof active; label: string; icon: IconName; href: '/' | '/trips' | '/products' | '/settings' }[] = [
    { key: 'home', label: 'Accueil', icon: 'home-outline', href: '/' },
    { key: 'trips', label: 'Courses', icon: 'list-outline', href: '/trips' },
    { key: 'products', label: 'Produits', icon: 'cube-outline', href: '/products' },
    { key: 'settings', label: 'Réglages', icon: 'settings-outline', href: '/settings' },
  ];
  const tab = (it: (typeof items)[number]) => (
    <Pressable
      key={it.key}
      accessibilityRole="tab"
      accessibilityState={{ selected: active === it.key }}
      onPress={() => active !== it.key && router.replace(it.href)}
      style={s.tab}
    >
      <Ionicons name={it.icon} size={24} color={active === it.key ? colors.blue : colors.muted} />
      <Text style={[s.tabText, active === it.key && { color: colors.blue }]}>{it.label}</Text>
    </Pressable>
  );
  return (
    <View style={s.bar}>
      {items.slice(0, 2).map(tab)}
      <Pressable accessibilityRole="button" accessibilityLabel="Nouvelle course" onPress={() => router.push('/trip/new')} style={({ pressed }) => [s.plus, pressed && s.pressed]}>
        <Ionicons name="add" size={32} color={colors.white} />
      </Pressable>
      {items.slice(2).map(tab)}
    </View>
  );
}

export const s = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 10 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.title, fontSize: 20, color: colors.ink },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  roundSpace: { width: 44, height: 44 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 14, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 10 },
  tile: { backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: fonts.titleBold, color: colors.softText },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  pill: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.ink },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  pillTextActive: { color: colors.white },
  button: { minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  buttonOutline: { borderWidth: 2, borderColor: colors.border },
  buttonText: { fontFamily: fonts.title, fontSize: 18 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontFamily: fonts.title, fontSize: 19, color: colors.ink },
  sectionAction: { minHeight: 32, justifyContent: 'center' },
  sectionActionText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.blue },
  empty: { padding: 22, alignItems: 'center', gap: 6 },
  emptyTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.ink, textAlign: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  txt: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  bar: { marginHorizontal: 16, marginBottom: 12, marginTop: 6, backgroundColor: colors.card, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, ...shadow, elevation: 6 },
  tab: { minWidth: 62, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted },
  plus: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 5, borderColor: colors.bg },
});

// Shared text styles used by the screens.
export const t = StyleSheet.create({
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  price: { fontFamily: fonts.title, fontSize: 18, color: colors.ink },
  unit: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted },
});
