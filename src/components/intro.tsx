// Opening animation (v4 « Majorelle Nuit »). The phone launch screen is plain night ink with NO logo (splash-blank.png), the same plain
// night ink, so the hand-over is seamless. Icon done in 460 ms, never held:
// 0–280 ms the white bubble pops (0.72 → 1, slight overshoot), 160–460 ms the 7 draws
// itself in Majorelle, then — as soon as the app is ready — a 200 ms exit: the bubble
// grows a touch while everything fades onto Accueil.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BUBBLE, SEVEN, SEVEN_LENGTH } from '@/components/brand';
import { fonts, motion, spring } from '@/theme';
import { brand, space } from '@/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function Intro({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  const draw = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const [played, setPlayed] = useState(false);
  const m = motion.splash;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) { pop.setValue(1); draw.setValue(1); word.setValue(1); setPlayed(true); return; }
        Animated.parallel([
          Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...spring({ ratio: 0.7, stiffness: 700 }) }),
          Animated.sequence([
            Animated.delay(m.sevenStartMs),
            Animated.timing(draw, { toValue: 1, duration: m.sevenMs, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
          ]),
          Animated.sequence([
            Animated.delay(m.wordStartMs),
            Animated.timing(word, { toValue: 1, duration: m.wordMs, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.delay(m.holdMs), // time to read the slogan
          ]),
        ]).start(() => !cancelled && setPlayed(true));
      });
    return () => { cancelled = true; };
  }, [pop, draw, word, m.sevenStartMs, m.sevenMs, m.wordStartMs, m.wordMs, m.holdMs]);

  useEffect(() => {
    if (!played || !ready) return;
    Animated.timing(out, { toValue: 1, duration: m.exitMs, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(onDone);
  }, [played, ready, out, onDone, m.exitMs]);

  const dash = draw.interpolate({ inputRange: [0, 1], outputRange: [SEVEN_LENGTH, 0] });
  return (
    <Animated.View pointerEvents="none" accessibilityLabel="bch7al" style={[StyleSheet.absoluteFill, st.screen, { opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Animated.View style={{ transform: [{ scale: Animated.multiply(pop.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }), out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })) }], opacity: pop.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }) }}>
        <Svg width={132} height={132} viewBox="0 0 100 100">
          <Path d={BUBBLE} fill={brand.white} />
          <AnimatedPath d={SEVEN} fill="none" stroke={brand.majorelle} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={SEVEN_LENGTH} strokeDashoffset={dash} />
          <Circle cx={50} cy={73.5} r={6.2} fill={brand.majorelle} />
        </Svg>
      </Animated.View>
      <Animated.View style={{ alignItems: 'center', opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <Text style={st.word}>bch7al?</Text>
        <Text style={st.tag}>3ref taman, chri mzyan.</Text>
      </Animated.View>
      <View />
    </Animated.View>
  );
}

const st = StyleSheet.create({
  screen: { backgroundColor: brand.night, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  word: { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 48, color: brand.white, marginTop: space.xl },
  tag: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24, color: brand.sky, marginTop: space.xs },
});
