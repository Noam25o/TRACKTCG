import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { firebaseConfigured } from '@/services/firebase';
import { colors, radii, spacing, typography } from '@/theme';

const settings = [
  { icon: 'language-outline' as const, title: 'Langues des cartes', value: 'FR · EN · JP' },
  { icon: 'cash-outline' as const, title: 'Devise', value: 'EUR' },
  { icon: 'cloud-offline-outline' as const, title: 'Collection hors ligne', value: 'Sur cet appareil' },
  { icon: 'shield-checkmark-outline' as const, title: 'Confidentialité', value: 'Frames non stockées' },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.title}>Profil</Text>
          <Text style={styles.subtitle}>Préférences et synchronisation</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>N</Text></View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>Collectionneur local</Text>
            <Text style={styles.profileMeta}>Mode développement</Text>
          </View>
          <Ionicons color={colors.textFaint} name="chevron-forward" size={18} />
        </View>

        <View style={styles.syncCard}>
          <View style={[styles.statusDot, { backgroundColor: firebaseConfigured ? colors.success : colors.warning }]} />
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>{firebaseConfigured ? 'Firebase configuré' : 'Firebase en attente'}</Text>
            <Text style={styles.syncText}>
              {firebaseConfigured ? 'Configuration présente ; synchronisation à implémenter.' : 'Votre collection est sauvegardée sur ce téléphone. La connexion Expo ne crée pas encore de compte TRACKTCG.'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Réglages</Text>
          <View style={styles.settingsCard}>
            {settings.map((setting, index) => (
              <Pressable key={setting.title} style={[styles.settingRow, index < settings.length - 1 && styles.settingBorder]}>
                <View style={styles.settingIcon}>
                  <Ionicons color={colors.primary} name={setting.icon} size={19} />
                </View>
                <Text style={styles.settingTitle}>{setting.title}</Text>
                <Text style={styles.settingValue}>{setting.value}</Text>
                <Ionicons color={colors.textFaint} name="chevron-forward" size={16} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.openSourceCard}>
          <Ionicons color={colors.primary} name="code-slash" size={22} />
          <View style={styles.openSourceCopy}>
            <Text style={styles.openSourceTitle}>Moteur open source</Text>
            <Text style={styles.openSourceText}>Le scanner sera auditable, auto-hébergeable et sans coût par scan.</Text>
          </View>
        </View>

        <Text style={styles.version}>TRACKTCG · V1 locale</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.xxl, padding: spacing.xl, paddingBottom: 110 },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: typography.small, marginTop: 4 },
  profileCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  avatar: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 23, height: 46, justifyContent: 'center', width: 46 },
  avatarText: { color: colors.background, fontSize: typography.section, fontWeight: '800' },
  profileCopy: { flex: 1 },
  profileName: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  profileMeta: { color: colors.textMuted, fontSize: typography.small, marginTop: 3 },
  syncCard: { alignItems: 'flex-start', backgroundColor: colors.surfaceElevated, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  statusDot: { borderRadius: 5, height: 10, marginTop: 4, width: 10 },
  syncCopy: { flex: 1 },
  syncTitle: { color: colors.text, fontSize: typography.small, fontWeight: '700' },
  syncText: { color: colors.textMuted, fontSize: typography.micro, lineHeight: 16, marginTop: 4 },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: typography.section, fontWeight: '700' },
  settingsCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: spacing.lg },
  settingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  settingBorder: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  settingIcon: { alignItems: 'center', backgroundColor: colors.primaryMuted, borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  settingTitle: { color: colors.text, flex: 1, fontSize: typography.small, fontWeight: '600' },
  settingValue: { color: colors.textMuted, fontSize: typography.micro },
  openSourceCard: { alignItems: 'flex-start', backgroundColor: colors.primaryMuted, borderColor: '#285641', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  openSourceCopy: { flex: 1 },
  openSourceTitle: { color: colors.primary, fontSize: typography.small, fontWeight: '700' },
  openSourceText: { color: '#A7CDBB', fontSize: typography.micro, lineHeight: 16, marginTop: 3 },
  version: { color: colors.textFaint, fontSize: typography.micro, textAlign: 'center' },
});
