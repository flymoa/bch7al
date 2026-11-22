// The bch7al? component kit. Every screen is built from these, and these only read
// tokens (src/tokens.ts) through the theme — no hex values, no stray numbers.
import { router } from 'expo-router';
import { useState, type ReactNode, type Ref } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, Path, Pattern, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { Icon, type IconName } from '@/components/icon';
import { usePressScale } from '@/components/motion';
import { money, pct, pctChange, VERDICT_WORD, type Verdict } from '@/format';
import { productIcon, storeIcon } from '@/icons';
import { bubble, colors, floatShadow, fonts, price as pc, sheet, text } from '@/theme';
import { radius, size, space } from '@/tokens';

export type Tab = 'home' | 'products' | 'list' | 'month';

// ------------------------------------------------------------------ screen frame

export function Screen({ children, tab, edgeColor }: { children: ReactNode; tab?: Tab; edgeColor?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={[s.screen, edgeColor ? { backgroundColor: edgeColor } : null]} edges={['top', 'left', 'right']}>
      <View style={s.flex}>{children}</View>
      {tab ? <BottomBar active={tab} bottom={insets.bottom} /> : <View style={{ height: insets.bottom, backgroundColor: colors.bg }} />}
    </SafeAreaView>
  );
}

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Sub-screen bar: back on the left, centred title, an optional action on the right. */
export function TopBar({ title, right, onBack = goBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <View style={s.topBar}>
      <IconButton icon="back" label="Retour" onPress={onBack} tone="surface" />
      <Text style={s.topTitle} numberOfLines={1}>{title ?? ''}</Text>
      {right ?? <View style={s.touch} />}
    </View>
  );
}

