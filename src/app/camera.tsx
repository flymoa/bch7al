// The app's own receipt camera: a bubble-shaped frame over the live view, flash,
// gallery and file shortcuts. The photo goes to the trip screen, which reads it.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Icon } from '@/components/icon';
import { Alert } from '@/alert';
import { setPendingPhoto } from '@/scan';
import { bubble, colors, fonts, sheet, useTheme } from '@/theme';
import { radius, space, type } from '@/tokens';

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
      const pic = await cam.current.takePictureAsync({ quality: 0.85, shutterSound: false });
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
          <Icon name="camera-outline" size={type.h1} color={colors.blue} />
          <Text style={st.askTitle}>Autorise l'appareil photo</Text>
          <Text style={st.askText}>Pour lire tes tickets de caisse. Les photos restent sur ton téléphone, sauf si la lecture Gemini est activée.</Text>
          <Pressable accessibilityRole="button" onPress={requestPerm} style={st.askBtn}>
            <Text style={st.askBtnText}>Autoriser</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/trip/new?scan=gallery')} style={st.askLink}>
            <Text style={st.askLinkText}>Choisir une photo à la place</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Frame corners follow the logo's bubble: round corners, the bottom-left one tighter.
  const { w, h } = box;
  const R = radius.lg, r = radius.sm, L = space.xxxl;
  return (
    <View style={st.screen}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />
      <SafeAreaView style={st.overlay}>
        <View style={st.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={st.round}>
            <Icon name="chevron-back" size={24} color={colors.white} />
          </Pressable>
          <Text style={st.title}>Scanner le ticket</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torch ? 'Éteindre le flash' : 'Allumer le flash'}
            accessibilityState={{ selected: torch }}
            onPress={() => setTorch((x) => !x)}
            style={[st.round, torch && st.roundOn]}
          >
            <Icon name="flash" size={22} color={torch ? colors.night : colors.white} />
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
              ].map((d) => (
                <Path key={d} d={d} fill="none" stroke={colors.nightBlue} strokeWidth={5} strokeLinecap="round" />
              ))}
            </Svg>
          ) : null}
        </View>

        <View style={[st.hint, bubble(radius.lg)]}>
          <Text style={st.hintText}>{busy ? 'Je lis le ticket…' : 'Mets tout le ticket dans le cadre, bien à plat'}</Text>
        </View>

        <View style={st.bottom}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choisir une photo" onPress={() => router.replace('/trip/new?scan=gallery')} style={st.side}>
            <Icon name="images-outline" size={24} color={colors.white} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Prendre la photo" accessibilityState={{ disabled: !ready || busy }} onPress={shoot} style={st.shutter}>
            {busy ? <ActivityIndicator color={colors.white} /> : <View style={st.shutterIn} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Saisir à la main" onPress={() => router.replace('/trip/new')} style={st.side}>
            <Icon name="create-outline" size={22} color={colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = sheet(() => ({
  screen: { flex: 1, backgroundColor: colors.night },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  overlay: { flex: 1, paddingHorizontal: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm },
  round: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.nightSoft, alignItems: 'center', justifyContent: 'center' },
  roundOn: { backgroundColor: colors.white },
  title: { fontFamily: fonts.bodyBold, fontSize: type.bodyLg, color: colors.white },
  frame: { flex: 1, marginVertical: space.xl, marginHorizontal: space.xxl },
  hint: { alignSelf: 'center', backgroundColor: colors.nightSoft, paddingHorizontal: space.lg, paddingVertical: space.md },
  hintText: { fontFamily: fonts.bodyMedium, fontSize: type.body, color: colors.white },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.lg },
  side: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.nightSoft, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 80, height: 80, borderRadius: radius.pill, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.blue },
  askBox: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.md, maxWidth: 360 },
  askTitle: { fontFamily: fonts.titleBold, fontSize: type.title, color: colors.ink, textAlign: 'center' },
  askText: { fontFamily: fonts.body, fontSize: type.body, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  askBtn: { alignSelf: 'stretch', minHeight: 56, borderRadius: radius.pill, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  askBtnText: { fontFamily: fonts.title, fontSize: type.bodyLg, color: colors.white },
  askLink: { minHeight: 48, justifyContent: 'center' },
  askLinkText: { fontFamily: fonts.bodyBold, fontSize: type.body, color: colors.blue },
}));
