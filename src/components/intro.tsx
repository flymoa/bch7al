// Opening animation (v2, "bleu nuit"). The phone's launch screen is the same plain
// navy, so the hand-over is seamless and no spinner shows.
// The 7 lands (600 ms); while it is still landing the rest of the name slides in and
// the "?" springs in, then a short hold (350 ms) and the screen grows and fades away (420 ms).
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/theme';

const NIGHT = '#0B1B4D';
const BLUE = '#4D6FFF';
const PALE = '#C3D0FF';
const STRIP = [BLUE, BLUE, BLUE, '#2A3F8C', '#2A3F8C', '#2A3F8C', '#2A3F8C', '#2A3F8C', '#FFFFFF', '#FFFFFF'];

export function Intro({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const land = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;
  const [played, setPlayed] = useState(false);

  // Part 1: the 7 lands, the "?" springs in, the name and the rest appear.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          land.setValue(1); mark.setValue(1); word.setValue(1);
          setPlayed(true);
          return;
        }
        // The beats overlap, so nothing stands still between the 7 landing and the rest.
        Animated.sequence([
          Animated.parallel([
            Animated.timing(land, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([Animated.delay(300), Animated.timing(word, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
            Animated.sequence([Animated.delay(480), Animated.spring(mark, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 })]),
          ]),
          Animated.delay(350),
        ]).start(() => !cancelled && setPlayed(true));
      });
    return () => { cancelled = true; };
  }, [land, mark, word]);

  // Part 2: once the app is loaded too, the navy screen grows and fades away.
  useEffect(() => {
    if (!played || !ready) return;
    Animated.timing(out, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onDone);
  }, [played, ready, out, onDone]);

  const slide = (from: number) => ({ opacity: word, transform: [{ translateX: word.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] });
  const rise = { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] };

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel="bch7al"
      style={[StyleSheet.absoluteFill, st.screen, { opacity: out.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }) }]}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }}>
        <View style={st.row}>
          <Animated.Text style={[st.word, slide(-44)]}>bch</Animated.Text>
          <Animated.Text
            style={[st.word, st.blue, {
              opacity: land.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateY: land.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }) },
                { scale: land.interpolate({ inputRange: [0, 1], outputRange: [3, 1] }) },
                { rotate: land.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] }) },
              ],
            }]}
          >
            7
          </Animated.Text>
          <Animated.Text style={[st.word, slide(44)]}>al</Animated.Text>
          <Animated.Text
            style={[st.word, st.blue, { opacity: mark, transform: [{ translateY: mark.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }, { scale: mark }] }]}
          >
            ?
          </Animated.Text>
        </View>
        <Animated.Text style={[st.arabic, rise]}>بشحال؟</Animated.Text>
        <Animated.View style={[st.strip, { opacity: word, transform: [{ scaleX: word }] }]}>
          {STRIP.map((c, i) => (
            <View key={i} style={[st.seg, { backgroundColor: c }]} />
          ))}
        </Animated.View>
        <Animated.Text style={[st.tag, { opacity: word }]}>3ref taman, chri mzyan.</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  screen: { backgroundColor: NIGHT, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  row: { flexDirection: 'row', alignItems: 'baseline' },
  word: { fontFamily: fonts.titleBold, fontSize: 64, lineHeight: 76, letterSpacing: -2, color: '#FFFFFF' },
  blue: { color: BLUE },
  arabic: { fontFamily: fonts.title, fontSize: 28, color: PALE, marginTop: 14 },
  strip: { flexDirection: 'row', gap: 4, width: 220, marginTop: 22, transformOrigin: 'left center' },
  seg: { flex: 1, height: 10, borderRadius: 5 },
  tag: { fontFamily: fonts.body, fontSize: 16, color: PALE, marginTop: 22 },
});
