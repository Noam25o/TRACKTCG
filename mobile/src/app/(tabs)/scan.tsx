import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScanResultSheet } from '@/components/ScanResultSheet';
import { ScannerFrame } from '@/components/ScannerFrame';
import { recognitionEngine, type ScannerState } from '@/services/recognition';
import { useCollection } from '@/state/CollectionContext';
import { colors, radii, spacing, typography } from '@/theme';
import type { CardCondition, CardFinish, ScanCandidate } from '@/types/card';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [torch, setTorch] = useState(false);
  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [candidate, setCandidate] = useState<ScanCandidate | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const { addCard } = useCollection();
  const scanGeneration = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setScannerState('framing');
      return () => {
        scanGeneration.current++;
        setFocused(false);
        setTorch(false);
        setCandidate(null);
      };
    }, []),
  );

  const runDevelopmentRecognition = async () => {
    if (scannerState === 'recognizing') return;
    setConfirmation(null);
    setScannerState('recognizing');
    const generation = ++scanGeneration.current;
    const candidates = await recognitionEngine.identifyFrame('development-frame');
    if (generation !== scanGeneration.current) return;
    setCandidate(candidates[0] ?? null);
    setScannerState(candidates[0] ? 'matched' : 'uncertain');
  };

  const addRecognizedCard = async (finish: CardFinish, condition: CardCondition) => {
    if (!candidate) return;
    await addCard({ card: candidate.card, finish, condition });
    setConfirmation(`${candidate.card.name} ajoutée à la collection`);
    setCandidate(null);
    setScannerState('framing');
  };

  if (!permission) {
    return <View style={styles.loading} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <View style={styles.permissionIcon}>
          <Ionicons color={colors.primary} name="camera-outline" size={34} />
        </View>
        <Text style={styles.permissionTitle}>Caméra nécessaire</Text>
        <Text style={styles.permissionText}>
          TRACKTCG utilise uniquement le flux vidéo pour reconnaître la carte. Aucune photo n’est enregistrée.
        </Text>
        <Pressable onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/catalog')} style={styles.testButton}><Text style={styles.testButtonText}>Chercher dans le catalogue sans caméra</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {focused ? (
        <CameraView
          animateShutter={false}
          enableTorch={torch}
          facing="back"
          onCameraReady={() => setScannerState('framing')}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.scrimTop} />
      <SafeAreaView edges={['top']} style={styles.overlay}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Scanner Pokémon</Text>
            <Text style={styles.headerSubtitle}>Aperçu caméra · reconnaissance en développement</Text>
          </View>
          <Pressable accessibilityLabel={torch ? 'Éteindre la lampe' : 'Allumer la lampe'} onPress={() => setTorch((value) => !value)} style={[styles.toolButton, torch && styles.toolButtonActive]}>
            <Ionicons color={torch ? colors.background : colors.white} name={torch ? 'flash' : 'flash-outline'} size={20} />
          </Pressable>
        </View>

        <View style={styles.frameArea}>
          <ScannerFrame state={scannerState} />
        </View>

        <View style={styles.developmentArea}>
          {confirmation ? (
            <View style={styles.confirmation}>
              <Ionicons color={colors.success} name="checkmark-circle" size={18} />
              <Text style={styles.confirmationText}>{confirmation}</Text>
            </View>
          ) : null}
          <View style={styles.devBadge}>
            <Ionicons color={colors.warning} name="construct-outline" size={14} />
            <Text style={styles.devBadgeText}>SCAN AUTOMATIQUE EN DÉVELOPPEMENT</Text>
          </View>
          <Pressable onPress={runDevelopmentRecognition} style={({ pressed }) => [styles.testButton, pressed && styles.pressed]}>
            <Ionicons color={colors.text} name="flask-outline" size={17} />
            <Text style={styles.testButtonText}>Tester le parcours avec un résultat local</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/catalog')} style={styles.testButton}>
            <Ionicons color={colors.primary} name="search" size={17} />
            <Text style={styles.testButtonText}>Rechercher ma carte dans le catalogue</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {candidate ? (
        <ScanResultSheet
          candidate={candidate}
          onAdd={addRecognizedCard}
          onDismiss={() => {
            setCandidate(null);
            setScannerState('framing');
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.black, flex: 1 },
  loading: { backgroundColor: colors.background, flex: 1 },
  scrimTop: { backgroundColor: 'rgba(3,7,10,0.62)', height: 140, left: 0, position: 'absolute', right: 0, top: 0 },
  overlay: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  headerTitle: { color: colors.white, fontSize: typography.section, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.66)', fontSize: typography.micro, marginTop: 3 },
  toolButton: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.22)', borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  toolButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  frameArea: { alignItems: 'center', flex: 1, justifyContent: 'center', marginBottom: 100 },
  developmentArea: { alignItems: 'center', bottom: 82, gap: spacing.sm, left: spacing.xl, position: 'absolute', right: spacing.xl },
  devBadge: { alignItems: 'center', backgroundColor: colors.overlay, borderRadius: radii.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  devBadgeText: { color: colors.warning, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  testButton: { alignItems: 'center', backgroundColor: colors.overlay, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: 11 },
  testButtonText: { color: colors.text, fontSize: typography.micro, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  confirmation: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  confirmationText: { color: colors.text, fontSize: typography.small, fontWeight: '700' },
  permissionScreen: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center', padding: spacing.xxxl },
  permissionIcon: { alignItems: 'center', backgroundColor: colors.primaryMuted, borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  permissionTitle: { color: colors.text, fontSize: typography.title, fontWeight: '800', marginTop: spacing.xl },
  permissionText: { color: colors.textMuted, fontSize: typography.body, lineHeight: 22, marginTop: spacing.md, textAlign: 'center' },
  permissionButton: { backgroundColor: colors.primary, borderRadius: radii.md, marginTop: spacing.xl, paddingHorizontal: spacing.xxl, paddingVertical: 14 },
  permissionButtonText: { color: colors.background, fontSize: typography.body, fontWeight: '800' },
});
