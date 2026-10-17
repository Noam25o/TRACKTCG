import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardArtwork } from '@/components/CardArtwork';
import { CATALOG_PAGE_SIZE, searchCatalog, type CatalogSummary, type SearchField } from '@/services/catalog';
import { resolvePokemonName } from '@/services/pokemon-search';
import { colors, radii, spacing, typography } from '@/theme';
import type { CardLanguage } from '@/types/card';

const fields: { value: SearchField; label: string; placeholder: string }[] = [
  { value: 'name', label: 'Nom', placeholder: 'Nom français : Dracaufeu, Évoli…' },
  { value: 'number', label: 'Numéro', placeholder: 'Numéro de la carte : 125…' },
  { value: 'set', label: 'Extension', placeholder: 'Flammes Obsidiennes…' },
];

export default function CatalogScreen() {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<CardLanguage>('FR');
  const [field, setField] = useState<SearchField>('name');
  const [items, setItems] = useState<CatalogSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [searched, setSearched] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const fetchingMore = useRef(false);
  const input = query.trim();
  const eligible = input.length >= (field === 'number' ? 1 : 2);
  const translated = field === 'name' ? resolvePokemonName(input, language) : null;
  const choices = translated && !translated.pokemon ? translated.candidates.slice(0, 6) : [];

  const changeSearch = (nextQuery = query, nextLanguage = language, nextField = field) => {
    generation.current++;
    controller.current?.abort();
    fetchingMore.current = false;
    setQuery(nextQuery); setLanguage(nextLanguage); setField(nextField);
    setItems([]); setPage(1); setHasMore(false); setError(null); setSearched(false);
    setBusy(nextQuery.trim().length >= (nextField === 'number' ? 1 : 2));
  };

  useEffect(() => {
    const current = ++generation.current;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    fetchingMore.current = false;
    if (!eligible) return () => request.abort();
    const timer = setTimeout(() => {
      searchCatalog(input, language, field, 1, request.signal).then((results) => {
        if (generation.current !== current || request.signal.aborted) return;
        setItems(results); setHasMore(results.length === CATALOG_PAGE_SIZE); setSearched(true);
      }).catch((reason: unknown) => {
        if (!request.signal.aborted && generation.current === current) setError(reason instanceof Error ? reason.message : 'Recherche indisponible.');
      }).finally(() => { if (!request.signal.aborted && generation.current === current) setBusy(false); });
    }, 400);
    return () => { clearTimeout(timer); request.abort(); controller.current?.abort(); };
  }, [eligible, input, language, field, retry]);

  const loadMore = async () => {
    if (busy || fetchingMore.current || !hasMore) return;
    fetchingMore.current = true;
    const current = generation.current;
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(null);
    try {
      const results = await searchCatalog(input, language, field, page + 1, request.signal);
      if (generation.current !== current || request.signal.aborted) return;
      setItems((previous) => [...previous, ...results.filter((item) => !previous.some((old) => old.id === item.id))]);
      setPage((n) => n + 1); setHasMore(results.length === CATALOG_PAGE_SIZE);
    } catch (reason) {
      if (!request.signal.aborted && generation.current === current) setError(reason instanceof Error ? reason.message : 'Recherche indisponible.');
    } finally {
      if (generation.current === current) { fetchingMore.current = false; setBusy(false); }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Text style={styles.intro}>Choisissez la langue des cartes. Les noms français fonctionnent aussi en anglais et en japonais.</Text>
        <View style={styles.chips}>{(['FR', 'EN', 'JP'] as CardLanguage[]).map((value) => (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: language === value }} key={value} onPress={() => { if (value !== language) changeSearch(query, value); }} style={[styles.chip, language === value && styles.active]}>
            <Text style={[styles.chipText, language === value && styles.activeText]}>{value === 'JP' ? 'Japonais' : value === 'FR' ? 'Français' : 'Anglais'}</Text>
          </Pressable>
        ))}</View>
        <View style={styles.search}>
          <Ionicons name="search" color={colors.primary} size={20} />
          <TextInput accessibilityLabel="Rechercher dans le catalogue" autoCapitalize="none" autoCorrect={false} value={query} onChangeText={(value) => { if (value.trim() === query.trim()) setQuery(value); else changeSearch(value); }} style={styles.input} placeholder={fields.find((item) => item.value === field)?.placeholder} placeholderTextColor={colors.textFaint} returnKeyType="search" />
          {query ? <Pressable accessibilityLabel="Effacer" onPress={() => changeSearch('')} hitSlop={10}><Ionicons name="close-circle" color={colors.textMuted} size={20} /></Pressable> : null}
        </View>
        {translated?.pokemon && language !== 'FR' ? <Text style={styles.translation}>Recherche : {translated.pokemon.FR} → {translated.query}</Text> : null}
        {choices.length ? <View style={styles.suggestions}>
          <Text style={styles.source}>Précisez le Pokémon :{translated && translated.candidates.length > 6 ? ` ${translated.candidates.length} noms possibles` : ''}</Text>
          <View style={styles.suggestionChoices}>{choices.map((item) => <Pressable key={item.dexId} accessibilityRole="button" accessibilityLabel={`Rechercher ${item.FR}`} onPress={() => changeSearch(item.FR)} style={styles.suggestion}>
            <Text style={styles.chipText}>{item.FR}</Text>
          </Pressable>)}</View>
        </View> : null}
        <View style={styles.chips}>{fields.map((item) => (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: field === item.value }} key={item.value} onPress={() => { if (item.value !== field) changeSearch(query, language, item.value); }} style={[styles.chip, field === item.value && styles.fieldActive]}>
            <Text style={styles.chipText}>{item.label}</Text>
          </Pressable>
        ))}</View>
        <Text style={styles.source}>Catalogue TCGdex · Noms Pokémon : PokéAPI · Internet requis</Text>
        {field !== 'name' ? <Text style={styles.source}>Numéros et noms d’extensions : recherche dans la langue choisie, sans traduction.</Text> : null}
      </View>
      <FlatList
        data={items} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/card/[id]', params: { id: item.id } })} style={styles.row}>
            <CardArtwork size="small" card={{ ...item, setName: item.setCode, rarity: '', marketPrice: null, dayChangePercent: null, accent: ['#215B48', '#172D41'], symbol: '◇' }} />
            <View style={styles.copy}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.setCode.toUpperCase()} · {item.number} · {item.language}</Text></View>
            <Ionicons name="chevron-forward" color={colors.textMuted} size={18} />
          </Pressable>
        )}
        ListEmptyComponent={!busy && !error ? <View style={styles.empty}><Ionicons name="albums-outline" color={colors.primary} size={38} /><Text style={styles.name}>{searched ? 'Aucune carte trouvée' : 'Explorez le catalogue Pokémon'}</Text><Text style={styles.meta}>{searched ? 'Essayez un autre nom ou une autre langue.' : 'Saisissez un nom, un numéro ou une extension.'}</Text></View> : null}
        ListFooterComponent={<View style={styles.footer}>
          {busy ? <ActivityIndicator color={colors.primary} /> : null}
          {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable onPress={() => { if (items.length) void loadMore(); else { changeSearch(); setRetry((n) => n + 1); } }} style={styles.button}><Text style={styles.activeText}>Réessayer</Text></Pressable></> : null}
          {!busy && !error && hasMore ? <Pressable onPress={loadMore} style={styles.button}><Text style={styles.activeText}>Voir plus de cartes</Text></Pressable> : null}
          {items.length ? <Text style={styles.source}>{items.length} cartes affichées</Text> : null}
        </View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  controls: { padding: spacing.xl, gap: spacing.md },
  intro: { color: colors.textMuted, fontSize: typography.body },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  fieldActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { color: colors.text, fontSize: typography.small, fontWeight: '600' },
  activeText: { color: colors.background, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, height: 50, color: colors.text, fontSize: typography.body },
  source: { color: colors.textFaint, fontSize: typography.micro },
  translation: { color: colors.primary, fontSize: typography.small },
  suggestions: { gap: spacing.sm },
  suggestionChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  suggestion: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: radii.md, backgroundColor: colors.primaryMuted },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, gap: 6 },
  name: { color: colors.text, fontWeight: '700', fontSize: typography.body },
  meta: { color: colors.textMuted, fontSize: typography.small, textAlign: 'left' },
  empty: { paddingVertical: 55, alignItems: 'center', gap: spacing.md },
  footer: { gap: spacing.md, alignItems: 'center', paddingVertical: spacing.xl },
  button: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg },
  error: { color: colors.danger, textAlign: 'center' },
});
