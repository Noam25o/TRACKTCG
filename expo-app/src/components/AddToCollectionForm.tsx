import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useCollection } from '@/state/CollectionContext';
import { colors, radii, spacing, typography } from '@/theme';
import type { CardCondition, CardFinish, TcgCard } from '@/types/card';

const conditionLabels: Record<CardCondition, string> = { NM: 'Proche du neuf', EX: 'Excellent', GD: 'Bon', LP: 'Légèrement joué', PL: 'Joué' };

export function AddToCollectionForm({ card }: { card: TcgCard }) {
  const finishes: CardFinish[] = card.finishes?.length ? card.finishes : ['Normale', 'Holo', 'Reverse'];
  const [finish, setFinish] = useState<CardFinish>(finishes[0]);
  const [condition, setCondition] = useState<CardCondition>('NM');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const { addCard } = useCollection();

  const save = async () => {
    if (saving.current) return;
    setMessage(null); setError(null);
    const normalized = cost.trim().replace(',', '.');
    if (normalized && (!/^\d+(\.\d{1,2})?$/.test(normalized) || !Number.isFinite(Number(normalized)))) {
      setError('Saisissez un prix positif, avec au maximum deux décimales.');
      return;
    }
    saving.current = true; setBusy(true);
    try {
      await addCard({ card, finish, condition, purchasePrice: normalized ? Number(normalized) : undefined });
      setMessage('Un exemplaire ajouté et sauvegardé sur ce téléphone.');
    } catch {
      setError('Enregistrement impossible. Votre ajout n’a pas été sauvegardé. Réessayez.');
    } finally { saving.current = false; setBusy(false); }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Ajouter un exemplaire</Text>
      <Text style={styles.label}>Finition</Text>
      <View style={styles.row}>{finishes.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item === finish }} disabled={busy} key={item} onPress={() => { setFinish(item); setMessage(null); }} style={[styles.option, finish === item && styles.active]}><Text style={[styles.optionText, finish === item && styles.activeText]}>{item}</Text></Pressable>)}</View>
      {!card.finishes?.length ? <Text style={styles.note}>Finitions non renseignées par le catalogue : vérifiez votre carte.</Text> : null}
      <Text style={styles.label}>État : {conditionLabels[condition]}</Text>
      <View style={styles.row}>{(Object.keys(conditionLabels) as CardCondition[]).map((item) => <Pressable accessibilityLabel={conditionLabels[item]} accessibilityRole="button" accessibilityState={{ selected: item === condition }} disabled={busy} key={item} onPress={() => { setCondition(item); setMessage(null); }} style={[styles.option, condition === item && styles.active]}><Text style={[styles.optionText, condition === item && styles.activeText]}>{item}</Text></Pressable>)}</View>
      <Text style={styles.label}>Prix d’achat unitaire en € · facultatif</Text>
      <TextInput accessibilityLabel="Prix d’achat en euros" editable={!busy} keyboardType="decimal-pad" value={cost} onChangeText={(value) => { setCost(value); setMessage(null); }} placeholder="Ex. 12,50" placeholderTextColor={colors.textFaint} style={styles.input} maxLength={12} />
      <Text style={styles.note}>Langue : {card.language}. Pour une autre langue, choisissez sa fiche dans le catalogue.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={save} style={[styles.button, busy && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.background} /> : <Ionicons name="add" color={colors.background} size={20} />}
        <Text style={styles.activeText}>{busy ? 'Enregistrement…' : message ? 'Ajouter un autre exemplaire' : 'Ajouter à ma collection'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: spacing.xl, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  title: { fontSize: typography.section, color: colors.text, fontWeight: '700' },
  label: { fontSize: typography.small, color: colors.textMuted, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  option: { flexGrow: 1, alignItems: 'center', padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: radii.pill },
  optionText: { color: colors.text, fontSize: typography.small },
  active: { backgroundColor: colors.primary },
  activeText: { color: colors.background, fontWeight: '700', fontSize: typography.small },
  input: { borderRadius: radii.md, backgroundColor: colors.surfaceElevated, color: colors.text, padding: 14, fontSize: typography.body },
  note: { fontSize: typography.micro, color: colors.textMuted, lineHeight: 17 },
  error: { color: colors.danger, fontSize: typography.small },
  success: { color: colors.success, fontSize: typography.small },
  button: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radii.md },
  disabled: { opacity: 0.6 },
});
