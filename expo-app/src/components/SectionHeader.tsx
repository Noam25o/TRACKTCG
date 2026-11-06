import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <Pressable hitSlop={10} onPress={onAction}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: typography.section, fontWeight: '700' },
  action: { color: colors.primary, fontSize: typography.small, fontWeight: '700' },
});
