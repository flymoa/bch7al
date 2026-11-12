// Opening animation. It starts from the same picture as the phone's launch
// screen (white 7 on blue), so the hand-over is seamless and no spinner shows.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const SEVEN = 'M62 54H138C128 78 104 100 100 130';
const SEVEN_LENGTH = 170; // a little longer than the real path, so it draws fully

export function Intro({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const draw = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const [drawn, setDrawn] = useState(false);

  // Part 1: the 7 draws itself, the dot drops in, the name appears.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          draw.setValue(1); dot.setValue(1); word.setValue(1);
          setDrawn(true);
          return;
        }
        Animated.sequence([
          Animated.timing(draw, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
          Animated.spring(dot, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 14 }),
          Animated.timing(word, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.delay(250),
        ]).start(() => !cancelled && setDrawn(true));
      });
    return () => { cancelled = true; };
  }, [draw, dot, word]);

  // Part 2: once the app is loaded too, the blue screen grows and fades away.
  useEffect(() => {
    if (!drawn || !ready) return;
    Animated.timing(out, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onDone);
  }, [drawn, ready, out, onDone]);

  const dashOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [SEVEN_LENGTH, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel="bch7al"
      style={[StyleSheet.absoluteFill, st.screen, { opacity: out.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }) }]}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }}>
        <Svg width={170} height={170} viewBox="0 0 200 200">
          <AnimatedPath d={SEVEN} fill="none" stroke={colors.white} strokeWidth={27} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={SEVEN_LENGTH} strokeDashoffset={dashOffset} />
        </Svg>
        <Animated.View
          style={[st.dotWrap, { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }, { scale: dot }] }]}
        >
          <Svg width={170} height={170} viewBox="0 0 200 200">
            <Circle cx={100} cy={166} r={16} fill="#A9C5FF" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Text style={st.word}>
            bch<Text style={st.seven}>7</Text>al?
          </Text>
          <Text style={st.tag}>Ton carnet de courses</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  screen: { backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  dotWrap: { position: 'absolute', top: 0 },
  word: { fontFamily: fonts.titleBold, fontSize: 38, color: colors.white, textAlign: 'center', marginTop: 4 },
  seven: { color: '#A9C5FF' },
  tag: { fontFamily: fonts.body, fontSize: 15, color: '#DCE6FF', textAlign: 'center', marginTop: 2 },
});
