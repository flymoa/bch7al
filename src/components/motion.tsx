// Small animations on React Native's Animated API (phone and web preview).
// Expression is spent on the hero, « Ton mois » and the moment a trip is saved — not on
// every element. Springs come from the Material tokens in src/tokens.ts.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { motion, spring } from '@/theme';

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduceMotion = v; }).catch(() => {});

/** Fades in with a short 8 dp rise. `index` staggers the first few rows of a list. */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(v, { toValue: 1, duration: motion.fadeMs, delay: Math.min(index, 6) * motion.stagger, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, index]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Press feedback: a fast spatial spring, no overshoot. */
export function usePressScale(to = 0.96) {
  const v = useRef(new Animated.Value(1)).current;
  const go = (val: number) => Animated.spring(v, { toValue: val, useNativeDriver: true, ...spring(motion.spatial.fast) }).start();
  return { style: { transform: [{ scale: v }] }, onPressIn: () => go(to), onPressOut: () => go(1) };
}

/** Counts a number up to its value (the month total). */
export function CountUp({ value, format, style }: { value: number; format: (v: number) => string; style?: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduceMotion) return;
    const start = from.current;
    const t0 = Date.now();
    const dur = 600;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      setShown(start + (value - start) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <Text style={style}>{format(reduceMotion ? value : shown)}</Text>;
}

/** Pops in on the default spatial spring (new basket line, verdict reveal). */
export function Pop({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(v, { toValue: 1, useNativeDriver: true, ...spring(motion.spatial.default) }).start();
  }, [v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>{children}</Animated.View>;
}
