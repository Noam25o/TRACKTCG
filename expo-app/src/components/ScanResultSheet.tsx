import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CardArtwork } from '@/components/CardArtwork';
import { colors, radii, spacing, typography } from '@/theme';
import type { CardCondition, CardFinish, ScanCandidate } from '@/types/card';

const finishes: CardFinish[] = ['Normale', 'Holo', 'Reverse'];
const conditions: CardCondition[] = ['NM', 'EX', 'GD', 'LP', 'PL'];

export function ScanResultSheet({ candidate, onAdd, onDismiss }: {
  candidate: ScanCandidate;
  onAdd: (finish: CardFinish, condition: CardCondition) => Promise<void>;
  onDismiss: () => void;
}) {
  const [finish, setFinish] = useState<CardFinish>('Holo');
  const [condition, setCondition] = useState<CardCondition>('NM');
  const { card } = candidate;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const save = async () => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try { await onAdd(finish, condition); }
    catch { setError('Enregistrement impossible. Réessayez.'); }
    finally { saving.current = false; setBusy(false); }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.heading}>
        <View style={styles.successIcon}>
          <Ionicons color={colors.background} name="checkmark" size={19} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>RÉSULTAT DE DÉMONSTRATION</Text>
          <Text style={styles.confidence}>Carte et prix simulés · aucune identification réelle</Text>
        </View>
        <Pressable accessibilityLabel="Fermer le résultat" disabled={busy} hitSlop={10} onPress={onDismiss}>
          <Ionicons color={colors.textMuted} name="close" size={23} />
        </Pressable>
      </View>

      <View style={styles.cardLine}>
        <CardArtwork card={card} size="medium" />
        <View style={styles.cardCopy}>
          <Text style={styles.cardName}>{card.name}</Text>
          <Text style={styles.cardMeta}>{card.setName}</Text>
          <Text style={styles.cardMeta}>{card.number} · {card.language} · {card.rarity}</Text>
          <Text style={styles.price}>{card.marketPrice?.toFixed(2).replace('.', ',')} € · démo</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Finition</Text>
      <View style={styles.optionRow}>
        {finishes.map((item) => (
          <Pressable key={item} onPress={() => setFinish(item)} style={[styles.option, finish === item && styles.optionActive]}>
            <Text style={[styles.optionText, finish === item && styles.optionTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>État</Text>
      <View style={styles.optionRow}>
        {conditions.map((item) => (
          <Pressable key={item} onPress={() => setCondition(item)} style={[styles.condition, condition === item && styles.optionActive]}>
            <Text style={[styles.optionText, condition === item && styles.optionTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={{ color: colors.danger, marginTop: spacing.sm }}>{error}</Text> : null}
      <Pressable disabled={busy} onPress={save} style={({ pressed }) => [styles.addButton, (pressed || busy) && styles.pressed]}>
        <Ionicons color={colors.background} name="add" size={21} />
        <Text style={styles.addButtonText}>{busy ? 'Enregistrement…' : 'Ajouter cet exemple à ma collection'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, bottom: 0, left: 0, padding: spacing.xl, paddingBottom: 92, position: 'absolute', right: 0 },
  handle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 2, height: 4, marginBottom: spacing.lg, width: 42 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  successIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  confidence: { color: colors.textMuted, fontSize: typography.micro, marginTop: 2 },
  cardLine: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, marginVertical: spacing.lg },
  cardCopy: { flex: 1, gap: 4 },
  cardName: { color: colors.text, fontSize: typography.section, fontWeight: '800' },
  cardMeta: { color: colors.textMuted, fontSize: typography.small },
  price: { color: colors.primary, fontSize: typography.section, fontWeight: '800', marginTop: 4 },
  fieldLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.sm, textTransform: 'uppercase' },
  optionRow: { flexDirection: 'row', gap: spacing.sm },
  option: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flex: 1, paddingVertical: 9 },
  condition: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flex: 1, paddingVertical: 9 },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.textMuted, fontSize: typography.micro, fontWeight: '700' },
  optionTextActive: { color: colors.background },
  addButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.xl, paddingVertical: 14 },
  addButtonText: { color: colors.background, fontSize: typography.body, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
