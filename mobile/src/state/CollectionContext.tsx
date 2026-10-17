import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { collectionTotals, createCollectionStore, type AddCardInput } from '@/services/collection-store';
import { colors, spacing } from '@/theme';
import type { CollectionEntry } from '@/types/card';

type CollectionContextValue = ReturnType<typeof collectionTotals> & {
  entries: CollectionEntry[];
  addCard: (input: AddCardInput) => Promise<void>;
};

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createCollectionStore(Storage));
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    store.load().then((saved) => {
      if (active) { setEntries(saved); setReady(true); }
    }).catch(() => {
      if (active) setError('Impossible de lire votre collection. La sauvegarde a été conservée sans modification.');
    });
    return () => { active = false; };
  }, [store, retry]);

  const addCard = useCallback(async (input: AddCardInput) => {
    const saved = await store.add(input);
    setEntries(saved);
  }, [store]);
  const value = useMemo<CollectionContextValue>(() => ({ entries, ...collectionTotals(entries), addCard }), [entries, addCard]);

  if (!ready) return (
    <View style={styles.loading}>
      {error ? <><Text style={styles.text}>{error}</Text><Pressable onPress={() => { setError(null); setRetry((n) => n + 1); }}><Text style={styles.retry}>Réessayer</Text></Pressable></>
        : <><ActivityIndicator color={colors.primary} /><Text style={styles.text}>Ouverture de votre collection…</Text></>}
    </View>
  );
  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  text: { color: colors.textMuted, textAlign: 'center' },
  retry: { color: colors.primary, padding: spacing.lg, fontWeight: '700' },
});

export function useCollection() {
  const value = useContext(CollectionContext);

  if (!value) {
    throw new Error('useCollection doit être utilisé dans CollectionProvider.');
  }

  return value;
}
