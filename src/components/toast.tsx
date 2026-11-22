// A short message that rises from the bottom, e.g. after saving a trip (inverse surface).
import { useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';
import { Icon } from '@/components/icon';
import { bubble, colors, motion, sheet, spring, text } from '@/theme';
import { space } from '@/tokens';

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
        Animated.spring(v, { toValue: 1, useNativeDriver: true, ...spring(motion.spatial.default) }),
        Animated.delay(1800),
        Animated.timing(v, { toValue: 0, duration: motion.fadeMs, useNativeDriver: true }),
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
      style={[st.toast, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}
    >
      <Icon name="check" color={colors.inverseOnSurface} weight="bold" />
      <Text style={st.text}>{msg}</Text>
    </Animated.View>
  );
}

const st = sheet(() => ({
  toast: { position: 'absolute', left: space.xl, right: space.xl, bottom: 112, backgroundColor: colors.inverseSurface, ...bubble('sm'), paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, elevation: 10 },
  text: { flex: 1, ...text('label'), color: colors.inverseOnSurface },
}));
