import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { getCardImages, nextCardImage, type CardImage } from '@/services/card-images';
import { colors, radii } from '@/theme';
import type { TcgCard } from '@/types/card';

type Props = {
  card: TcgCard;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
};

const dimensions = {
  small: { width: 52, height: 72, symbol: 22 },
  medium: { width: 78, height: 108, symbol: 30 },
  large: { width: 164, height: 228, symbol: 58 },
} as const;

export function CardArtwork({ card, size = 'medium', style }: Props) {
  const images = getCardImages(card);
  // A reused list row or refreshed URL gets a fresh loading/error state.
  return <Artwork key={JSON.stringify([card.id, card.language, card.number, images])} card={card} size={size} style={style} images={images} />;
}

function Artwork({ card, size = 'medium', style, images }: Props & { images: CardImage[] }) {
  const dimension = dimensions[size];
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const image = nextCardImage(images, failedUrls);

  if (image) return (
    <View style={[{ width: dimension.width, height: dimension.height }, style]}>
    <Image
      key={image.url}
      accessibilityLabel={`${card.name}, ${card.number}, ${card.language}`}
      source={{ uri: image.url }}
      onLoad={() => setLoadedUrl(image.url)}
      onError={() => setFailedUrls((urls) => urls.includes(image.url) ? urls : [...urls, image.url])}
      resizeMode="contain"
      style={{ width: '100%', height: '100%', borderRadius: radii.sm }}
    />
    {size === 'large' && loadedUrl === image.url ? <Text style={styles.source}>Image : {image.source}</Text> : null}
    </View>
  );

  return (
    <LinearGradient
      colors={card.accent}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.frame, dimension, style]}
    >
      <View style={styles.inner}>
        <Text style={[styles.symbol, { fontSize: dimension.symbol }]}>{card.symbol}</Text>
        {size === 'large' ? <Text style={styles.unavailable}>Image indisponible</Text> : null}
        {size === 'large' && failedUrls.length > 0 ? <Pressable
          accessibilityRole="button"
          accessibilityLabel="Réessayer le chargement de l’image"
          onPress={() => { setLoadedUrl(undefined); setFailedUrls([]); }}
          style={styles.retry}
        ><Text style={styles.unavailable}>Réessayer</Text></Pressable> : null}
        <Text numberOfLines={1} style={styles.number}>
          {card.number}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  source: { color: colors.textMuted, fontSize: 10, position: 'absolute', top: '100%', marginTop: 6, width: '100%', textAlign: 'center' },
  unavailable: { color: colors.white, fontSize: 11, textAlign: 'center' },
  retry: { padding: 12, marginTop: 4 },
  frame: {
    borderRadius: radii.sm,
    padding: 3,
    shadowColor: colors.black,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  inner: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 12, 17, 0.22)',
    borderColor: 'rgba(255,255,255,0.36)',
    borderRadius: 7,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  symbol: {
    color: colors.white,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  number: {
    bottom: 5,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 8,
    fontWeight: '700',
    left: 4,
    position: 'absolute',
    right: 4,
    textAlign: 'center',
  },
});
