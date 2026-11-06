import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardRow } from '@/components/CardRow';
import { SectionHeader } from '@/components/SectionHeader';
import { cards, watchlistCards } from '@/data/cards';
import { colors, radii, spacing, typography } from '@/theme';

export default function MarketScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.title}>Marché</Text>
          <Text style={styles.subtitle}>Tendances et alertes Pokémon</Text>
        </View>

        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <Ionicons color={colors.warning} name="pulse" size={19} />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Prix de démonstration</Text>
            <Text style={styles.noticeText}>Les sources de marché seront branchées après validation de leurs licences.</Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader action="Gérer" title="Liste de suivi" />
          <View style={styles.listCard}>
            {watchlistCards.map((card) => <CardRow card={card} key={card.id} />)}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Plus fortes hausses" />
          <View style={styles.listCard}>
            {[...cards]
              .filter((card) => (card.dayChangePercent ?? 0) > 0)
              .sort((a, b) => (b.dayChangePercent ?? 0) - (a.dayChangePercent ?? 0))
              .slice(0, 4)
              .map((card) => <CardRow card={card} key={card.id} />)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xxl, padding: spacing.xl, paddingBottom: 110 },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: typography.small, marginTop: 4 },
  notice: { alignItems: 'center', backgroundColor: colors.warningMuted, borderColor: '#665126', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  noticeIcon: { alignItems: 'center', backgroundColor: 'rgba(246,197,94,0.12)', borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: colors.warning, fontSize: typography.small, fontWeight: '700' },
  noticeText: { color: '#CFBC8B', fontSize: typography.micro, lineHeight: 16, marginTop: 3 },
  section: { gap: spacing.md },
  listCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: spacing.lg },
});
