import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CardArtwork } from '@/components/CardArtwork';
import { colors, spacing, typography } from '@/theme';
import type { TcgCard } from '@/types/card';

type Props = {
  card: TcgCard;
  quantity?: number;
  detail?: string;
  onPress?: () => void;
};

export function CardRow({ card, quantity, detail, onPress }: Props) {
  const positive = (card.dayChangePercent ?? 0) >= 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
      <CardArtwork card={card} size="small" />
      <View style={styles.content}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={styles.name}>{card.name}</Text>
          {quantity ? <Text style={styles.quantity}>×{quantity}</Text> : null}
        </View>
        <Text numberOfLines={1} style={styles.meta}>{card.setName} · {card.number}</Text>
        {detail ? <Text numberOfLines={1} style={styles.detail}>{detail}</Text> : null}
      </View>
      <View style={styles.priceBlock}>
        <Text style={styles.price}>{card.marketPrice === null ? '—' : `${card.marketPrice.toFixed(2).replace('.', ',')} €`}</Text>
        {card.dayChangePercent !== null ? <View style={styles.changeLine}>
          <Ionicons
            color={positive ? colors.success : colors.danger}
            name={positive ? 'arrow-up' : 'arrow-down'}
            size={12}
          />
          <Text style={[styles.change, { color: positive ? colors.success : colors.danger }]}>
            {Math.abs(card.dayChangePercent).toFixed(1).replace('.', ',')} %
          </Text>
        </View> : <Text style={styles.detail}>Non coté</Text>}
        {card.source !== 'tcgdex' ? <Text style={styles.detail}>Démo</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.72 },
  content: { flex: 1, gap: 3 },
  titleLine: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  name: { color: colors.text, flexShrink: 1, fontSize: typography.body, fontWeight: '700' },
  quantity: { color: colors.primary, fontSize: typography.small, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: typography.small },
  detail: { color: colors.textFaint, fontSize: typography.micro },
  priceBlock: { alignItems: 'flex-end', gap: 4 },
  price: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  changeLine: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  change: { fontSize: typography.micro, fontWeight: '700' },
});
