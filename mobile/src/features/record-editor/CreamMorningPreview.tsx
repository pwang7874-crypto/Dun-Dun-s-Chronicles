import {
  Canvas,
  ColorMatrix,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, radii } from '../../design-system/theme';
import type { FilterPresetId } from '../../domain/models';
import { colorMatrixForPreset } from '../../infrastructure/rendering/filters';

interface Props {
  uri: string;
  pixelWidth: number;
  pixelHeight: number;
  intensity: number;
  presetId: FilterPresetId;
  maxHeight?: number;
}

export const CreamMorningPreview = ({
  uri,
  pixelWidth,
  pixelHeight,
  intensity,
  presetId,
  maxHeight,
}: Props) => {
  const image = useImage(uri);
  const { width: screenWidth } = useWindowDimensions();
  const width = screenWidth - 32;
  const ratio = pixelHeight / pixelWidth;
  const naturalHeight = Math.max(260, Math.min(520, width * ratio));
  const height = maxHeight ? Math.min(maxHeight, naturalHeight) : naturalHeight;

  if (!image) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <Text style={styles.placeholderText}>正在显影…</Text>
      </View>
    );
  }

  return (
    <Canvas style={[styles.canvas, { width, height }]}>
      <SkiaImage
        image={image}
        x={0}
        y={0}
        width={width}
        height={height}
        fit="contain"
      >
        <ColorMatrix matrix={colorMatrixForPreset(presetId, intensity)} />
      </SkiaImage>
    </Canvas>
  );
};

const styles = StyleSheet.create({
  canvas: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.black,
  },
  placeholder: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperDeep,
  },
  placeholderText: { color: colors.inkMuted },
});
