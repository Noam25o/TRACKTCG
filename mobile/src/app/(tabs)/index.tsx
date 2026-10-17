import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardRow } from '@/components/CardRow';
import { SectionHeader } from '@/components/SectionHeader';
import { useCollection } from '@/state/CollectionContext';
import { colors, radii, spacing, typography } from '@/theme';

export default function HomeScreen() {
  const { entries, investedValue, totalCards, unpricedCards, demoCards } = useCollection();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>BON RETOUR</Text>
            <Text style={styles.brand}>TRACK<Text style={styles.brandAccent}>TCG</Text></Text>
          </View>
          <Pressable accessibilityLabel="Ouvrir le catalogue" onPress={() => router.push('/catalog')} style={styles.iconButton}>
            <Ionicons color={colors.text} name="search" size={21} />
          </Pressable>
        </View>

        <LinearGradient colors={['#173D32', '#132735', '#151C24']} style={styles.portfolioCard}>
          <View style={styles.portfolioHeader}>
            <View>
              <Text style={styles.portfolioLabel}>Valeur de la collection</Text>
              <Text style={styles.portfolioValue}>
                À estimer
              </Text>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LOCAL</Text>
            </View>
          </View>
          <View style={styles.gainLine}>
            <Text style={styles.gainPeriod}>Les prix réels et leur historique arrivent prochainement.</Text>
          </View>
          <View style={styles.portfolioFooter}>
            <View>
              <Text style={styles.footerLabel}>Cartes</Text>
              <Text style={styles.footerValue}>{totalCards}</Text>
            </View>
            <View style={styles.footerDivider} />
            <View>
              <Text style={styles.footerLabel}>Achats renseignés</Text>
              <Text style={styles.footerValue}>{investedValue.toFixed(2).replace('.', ',')} €</Text>
            </View>
            <View style={styles.footerDivider} />
            <View>
              <Text style={styles.footerLabel}>TCG</Text>
              <Text style={styles.footerValue}>Pokémon</Text>
            </View>
          </View>
        </LinearGradient>

        <Link href="/scan" asChild>
          <Pressable style={({ pressed }) => [styles.scanCta, pressed && styles.pressed]}>
            <View style={styles.scanCtaIcon}>
              <Ionicons color={colors.background} name="scan" size={26} />
            </View>
            <View style={styles.scanCtaCopy}>
              <Text style={styles.scanCtaTitle}>Scanner une carte</Text>
              <Text style={styles.scanCtaText}>Aperçu caméra · reconnaissance en développement</Text>
            </View>
            <Ionicons color={colors.primary} name="chevron-forward" size={20} />
          </Pressable>
        </Link>

        <Link href="/catalog" asChild>
          <Pressable style={({ pressed }) => [styles.scanCta, pressed && styles.pressed]}>
            <View style={styles.scanCtaIcon}><Ionicons color={colors.background} name="albums-outline" size={25} /></View>
            <View style={styles.scanCtaCopy}><Text style={styles.scanCtaTitle}>Explorer le catalogue</Text><Text style={styles.scanCtaText}>Cartes réelles · français, anglais, japonais</Text></View>
            <Ionicons color={colors.primary} name="chevron-forward" size={20} />
          </Pressable>
        </Link>

        <View style={styles.section}>
          <SectionHeader title="Derniers ajouts" />
          <View style={styles.list}>
            {entries
              .slice(0, 3)
              .map((entry) => (
                <CardRow
                  card={entry.card}
                  detail={`${entry.finish} · ${entry.condition}`}
                  key={entry.id}
                  quantity={entry.quantity}
                  onPress={() => router.push({ pathname: '/card/[id]', params: { id: entry.card.id } })}
                />
              ))}
            {!entries.length ? <Text style={{ color: colors.textMuted, paddingVertical: spacing.xl }}>Votre collection commence ici. Cherchez votre première carte dans le catalogue.</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Votre collection locale" />
          <View style={styles.insightsRow}>
            <View style={styles.insightCard}>
              <View style={[styles.insightIcon, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons color={colors.primary} name="arrow-up" size={18} />
              </View>
              <Text style={styles.insightValue}>{unpricedCards}</Text>
              <Text style={styles.insightLabel}>Cartes en attente de prix</Text>
            </View>
            <View style={styles.insightCard}>
              <View style={[styles.insightIcon, { backgroundColor: colors.blueMuted }]}>
                <Ionicons color={colors.blue} name="eye-outline" size={18} />
              </View>
              <Text style={styles.insightValue}>{demoCards}</Text>
              <Text style={styles.insightLabel}>Exemples de démonstration</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xxl, padding: spacing.xl, paddingBottom: 110 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.textFaint, fontSize: typography.micro, fontWeight: '700', letterSpacing: 1.5 },
  brand: { color: colors.text, fontSize: typography.title, fontWeight: '800', letterSpacing: -1 },
  brandAccent: { color: colors.primary },
  iconButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  notificationDot: { backgroundColor: colors.primary, borderColor: colors.surface, borderRadius: 4, borderWidth: 2, height: 8, position: 'absolute', right: 8, top: 7, width: 8 },
  portfolioCard: { borderColor: '#275143', borderRadius: radii.xl, borderWidth: 1, gap: spacing.lg, overflow: 'hidden', padding: spacing.xl },
  portfolioHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  portfolioLabel: { color: '#A8BDB5', fontSize: typography.small },
  portfolioValue: { color: colors.white, fontSize: typography.hero, fontWeight: '800', letterSpacing: -1.5, marginTop: 3 },
  liveBadge: { alignItems: 'center', backgroundColor: 'rgba(98,227,162,0.12)', borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { backgroundColor: colors.primary, borderRadius: 3, height: 6, width: 6 },
  liveText: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  gainLine: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  gainValue: { fontSize: typography.small, fontWeight: '700' },
  gainPeriod: { color: colors.textMuted, fontSize: typography.small },
  sparkline: { alignItems: 'flex-end', flexDirection: 'row', gap: 5, height: 88, overflow: 'hidden' },
  sparkBar: { backgroundColor: 'rgba(98,227,162,0.38)', borderRadius: 3, flex: 1, minHeight: 8 },
  portfolioFooter: { alignItems: 'center', borderTopColor: 'rgba(255,255,255,0.08)', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.lg },
  footerLabel: { color: colors.textMuted, fontSize: typography.micro },
  footerValue: { color: colors.text, fontSize: typography.small, fontWeight: '700', marginTop: 3 },
  footerDivider: { backgroundColor: 'rgba(255,255,255,0.09)', height: 28, width: 1 },
  scanCta: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  pressed: { opacity: 0.72 },
  scanCtaIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 18, height: 48, justifyContent: 'center', width: 48 },
  scanCtaCopy: { flex: 1 },
  scanCtaTitle: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  scanCtaText: { color: colors.textMuted, fontSize: typography.small, marginTop: 3 },
  section: { gap: spacing.md },
  list: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: spacing.lg },
  insightsRow: { flexDirection: 'row', gap: spacing.md },
  insightCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flex: 1, gap: spacing.sm, padding: spacing.lg },
  insightIcon: { alignItems: 'center', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  insightValue: { color: colors.text, fontSize: typography.section, fontWeight: '800' },
  insightLabel: { color: colors.textMuted, fontSize: typography.micro },
});
