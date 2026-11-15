// Opening animation (v3 "Majorelle"). The phone's launch screen is the same plain
// Majorelle blue, so the hand-over is seamless and no spinner shows.
// 1.5 s, no pause: the bubble pops, the 7 draws itself, the dot of the "?" drops in,
// the name and slogan rise, then the bubble grows and opens onto the app.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BUBBLE, SEVEN, SEVEN_LENGTH } from '@/components/brand';
import { fonts } from '@/theme';

const MAJORELLE = '#3D3BD9';
const AnimatedPath = Animated.createAnimatedComponent(Path);

export function Intro({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  const draw = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const [played, setPlayed] = useState(false);

  // Part 1 (about 1.1 s): every beat starts before the previous one ends.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          pop.setValue(1); draw.setValue(1); dot.setValue(1); word.setValue(1);
          setPlayed(true);
          return;
        }
        const after = (ms: number, a: Animated.CompositeAnimation) => Animated.sequence([Animated.delay(ms), a]);
        Animated.parallel([
          Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }),
          after(200, Animated.timing(draw, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.cubic), useNativeDriver: false })),
          after(580, Animated.spring(dot, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 14 })),
          after(660, Animated.timing(word, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
        ]).start(() => !cancelled && setPlayed(true));
      });
    return () => { cancelled = true; };
  }, [pop, draw, dot, word]);

  // Part 2 (0.4 s): once the app is loaded too, the bubble grows and opens onto it.
  useEffect(() => {
    if (!played || !ready) return;
    Animated.timing(out, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onDone);
  }, [played, ready, out, onDone]);

  const dash = draw.interpolate({ inputRange: [0, 1], outputRange: [SEVEN_LENGTH, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel="bch7al"
      style={[StyleSheet.absoluteFill, st.screen, { opacity: out.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0] }) }]}
    >
      <Animated.View
        style={{
          // grows from the bubble's tail, bottom left
          transformOrigin: '16% 97%',
          transform: [
            { scale: Animated.multiply(pop, out.interpolate({ inputRange: [0, 1], outputRange: [1, 9] })) },
          ],
        }}
      >
        <Svg width={150} height={150} viewBox="0 0 100 100">
          <Path d={BUBBLE} fill="#FFFFFF" />
          <AnimatedPath
            d={SEVEN}
            fill="none"
            stroke={MAJORELLE}
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={SEVEN_LENGTH}
            strokeDashoffset={dash}
            opacity={draw.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 1, 1] })}
          />
        </Svg>
        <Animated.View
          style={[st.dotWrap, { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }) }] }]}
        >
          <Svg width={150} height={150} viewBox="0 0 100 100">
            <Circle cx={50} cy={73.5} r={6.2} fill={MAJORELLE} />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: Animated.multiply(word, out.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] })),
          transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }}
      >
        <Text style={st.word}>bch7al?</Text>
        <Text style={st.tag}>3ref taman, chri mzyan.</Text>
      </Animated.View>
      <View />
    </Animated.View>
  );
}

const st = StyleSheet.create({
  screen: { backgroundColor: MAJORELLE, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  dotWrap: { position: 'absolute', top: 0, left: 0 },
  word: { fontFamily: fonts.titleBold, fontSize: 46, letterSpacing: -1.5, color: '#FFFFFF', marginTop: 22 },
  tag: { fontFamily: fonts.body, fontSize: 17, color: '#D6D5FF', marginTop: 6 },
});