/** Tab-screen title: big Kufam headline on the left, quiet meta under it. */
export function ScreenTitle({ title, meta, right }: { title: string; meta?: string; right?: ReactNode }) {
  return (
    <View style={s.screenTitle}>
      <View style={s.flex}>
        <Text style={s.headline} accessibilityRole="header">{title}</Text>
        {meta ? <Text style={t.meta}>{meta}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ------------------------------------------------------------------ buttons

export function IconButton({ icon, label, onPress, tone = 'plain', disabled }: {
  icon: IconName; label: string; onPress: () => void; tone?: 'plain' | 'surface' | 'primary' | 'hero' | 'danger'; disabled?: boolean;
}) {
  const press = usePressScale(0.9);
  const bg = tone === 'surface' ? colors.surfaceContainer : tone === 'primary' ? colors.primary : tone === 'hero' ? colors.heroRaised : 'transparent';
  const fg = tone === 'primary' ? colors.onPrimary : tone === 'hero' ? colors.onHero : tone === 'danger' ? colors.error : colors.ink;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={4}
        style={[s.iconBtn, { backgroundColor: bg }, disabled && s.disabled]}
      >
        <Icon name={icon} size={size.icon} color={fg} />
      </Pressable>
    </Animated.View>
  );
}

type ButtonKind = 'primary' | 'tonal' | 'outline' | 'quiet' | 'danger' | 'onHero';

export function Button({ label, onPress, icon, kind = 'primary', disabled, style, compact }: {
  label: string; onPress: () => void; icon?: IconName; kind?: ButtonKind; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const press = usePressScale(0.97);
  const look: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    tonal: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
    outline: { bg: 'transparent', fg: colors.ink, border: colors.outline },
    quiet: { bg: 'transparent', fg: colors.primary },
    danger: { bg: 'transparent', fg: colors.error, border: colors.error },
    onHero: { bg: colors.onHero, fg: colors.hero },
  };
  const l = look[kind];
  return (
    <Animated.View style={[press.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[s.button, compact && s.buttonCompact, { backgroundColor: l.bg }, l.border ? { borderWidth: 1.5, borderColor: l.border } : null, disabled && s.disabled]}
      >
        {icon ? <Icon name={icon} size={compact ? size.iconDense : size.icon} color={l.fg} /> : null}
        <Text style={[s.buttonText, { color: l.fg }]} numberOfLines={1}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ------------------------------------------------------------------ lists

/** One tonal container for N rows. No shadow, no per-row card. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.group, style]}>{children}</View>;
}

/**
 * A 64 dp row: leading tile, name + muted meta, the price on the right as the hero and an
 * optional chip under it. `first` hides the inset hairline.
 */
export function Row({ label, onPress, leading, title, meta, price, unit, chip, right, first, dense, children }: {
  label?: string; onPress?: () => void; leading?: ReactNode; title?: ReactNode; meta?: ReactNode; price?: string; unit?: string;
  chip?: ReactNode; right?: ReactNode; first?: boolean; dense?: boolean; children?: ReactNode;
}) {
  const body = (
    <>
      {first ? null : <View style={[s.hairline, { left: leading ? space.lg + size.lead + space.md : space.lg }]} />}
      {leading}
      <View style={s.rowText}>
        {typeof title === 'string' ? <Text style={t.name} numberOfLines={1}>{title}</Text> : title}
        {meta == null ? null : typeof meta === 'string' ? <Text style={t.meta} numberOfLines={1}>{meta}</Text> : meta}
        {children}
      </View>
      {right}
      {price !== undefined || chip ? (
        <View style={s.rowEnd}>
          {price !== undefined ? (
            <Text style={t.price} numberOfLines={1}>{price}{unit ? <Text style={t.unit}>{' '}{unit}</Text> : null}</Text>
          ) : null}
          {chip}
        </View>
      ) : null}
    </>
  );
  const style = [s.row, dense && s.rowDense];
  if (!onPress) return <View style={style} accessible={!!label} accessibilityLabel={label}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [...style, pressed && s.pressed]}>
      {body}
    </Pressable>
  );
}

/** Bulle-shaped tile with an icon guessed from the name. */
export function Tile({ text: name, kind = 'product', tone = 'container', icon: forced }: { text: string; kind?: 'product' | 'store'; tone?: 'container' | 'hero'; icon?: IconName }) {
  const icon = forced ?? (kind === 'store' ? storeIcon(name) : productIcon(name));
  return (
    <View style={[s.tile, tone === 'hero' && { backgroundColor: colors.heroRaised }]}>
      <Icon name={icon} size={size.iconDense} color={tone === 'hero' ? colors.onHero : colors.onPrimaryContainer} />
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.section}>
      <Text style={s.overline} accessibilityRole="header">{title.toUpperCase()}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12} style={s.sectionAction}>
          <Text style={s.sectionActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ price chips
// Heavy = dearer, light = cheaper. Always an arrow + sign + word: colour is never alone.

type Dir = 'up' | 'down' | 'same';

export function PriceChip({ dir, label, onHero }: { dir: Dir; label: string; onHero?: boolean }) {
  const bg = dir === 'up' ? (onHero ? pc.upOnHeroBg : pc.upBg) : dir === 'down' ? (onHero ? pc.downOnHeroBg : pc.downBg) : onHero ? pc.sameOnHeroBg : pc.sameBg;
  const fg = dir === 'up' ? (onHero ? pc.upOnHeroFg : pc.upFg) : dir === 'down' ? (onHero ? pc.downOnHeroFg : pc.downFg) : onHero ? pc.sameOnHeroFg : pc.sameFg;
  return (
    <View style={[s.chip, { backgroundColor: bg }]} accessibilityLabel={label}>
      <Icon name={dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'same'} size={size.iconInline} color={fg} weight="bold" />
      <Text style={[dir === 'up' ? s.chipTextStrong : s.chipText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const dirOf = (v: Verdict): Dir => (v.kind === 'high' ? 'up' : v.kind === 'good' ? 'down' : 'same');

/** « Ghali · +8 % », « Rkhis · −6 % », « Normal ». `count` adds « · 6 achats ». */
export function VerdictChip({ v, count, onHero }: { v: Verdict; count?: number; onHero?: boolean }) {
  const sign = v.change < 0 ? '−' : '+';
  const label = VERDICT_WORD[v.kind] + (v.kind === 'normal' ? '' : ` · ${sign}${pct(v.change)}`) + (count ? ` · ${count} achat${count > 1 ? 's' : ''}` : '');
  return <PriceChip dir={dirOf(v)} label={label} onHero={onHero} />;
}

/** Change between two prices as a chip; nothing when it cannot be computed. */
export function ChangeChip({ from, to, onHero }: { from: number | null; to: number | null; onHero?: boolean }) {
  const change = pctChange(from, to);
  if (change === null) return null;
  if (Math.abs(change) < 0.05) return <PriceChip dir="same" label="Même prix" onHero={onHero} />;
  return <PriceChip dir={change < 0 ? 'down' : 'up'} label={`${change < 0 ? '−' : '+'}${pct(change)}`} onHero={onHero} />;
}

/** « À vérifier »: dashed border, no hue at all. */
export function CheckChip({ label }: { label: string }) {
  return (
    <View style={s.checkChip}>
      <Icon name="check2" size={size.iconInline} color={pc.warnFg} />
      <Text style={[s.chipText, { color: pc.warnFg }]}>{label}</Text>
    </View>
  );
}

/** Selectable pill (stores, units, filters). Selected = solid ink. */
export function Pill({ label, active, onPress, disabled, icon }: { label: string; active: boolean; onPress: () => void; disabled?: boolean; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.pill, active && s.pillOn, pressed && !active && s.pressed, disabled && !active && s.disabled]}
    >
      {icon ? <Icon name={icon} size={size.iconInline} color={active ? colors.bg : colors.ink} weight={active ? 'fill' : 'regular'} /> : null}
      <Text style={[s.pillText, active && s.pillTextOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ------------------------------------------------------------------ inputs

/** `onCard`: the field sits on a surfaceContainer card, so it takes the plain surface to stay visible. */
export function Field({ style, big, onCard, ...props }: TextInputProps & { big?: boolean; onCard?: boolean; ref?: Ref<TextInputInstance> }) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
      style={[s.field, onCard && s.fieldOnCard, big && s.fieldBig, focus && s.fieldFocus, style]}
    />
  );
}

// ------------------------------------------------------------------ notices & empty states

/** A tonal line that leads somewhere (backup reminder, recap ready…). */
export function Notice({ icon, text: msg, onPress, kind = 'info' }: { icon: IconName; text: string; onPress?: () => void; kind?: 'info' | 'check' }) {
  const inner = (
    <>
      <Icon name={icon} size={size.iconDense} color={kind === 'info' ? colors.onPrimaryContainer : pc.warnFg} />
      <Text style={[s.noticeText, kind === 'check' && { color: pc.warnFg }]}>{msg}</Text>
      {onPress ? <Icon name="next" size={size.iconDense} color={kind === 'info' ? colors.onPrimaryContainer : colors.muted} /> : null}
    </>
  );
  const style = [s.notice, kind === 'check' && s.noticeCheck];
  if (!onPress) return <View style={style} accessibilityLiveRegion="polite">{inner}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={msg} onPress={onPress} style={({ pressed }) => [...style, pressed && s.pressedSoft]}>
      {inner}
    </Pressable>
  );
}

/** Status + what it teaches + one way out. A Darija line for voice, French for meaning. */
export function Empty({ icon = 'receipt', darija, title, text: body, action }: {
  icon?: IconName; darija?: string; title: string; text: string; action?: { label: string; icon?: IconName; onPress: () => void };
}) {
  return (
    <View style={s.empty}>
      <Motif style={StyleSheet.absoluteFill} />
      <View style={s.emptyIcon}>
        <Icon name={icon} size={size.iconEmpty} color={colors.primary} weight="duotone" duotone={colors.primaryContainer} />
      </View>
      {darija ? <Text style={s.emptyDarija}>{darija}</Text> : null}
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{body}</Text>
      {action ? <Button label={action.label} icon={action.icon} onPress={action.onPress} style={s.emptyAction} /> : null}
    </View>
  );
}

/** The one Moroccan motif: an 8-point zellige star grid, monochrome, 6 % opacity. Never behind prices. */
export function Motif({ style, color }: { style?: StyleProp<ViewStyle>; color?: string }) {
  const c = color ?? pc.motif;
  return (
    <View pointerEvents="none" style={[s.motif, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="zellige" patternUnits="userSpaceOnUse" width={40} height={40}>
            <Path d="M20 6 24 16 34 20 24 24 20 34 16 24 6 20 16 16Z" fill="none" stroke={c} strokeWidth={1.5} />
            <Rect x={14} y={14} width={12} height={12} fill="none" stroke={c} strokeWidth={1.5} transform="rotate(45 20 20)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#zellige)" />
      </Svg>
    </View>
  );
}

// ------------------------------------------------------------------ charts
// Tufte: word-sized, frameless, the latest point tied to the number, low marked. Step lines
// because a price changes per trip, never in between. No smoothing.

export function Sparkline({ values, width = size.sparkW, height = size.sparkH, onHero }: { values: number[]; width?: number; height?: number; onHero?: boolean }) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
  const pts: string[] = [];
  values.forEach((v, i) => {
    if (i > 0) pts.push(`${x(i)},${y(values[i - 1])}`);
    pts.push(`${x(i)},${y(v)}`);
  });
  const minI = values.indexOf(lo);
  const last = values.length - 1;
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polyline points={pts.join(' ')} fill="none" stroke={onHero ? colors.onHeroMuted : pc.chartLine} strokeWidth={1.5} strokeLinejoin="round" />
      {minI !== last ? <Circle cx={x(minI)} cy={y(lo)} r={2.5} fill={onHero ? colors.hero : colors.bg} stroke={onHero ? colors.onHero : pc.chartMin} strokeWidth={1.5} /> : null}
      <Circle cx={x(last)} cy={y(values[last])} r={3} fill={onHero ? colors.onHero : pc.chartAccent} />
    </Svg>
  );
}

export type ChartPoint = { v: number; promo?: boolean; label?: string };

/** Detail chart: 2 dp step line, 6 dp points (hollow = promo), « ton prix habituel » band, direct labels. */
export function StepChart({ points, width, height = 140, usual }: { points: ChartPoint[]; width: number; height?: number; usual?: number | null }) {
  if (points.length < 2 || width <= 0) return null;
  const vals = points.map((p) => p.v);
  const lo = Math.min(...vals, usual ?? Infinity), hi = Math.max(...vals, usual ?? -Infinity), span = hi - lo || 1;
  const padX = 8, top = 20, bottom = 20;
  const x = (i: number) => padX + (i / (points.length - 1)) * (width - padX * 2);
  const y = (v: number) => top + (1 - (v - lo) / span) * (height - top - bottom);
  const path = points.map((p, i) => (i === 0 ? `M${x(0)},${y(p.v)}` : `H${x(i)}V${y(p.v)}`)).join('');
  const band = usual ? { y1: y(usual * 1.05), y2: y(usual * 0.95) } : null;
  const last = points.length - 1;
  const minI = vals.indexOf(Math.min(...vals));
  const maxI = vals.indexOf(Math.max(...vals));
  return (
    <Svg width={width} height={height}>
      {band ? <Rect x={0} y={Math.max(0, band.y1)} width={width} height={Math.max(2, band.y2 - band.y1)} fill={pc.band} /> : null}
      <Line x1={0} x2={width} y1={height - bottom + 6} y2={height - bottom + 6} stroke={colors.line} strokeWidth={1} />
      <Path d={path} fill="none" stroke={pc.chartAccent} strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={x(i)} cy={y(p.v)} r={i === last ? 4.5 : 3} fill={p.promo ? colors.bg : pc.chartAccent} stroke={pc.chartAccent} strokeWidth={p.promo ? 1.5 : 0} />
      ))}
      {minI !== last ? <Circle cx={x(minI)} cy={y(vals[minI])} r={6} fill="none" stroke={pc.chartMin} strokeWidth={1.5} /> : null}
      <SvgLabel x={x(last)} y={y(vals[last]) - 8} anchor="end" bold>{money(vals[last])}</SvgLabel>
      {maxI !== last ? <SvgLabel x={x(maxI)} y={y(vals[maxI]) - 8} anchor={maxI === 0 ? 'start' : 'middle'}>{money(vals[maxI])}</SvgLabel> : null}
      {minI !== last && minI !== maxI ? <SvgLabel x={x(minI)} y={y(vals[minI]) + 16} anchor={minI === 0 ? 'start' : 'middle'}>{money(vals[minI])}</SvgLabel> : null}
    </Svg>
  );
}

function SvgLabel({ x, y, children, anchor, bold }: { x: number; y: number; children: string; anchor: 'start' | 'middle' | 'end'; bold?: boolean }) {
  return (
    <SvgText x={x} y={y} fontSize={11} fontFamily={bold ? fonts.textSemi : fonts.text} fill={bold ? colors.ink : colors.muted} textAnchor={anchor}>
      {children}
    </SvgText>
  );
}

/** Horizontal bars ranked by value (never a donut). */
export function Bars({ rows, onPress }: { rows: { key: string; label: string; value: number; meta?: string }[]; onPress?: (key: string) => void }) {
  const max = Math.max(...rows.map((r) => r.value), 0.01);
  return (
    <View style={s.bars}>
      {rows.map((r, i) => (
        <Pressable key={r.key} disabled={!onPress} onPress={() => onPress?.(r.key)} accessibilityLabel={`${r.label} : ${money(r.value)} dirhams`} style={({ pressed }) => [s.barRow, pressed && s.pressedSoft]}>
          <View style={s.barHead}>
            <Text style={t.name} numberOfLines={1}>{r.label}</Text>
            <Text style={t.price}>{money(r.value).replace(/,00$/, '')}<Text style={t.unit}>{' '}DH</Text></Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.max(3, (r.value / max) * 100)}%`, backgroundColor: i === 0 ? colors.primary : colors.primaryContainer }]} />
          </View>
          {r.meta ? <Text style={t.meta}>{r.meta}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ bottom sheet (FAB menu)

export function ActionSheet({ visible, onClose, title, actions }: {
  visible: boolean; onClose: () => void; title: string; actions: { icon: IconName; label: string; meta: string; onPress: () => void }[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={[s.sheet, { paddingBottom: space.xxl + insets.bottom }]}>
        <View style={s.grabber} />
        <Text style={s.sheetTitle}>{title}</Text>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={() => { onClose(); a.onPress(); }}
            style={({ pressed }) => [s.sheetRow, pressed && s.pressed]}
          >
            <View style={s.sheetIcon}><Icon name={a.icon} color={colors.onPrimaryContainer} /></View>
            <View style={s.flex}>
              <Text style={t.name}>{a.label}</Text>
              <Text style={t.meta}>{a.meta}</Text>
            </View>
            <Icon name="next" size={size.iconDense} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ------------------------------------------------------------------ bottom bar

const TABS: { key: Tab; label: string; icon: IconName; href: '/' | '/products' | '/list' | '/month' }[] = [
  { key: 'home', label: 'Accueil', icon: 'home', href: '/' },
  { key: 'products', label: 'Produits', icon: 'products', href: '/products' },
  { key: 'list', label: 'Liste', icon: 'list', href: '/list' },
  { key: 'month', label: 'Mois', icon: 'month', href: '/month' },
];

/** Opens the « Nouvelle course » menu from anywhere. */
export function openNewTrip(how: 'scan' | 'manual') {
  if (how === 'manual') router.push('/trip/new');
  else router.push(process.env.EXPO_OS === 'web' ? '/trip/new?scan=camera' : '/camera');
}

function BottomBar({ active, bottom }: { active: Tab; bottom: number }) {
  const [menu, setMenu] = useState(false);
  const press = usePressScale(0.9);
  const tab = (it: (typeof TABS)[number]) => {
    const on = active === it.key;
    return (
      <Pressable key={it.key} accessibilityRole="tab" accessibilityLabel={it.label} accessibilityState={{ selected: on }} onPress={() => !on && router.replace(it.href)} style={s.tab}>
        <View style={[s.tabPill, on && s.tabPillOn]}>
          <Icon name={it.icon} color={on ? colors.onSecondaryContainer : colors.muted} weight={on ? 'fill' : 'regular'} />
        </View>
        <Text style={[s.tabText, on && s.tabTextOn]}>{it.label}</Text>
      </Pressable>
    );
  };
  return (
    <>
      <View style={[s.bar, { paddingBottom: space.xs + bottom }]}>
        {TABS.slice(0, 2).map(tab)}
        <Animated.View style={[s.fabWrap, press.style]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nouvelle course"
            onPress={() => setMenu(true)}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            style={s.fab}
          >
            <Icon name="plus" size={28} color={colors.onPrimary} weight="bold" />
          </Pressable>
        </Animated.View>
        {TABS.slice(2).map(tab)}
      </View>
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title="Nouvelle course"
        actions={[
          { icon: 'scan', label: 'Scanner le ticket', meta: 'Photo du ticket, les articles se remplissent', onPress: () => openNewTrip('scan') },
          { icon: 'manual', label: 'Saisie rapide', meta: 'Hanout, souk, sans ticket', onPress: () => openNewTrip('manual') },
        ]}
      />
    </>
  );
}

// ------------------------------------------------------------------ styles

export const s = sheet(() => ({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: colors.bg },
  pressed: { backgroundColor: colors.pressed },
  pressedSoft: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  touch: { width: size.touch, height: size.touch },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm },
  topTitle: { flex: 1, textAlign: 'center', ...text('title'), color: colors.ink },
  screenTitle: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, paddingHorizontal: size.screen, paddingTop: space.xxl, paddingBottom: space.lg },
  headline: { ...text('headline'), color: colors.ink },
  iconBtn: { width: size.touch, height: size.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: size.button, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xxl },
  buttonCompact: { minHeight: size.touch - 4, paddingHorizontal: space.lg },
  buttonText: { ...text('label'), fontFamily: text('title').fontFamily },
  group: { backgroundColor: colors.surfaceContainer, borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowDense: { minHeight: size.rowDense, paddingVertical: space.sm },
  hairline: { position: 'absolute', top: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  rowText: { flex: 1, minWidth: 0, gap: space.xxs },
  rowEnd: { alignItems: 'flex-end', gap: space.xs },
  tile: { width: size.lead, height: size.lead, ...bubble('sm'), backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.section, paddingBottom: space.sm, paddingHorizontal: space.xs },
  overline: { ...text('overline'), color: colors.muted },
  sectionAction: { minHeight: size.touch - 8, justifyContent: 'center' },
  sectionActionText: { ...text('label'), color: colors.primary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 26, paddingHorizontal: space.sm, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chipText: { ...text('priceDelta'), fontFamily: text('labelSm').fontFamily },
  chipTextStrong: { ...text('priceDelta') },
  checkChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 26, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.muted, alignSelf: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch - 8, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceContainer },
  pillOn: { backgroundColor: colors.ink },
  pillText: { ...text('label'), color: colors.ink },
  pillTextOn: { color: colors.bg },
  field: { minWidth: 0, minHeight: size.input, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: space.lg, ...text('body'), color: colors.ink },
  fieldOnCard: { backgroundColor: colors.surface, borderColor: colors.line },
  fieldBig: { minHeight: 64, ...text('display'), fontSize: 30, lineHeight: 38 },
  fieldFocus: { borderColor: colors.primary, backgroundColor: colors.surface },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.button, paddingHorizontal: space.lg, paddingVertical: space.md, ...bubble('sm'), backgroundColor: colors.primaryContainer },
  noticeCheck: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: pc.warnBorder },
  noticeText: { flex: 1, ...text('bodySm'), fontFamily: text('label').fontFamily, color: colors.onPrimaryContainer },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xxl, paddingVertical: space.x3, borderRadius: radius.hero, backgroundColor: colors.surfaceLow, overflow: 'hidden' },
  emptyIcon: { marginBottom: space.sm },
  emptyDarija: { ...text('headlineSm'), color: colors.ink, textAlign: 'center' },
  emptyTitle: { ...text('title'), color: colors.ink, textAlign: 'center' },
  emptyText: { ...text('bodySm'), color: colors.muted, textAlign: 'center' },
  emptyAction: { marginTop: space.lg, alignSelf: 'stretch' },
  motif: { overflow: 'hidden' },
  bars: { gap: space.lg },
  barRow: { gap: space.xs },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  barTrack: { height: space.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  barFill: { height: space.sm, borderRadius: radius.pill },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs, ...floatShadow('sheet') },
  grabber: { alignSelf: 'center', width: 32, height: 4, borderRadius: radius.pill, backgroundColor: colors.line, marginBottom: space.md },
  sheetTitle: { ...text('titleLg'), color: colors.ink, paddingHorizontal: space.sm, paddingBottom: space.sm },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row + 8, paddingHorizontal: space.sm, borderRadius: radius.card },
  sheetIcon: { width: 48, height: 48, ...bubble('sm'), backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingTop: space.sm, paddingHorizontal: space.xs, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', gap: space.xs },
  tabPill: { width: 56, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabPillOn: { backgroundColor: colors.secondaryContainer },
  tabText: { ...text('labelSm'), color: colors.muted },
  tabTextOn: { color: colors.ink, fontFamily: text('title').fontFamily },
  fabWrap: { marginTop: -space.xl, marginHorizontal: space.xs },
  fab: { width: size.fab, height: size.fab, ...bubble('lg'), backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...floatShadow('fab') },
}));

/** Shared text styles. */
export const t = sheet(() => ({
  name: { ...text('title'), color: colors.ink } as TextStyle,
  meta: { ...text('caption'), color: colors.muted } as TextStyle,
  body: { ...text('bodySm'), color: colors.muted } as TextStyle,
  price: { ...text('priceRow'), color: colors.ink, textAlign: 'right' } as TextStyle,
  unit: { ...text('priceUnit'), color: colors.muted } as TextStyle,
  label: { ...text('overline'), color: colors.muted } as TextStyle,
}));
