// A short message that slides up from the bottom, e.g. after saving a trip.
import { Icon } from '@/components/icon';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, fonts, sheet } from '@/theme';

type Listener = (msg: string) => void;
const listeners = new Set<Listener>();
let pending: string | null = null;

export function showToast(msg: string) {
  if (listeners.size === 0) pending = msg;
  listeners.forEach((l) => l(msg));
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l: Listener = (m) => {
      setMsg(m);
      v.setValue(0);
      Animated.sequence([
        Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
        Animated.delay(1800),
        Animated.timing(v, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMsg(null));
    };
    listeners.add(l);
    if (pending) { const m = pending; pending = null; l(m); }
    return () => { listeners.delete(l); };
  }, [v]);
  if (!msg) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[st.toast, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}
    >
      <Icon name="checkmark-circle" size={22} color={colors.accent} />
      <Text style={st.text}>{msg}</Text>
    </Animated.View>
  );
}

const st = sheet(() => ({
  toast: { position: 'absolute', left: 24, right: 24, bottom: 100, backgroundColor: colors.ink, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 10 },
  text: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onInk },
}));
