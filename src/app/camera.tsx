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
import { bubble, fonts } from '@/theme';

const DARK = '#0B0C26';
const LILAC = '#8F8CFF';

export default function Camera() {
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
      const pic = await cam.current.takePictureAsync({ quality: 0.85, base64: true });
      setPendingPhoto({ uri: pic.uri, base64: pic.base64, mimeType: 'image/jpeg' });
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
          <Icon name="camera-outline" size={34} color="#3D3BD9" />
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
  const R = 30, r = 10, L = 58;
  return (
    <View style={st.screen}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />
      <SafeAreaView style={st.overlay}>
        <View style={st.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={st.round}>
            <Icon name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={st.title}>Scanner le ticket</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torch ? 'Éteindre le flash' : 'Allumer le flash'}
            accessibilityState={{ selected: torch }}
            onPress={() => setTorch((x) => !x)}
            style={[st.round, torch && st.roundOn]}
          >
            <Icon name="flash" size={22} color={torch ? DARK : '#FFFFFF'} />
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
                <Path key={d} d={d} fill="none" stroke={LILAC} strokeWidth={5} strokeLinecap="round" />
              ))}
            </Svg>
          ) : null}
        </View>

        <View style={[st.hint, bubble(20)]}>
          <Text style={st.hintText}>{busy ? 'Je lis le ticket…' : 'Mets tout le ticket dans le cadre, bien à plat'}</Text>
        </View>

        <View style={st.bottom}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choisir une photo" onPress={() => router.replace('/trip/new?scan=gallery')} style={st.side}>
            <Icon name="images-outline" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Prendre la photo" accessibilityState={{ disabled: !ready || busy }} onPress={shoot} style={st.shutter}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <View style={st.shutterIn} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Saisir à la main" onPress={() => router.replace('/trip/new')} style={st.side}>
            <Icon name="create-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DARK },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlay: { flex: 1, paddingHorizontal: 20 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(11,12,38,0.55)', alignItems: 'center', justifyContent: 'center' },
  roundOn: { backgroundColor: '#FFFFFF' },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#FFFFFF' },
  frame: { flex: 1, marginVertical: 22, marginHorizontal: 30 },
  hint: { alignSelf: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10 },
  hintText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: '#12133D' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 18 },
  side: { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(11,12,38,0.55)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3D3BD9' },
  askBox: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, alignItems: 'center', gap: 10, maxWidth: 360 },
  askTitle: { fontFamily: fonts.titleBold, fontSize: 20, color: '#12133D', textAlign: 'center' },
  askText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: '#4A4C7A', textAlign: 'center' },
  askBtn: { alignSelf: 'stretch', minHeight: 54, borderRadius: 27, backgroundColor: '#3D3BD9', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  askBtnText: { fontFamily: fonts.title, fontSize: 17, color: '#FFFFFF' },
  askLink: { minHeight: 44, justifyContent: 'center' },
  askLinkText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#3D3BD9' },
});
