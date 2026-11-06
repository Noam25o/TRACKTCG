import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';
import type { ScannerState } from '@/services/recognition';

const labels: Record<ScannerState, string> = {
  idle: 'Initialisation de la caméra…',
  framing: 'Placez la carte dans le cadre',
  stable: 'Carte stable · analyse prête',
  recognizing: 'Chargement de l’exemple…',
  matched: 'Exemple de démonstration',
  uncertain: 'Confirmation nécessaire',
};

export function ScannerFrame({ state }: { state: ScannerState }) {
  const active = state === 'stable' || state === 'recognizing';
  const success = state === 'matched';
  const color = success ? colors.success : active ? colors.primary : colors.white;

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <View style={styles.frame}>
        <View style={[styles.corner, styles.topLeft, { borderColor: color }]} />
        <View style={[styles.corner, styles.topRight, { borderColor: color }]} />
        <View style={[styles.corner, styles.bottomLeft, { borderColor: color }]} />
        <View style={[styles.corner, styles.bottomRight, { borderColor: color }]} />
        {state === 'recognizing' ? <View style={styles.scanLine} /> : null}
      </View>
      <View style={styles.statusPill}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={styles.statusText}>{labels[state]}</Text>
      </View>
      <Text style={styles.helper}>Montrez les quatre coins · évitez les reflets</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  frame: { aspectRatio: 0.715, position: 'relative', width: 274 },
  corner: { height: 42, position: 'absolute', width: 42 },
  topLeft: { borderLeftWidth: 4, borderTopLeftRadius: radii.md, borderTopWidth: 4, left: 0, top: 0 },
  topRight: { borderRightWidth: 4, borderTopRightRadius: radii.md, borderTopWidth: 4, right: 0, top: 0 },
  bottomLeft: { borderBottomLeftRadius: radii.md, borderBottomWidth: 4, borderLeftWidth: 4, bottom: 0, left: 0 },
  bottomRight: { borderBottomRightRadius: radii.md, borderBottomWidth: 4, borderRightWidth: 4, bottom: 0, right: 0 },
  scanLine: { backgroundColor: colors.primary, height: 2, left: 12, opacity: 0.85, position: 'absolute', right: 12, top: '49%' },
  statusPill: { alignItems: 'center', backgroundColor: colors.overlay, borderColor: 'rgba(255,255,255,0.16)', borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, paddingHorizontal: spacing.md, paddingVertical: 9 },
  statusDot: { borderRadius: 4, height: 8, width: 8 },
  statusText: { color: colors.white, fontSize: typography.small, fontWeight: '700' },
  helper: { color: 'rgba(255,255,255,0.66)', fontSize: typography.micro, marginTop: spacing.sm },
});
