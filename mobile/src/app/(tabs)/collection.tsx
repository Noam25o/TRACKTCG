import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardRow } from '@/components/CardRow';
import { createCollectionSearch } from '@/services/pokemon-search';
import { useCollection } from '@/state/CollectionContext';
import { colors, radii, spacing, typography } from '@/theme';

const filters = ['Toutes', 'Normale', 'Holo', 'Reverse'] as const;

export default function CollectionScreen() {
  const { entries, totalCards, unpricedCards, demoCards } = useCollection();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]>('Toutes');

  const filteredEntries = useMemo(() => {
    const matchesQuery = createCollectionSearch(query);
    return entries.filter((entry) => {
      const matchesFilter = filter === 'Toutes' || entry.finish === filter;
      return matchesQuery(entry.card) && matchesFilter;
    });
  }, [entries, filter, query]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ma collection</Text>
          <Text style={styles.subtitle}>{totalCards} cartes · {unpricedCards} non cotées{demoCards ? ` · ${demoCards} démo` : ''}</Text>
        </View>
        <Pressable accessibilityLabel="Ajouter depuis le catalogue" onPress={() => router.push('/catalog')} style={styles.iconButton}>
          <Ionicons color={colors.primary} name="add" size={25} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons color={colors.textFaint} name="search" size={19} />
        <TextInput
          onChangeText={setQuery}
          placeholder="Nom français, extension ou numéro"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          value={query}
        />
        {query ? (
          <Pressable accessibilityLabel="Effacer la recherche" hitSlop={10} onPress={() => setQuery('')}>
            <Ionicons color={colors.textMuted} name="close-circle" size={18} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {filters.map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.filterChip, filter === item && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <View style={styles.listHeader}>
          <Text style={styles.count}>{filteredEntries.length} résultats</Text>
          <View style={styles.sortLine}>
            <Text style={styles.sortText}>Ajouts récents</Text>
          </View>
        </View>
        {filteredEntries.map((entry) => (
          <View key={entry.id} style={styles.rowBorder}>
            <CardRow card={entry.card} detail={`${entry.finish} · ${entry.condition} · ${entry.card.language}${entry.purchasePrice !== undefined ? ` · Achat ${entry.purchasePrice.toFixed(2)} €` : ''}`} quantity={entry.quantity} onPress={() => router.push({ pathname: '/card/[id]', params: { id: entry.card.id } })} />
          </View>
        ))}
        {filteredEntries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons color={colors.textFaint} name="search-outline" size={32} />
            <Text style={styles.emptyTitle}>Aucune carte trouvée</Text>
            <Text style={styles.emptyText}>{entries.length ? 'Modifiez la recherche ou les filtres.' : 'Ajoutez votre première carte depuis le catalogue.'}</Text>
            <Pressable onPress={() => router.push('/catalog')}><Text style={styles.catalogLink}>Ouvrir le catalogue</Text></Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: typography.small, marginTop: 4 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  searchBox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.xl, paddingHorizontal: spacing.md },
  searchInput: { color: colors.text, flex: 1, fontSize: typography.body, height: 48 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  filterChip: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: typography.small, fontWeight: '600' },
  filterTextActive: { color: colors.background },
  list: { paddingBottom: 110, paddingHorizontal: spacing.xl },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.sm },
  count: { color: colors.textFaint, fontSize: typography.micro, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  sortLine: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  sortText: { color: colors.textMuted, fontSize: typography.small },
  rowBorder: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: 70 },
  emptyTitle: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: typography.small },
  catalogLink: { color: colors.primary, fontSize: typography.body, fontWeight: '700', padding: spacing.lg },
});
