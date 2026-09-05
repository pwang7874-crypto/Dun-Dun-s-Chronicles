import {
  Canvas,
  ColorMatrix,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../design-system/theme';
import type { CreativeProject } from '../../domain/models';
import { colorMatrixForRecipe } from '../../infrastructure/rendering/filters';

interface Props {
  uri: string;
  project: CreativeProject;
}

/**
 * The studio preview and the exported image intentionally share the same
 * recipe-to-matrix function. This prevents a control from looking correct in
 * the editor while producing a different saved image.
 */
export const StudioImagePreview = ({ uri, project }: Props) => {
  const image = useImage(uri);
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    <View
      style={styles.root}
      onLayout={event => setSize({
        width: event.nativeEvent.layout.width,
        height: event.nativeEvent.layout.height,
      })}
    >
      {image && size.width > 0 && size.height > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <SkiaImage image={image} x={0} y={0} width={size.width} height={size.height} fit="contain">
            <ColorMatrix matrix={colorMatrixForRecipe({
              presetId: project.filterPresetId,
              intensity: project.filterIntensity,
              brightness: project.brightness,
              contrast: project.contrast,
              saturation: project.saturation,
              warmth: project.warmth,
            })} />
          </SkiaImage>
        </Canvas>
      ) : (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>正在显影…</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperDeep,
  },
  loadingText: { color: colors.inkMuted, fontSize: 11 },
});
