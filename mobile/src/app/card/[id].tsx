import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AddToCollectionForm } from '@/components/AddToCollectionForm';
import { CardArtwork } from '@/components/CardArtwork';
import { cards } from '@/data/cards';
import { getCatalogCard, parseCatalogId } from '@/services/catalog';
import { useCollection } from '@/state/CollectionContext';
import { colors, radii, spacing, typography } from '@/theme';
import type { TcgCard } from '@/types/card';

export default function CardDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CardDetails key={id} id={id} />;
}

function CardDetails({ id }: { id: string }) {
  const { entries } = useCollection();
  const savedCard = entries.find((entry) => entry.card.id === id)?.card;
  const localCard = savedCard ?? cards.find((item) => item.id === id);
  const [remoteCard, setRemoteCard] = useState<TcgCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(() => !!parseCatalogId(id));
  const [retry, setRetry] = useState(0);
  const card = remoteCard?.id === id ? remoteCard : localCard;

  useEffect(() => {
    const request = new AbortController();
    if (!parseCatalogId(id)) return;
    getCatalogCard(id, request.signal).then((result) => {
      if (!request.signal.aborted) setRemoteCard(result);
    }).catch((reason: unknown) => {
      if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : 'Fiche indisponible.');
    }).finally(() => { if (!request.signal.aborted) setBusy(false); });
    return () => request.abort();
  }, [id, retry]);

  if (!card) return <View style={styles.message}>
    {busy ? <ActivityIndicator color={colors.primary} /> : null}
    <Text style={styles.meta}>{busy ? 'Chargement de la fiche…' : error ?? 'Carte introuvable.'}</Text>
    {!busy && parseCatalogId(id) ? <Pressable onPress={() => { setBusy(true); setError(null); setRetry((n) => n + 1); }}><Text style={styles.retry}>Réessayer</Text></Pressable> : null}
  </View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} style={styles.container}>
      {error && savedCard ? <Text style={styles.meta}>Fiche enregistrée sur ce téléphone · actualisation indisponible.</Text> : null}
      <View style={styles.artworkArea}>
        <CardArtwork card={card} size="large" />
      </View>
      <Text style={styles.name}>{card.name}</Text>
      <Text style={styles.meta}>{card.setName} · {card.number} · {card.language}</Text>
      <View style={styles.priceCard}>
        <View>
          <Text style={styles.label}>{card.source === 'tcgdex' ? 'Valeur de marché' : 'Prix de démonstration'}</Text>
          <Text style={styles.price}>{card.marketPrice === null ? 'Non disponible' : `${card.marketPrice.toFixed(2).replace('.', ',')} €`}</Text>
          {card.marketPrice === null ? <Text style={styles.meta}>Cette carte n’est pas encore cotée dans TRACKTCG.</Text> : null}
        </View>
      </View>
      <View style={styles.detailsCard}>
        <Detail label="Rareté" value={card.rarity} />
        <Detail label="Numéro" value={card.number} />
        <Detail label="Langue" value={card.language} />
        <Detail label="Source" value={card.source === 'tcgdex' ? 'TCGdex' : 'Démonstration'} last />
      </View>
      <AddToCollectionForm key={card.id} card={card} />
      <Text style={styles.attribution}>Métadonnées : TCGdex. Images : TCGdex, Malie, Pokémon officiel ou TCGplayer JP (liens P-Collector), selon disponibilité. Images et marques Pokémon : leurs ayants droit respectifs. Certaines fiches n’ont pas encore d’image.</Text>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Detail({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background },
  message: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  retry: { color: colors.primary, padding: spacing.lg, fontWeight: '700' },
  attribution: { color: colors.textFaint, fontSize: typography.micro, lineHeight: 17, marginTop: spacing.xl },
  content: { padding: spacing.xl, paddingBottom: 60 },
  artworkArea: { alignItems: 'center', paddingVertical: spacing.xxl },
  name: { color: colors.text, fontSize: typography.title, fontWeight: '800', textAlign: 'center' },
  meta: { color: colors.textMuted, fontSize: typography.small, marginTop: spacing.sm, textAlign: 'center' },
  priceCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl, padding: spacing.lg },
  label: { color: colors.textMuted, fontSize: typography.small },
  price: { color: colors.text, fontSize: typography.title, fontWeight: '800', marginTop: 3 },
  change: { alignItems: 'center', backgroundColor: colors.primaryMuted, borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  changeText: { color: colors.success, fontSize: typography.small, fontWeight: '700' },
  detailsCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  detailRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.lg },
  detailBorder: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { color: colors.textMuted, fontSize: typography.small },
  detailValue: { color: colors.text, fontSize: typography.small, fontWeight: '700' },
});
