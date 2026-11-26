// The receipt camera: a bulle-shaped frame over the live view, flash, gallery and manual
// shortcuts. No shutter sound. The photo goes to the trip screen, which reads it.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Alert } from '@/alert';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui';
import { setPendingPhoto } from '@/scan';
import { bubble, colors, fonts, sheet, text, useTheme } from '@/theme';
import { brand, bulle, radius, size, space } from '@/tokens';

const WHITE = brand.white;
const GLASS = 'rgba(14,19,64,0.55)';

export default function Camera() {
  useTheme();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const shoot = async () => {
    if (!cam.current || !ready || busy) return;
    setBusy(true);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.7, shutterSound: false, skipProcessing: true });
      setPendingPhoto({ uri: pic.uri, mimeType: 'image/jpeg' });
      router.replace('/trip/new?scan=photo');
    } catch (e) {
      setBusy(false);
      Alert.alert('La photo a échoué', String((e as Error).message ?? e));
    }
  };

  if (!perm) return <View style={st.screen} />;
  if (!perm.granted) {
    return (
      <SafeAreaView style={[st.screen, st.center]}>
        <View style={st.askBox}>
          <Icon name="camera" size={size.iconEmpty} color={colors.primary} weight="duotone" duotone={colors.primaryContainer} />
          <Text style={st.askTitle}>Autorise l'appareil photo</Text>
          <Text style={st.askText}>Pour lire tes tickets de caisse. Les photos restent sur ton téléphone, sauf si la lecture Gemini est activée.</Text>
          <Button label="Autoriser" icon="camera" onPress={requestPerm} style={st.stretch} />
          <Button label="Choisir une photo à la place" kind="quiet" icon="gallery" onPress={() => router.replace('/trip/new?scan=gallery')} style={st.stretch} />
        </View>
      </SafeAreaView>
    );
  }

  // Frame corners follow the logo's bubble: round corners, the bottom-left one sharp.
  const { w, h } = box;
  const R = bulle.hero.r, r = bulle.hero.tail, L = space.x3 + space.sm;
  return (
    <View style={st.screen}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />
      <SafeAreaView style={st.overlay}>
        <View style={st.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={st.round}>
            <Icon name="back" color={WHITE} />
          </Pressable>
          <Text style={st.title}>Scanner le ticket</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'Éteindre le flash' : 'Allumer le flash'} accessibilityState={{ selected: torch }} onPress={() => setTorch((x) => !x)} style={[st.round, torch && st.roundOn]}>
            <Icon name={torch ? 'flash' : 'flashOff'} color={torch ? brand.night : WHITE} weight={torch ? 'fill' : 'regular'} />
          </Pressable>
        </View>

        <View style={st.frame} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {w > 0 ? (
            <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
              {[
                `M3 ${L}V${R + 3}A${R} ${R} 0 0 1 ${R + 3} 3H${L}`,
                `M${w - L} 3H${w - R - 3}A${R} ${R} 0 0 1 ${w - 3} ${R + 3}V${L}`,
                `M${w - 3} ${h - L}V${h - R - 3}A${R} ${R} 0 0 1 ${w - R - 3} ${h - 3}H${w - L}`,
                `M${L} ${h - 3}H${r + 3}A${r} ${r} 0 0 1 3 ${h - r - 3}V${h - L}`,
              ].map((d) => <Path key={d} d={d} fill="none" stroke={WHITE} strokeWidth={4} strokeLinecap="round" />)}
            </Svg>
          ) : null}
        </View>

        <View style={st.hint}>
          <Text style={st.hintText}>{busy ? 'Photo prise…' : 'Tout le ticket dans le cadre, bien à plat et éclairé'}</Text>
        </View>

        <View style={st.bottom}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choisir une photo" onPress={() => router.replace('/trip/new?scan=gallery')} style={st.side}>
            <Icon name="gallery" color={WHITE} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Prendre la photo" accessibilityState={{ disabled: !ready || busy }} onPress={shoot} style={st.shutter}>
            {busy ? <ActivityIndicator color={brand.majorelle} /> : <View style={st.shutterIn} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Saisir à la main" onPress={() => router.replace('/trip/new')} style={st.side}>
            <Icon name="manual" color={WHITE} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = sheet(() => ({
  screen: { flex: 1, backgroundColor: brand.night },
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  askBox: { alignItems: 'center', gap: space.md, paddingHorizontal: space.section, alignSelf: 'stretch' },
  askTitle: { ...text('headlineSm'), color: colors.ink, textAlign: 'center' },
  askText: { ...text('bodySm'), color: colors.muted, textAlign: 'center', marginBottom: space.md },
  stretch: { alignSelf: 'stretch' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  title: { fontFamily: fonts.textSemi, fontSize: 16, lineHeight: 24, color: WHITE },
  round: { width: size.touch, height: size.touch, borderRadius: radius.pill, backgroundColor: GLASS, alignItems: 'center', justifyContent: 'center' },
  roundOn: { backgroundColor: WHITE },
  frame: { flex: 1, marginHorizontal: space.section, marginVertical: space.xxl },
  hint: { alignSelf: 'center', backgroundColor: GLASS, ...bubble('sm'), paddingHorizontal: space.lg, paddingVertical: space.sm, marginHorizontal: space.xxl },
  hintText: { fontFamily: fonts.textMedium, fontSize: 14, lineHeight: 20, color: WHITE, textAlign: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: space.xxl },
  side: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: GLASS, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 80, height: 80, ...bubble('hero'), backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 56, height: 56, ...bubble('lg'), backgroundColor: brand.majorelle },
}));
