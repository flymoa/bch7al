// Small animations built on React Native's Animated API (works on phone and in the web preview).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

const native = true;

/** Fades and slides its content up when it first appears. `index` staggers lists. */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, delay: Math.min(index, 8) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [v, index]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Returns handlers and a style that shrink an element slightly while pressed. */
export function usePressScale(to = 0.96) {
  const v = useRef(new Animated.Value(1)).current;
  const go = (val: number) => Animated.spring(v, { toValue: val, useNativeDriver: native, speed: 40, bounciness: val === 1 ? 8 : 0 }).start();
  return {
    style: { transform: [{ scale: v }] },
    onPressIn: () => go(to),
    onPressOut: () => go(1),
  };
}

/** Counts a number up to its value, e.g. the month total. */
export function CountUp({ value, format, style }: { value: number; format: (v: number) => string; style?: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const t0 = Date.now();
    const dur = 700;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <Text style={style}>{format(shown)}</Text>;
}

/** A chart bar that grows to its height. */
export function GrowBar({ height, color, index, style }: { height: number; color: string; index: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 450, delay: index * 35, easing: Easing.out(Easing.back(1.4)), useNativeDriver: false }).start();
  }, [v, height, index]);
  return <Animated.View style={[style, { backgroundColor: color, height: v.interpolate({ inputRange: [0, 1], outputRange: [4, height] }) }]} />;
}

/** Pops in (scale + fade), for confirmations and new basket lines. */
export function Pop({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 10 }).start();
  }, [v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>{children}</Animated.View>;
}
