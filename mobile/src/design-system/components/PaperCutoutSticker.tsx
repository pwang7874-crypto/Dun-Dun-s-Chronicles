import React, { memo, useMemo } from 'react';
import {
  Image,
  type ImageResizeMode,
  type ImageSourcePropType,
  type ImageStyle,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface Props {
  uri: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
}

type Offset = readonly [x: number, y: number];

interface AlphaLayerProps {
  blurRadius?: number;
  imageStyle?: StyleProp<ImageStyle>;
  offset?: Offset;
  opacity?: number;
  resizeMode: ImageResizeMode;
  source: ImageSourcePropType;
  tintColor: string;
}

/*
 * Two rings are deliberately used instead of a rectangular border. Tinting an
 * Image keeps the source PNG's alpha, and the shifted copies expand only that
 * alpha silhouette. Eight slightly uneven samples per ring create the soft,
 * hand-cut contour from the reference journal without making multi-sticker
 * dragging and poster capture unnecessarily expensive.
 */
const outerPaperEdgeOffsets: readonly Offset[] = [
  [-8.7, 0],
  [0, -8.9],
  [8.8, 0.4],
  [-0.3, 8.6],
  [-6.4, -6.3],
  [6.3, -6.2],
  [-6.2, 6.4],
  [6.4, 6.2],
];

const innerPaperEdgeOffsets: readonly Offset[] = [
  [-6.4, 0],
  [0, -6.4],
  [6.4, 0],
  [0, 6.4],
  [-4.55, -4.5],
  [4.5, -4.45],
  [-4.45, 4.55],
  [4.55, 4.45],
];

const AlphaLayer = ({
  blurRadius,
  imageStyle,
  offset = [0, 0],
  opacity = 1,
  resizeMode,
  source,
  tintColor,
}: AlphaLayerProps) => {
  const [x, y] = offset;

  return (
    <View
      style={[
        styles.layerFrame,
        x === 0 && y === 0
          ? null
          : { transform: [{ translateX: x }, { translateY: y }] },
      ]}
    >
      <Image
        accessible={false}
        blurRadius={blurRadius}
        fadeDuration={0}
        resizeMode={resizeMode}
        source={source}
        style={[
          styles.layer,
          imageStyle,
          styles.alphaImage,
          { opacity, tintColor },
        ]}
      />
    </View>
  );
};

/**
 * Renders the transparent PNG produced by DeviceSubjectCutoutService as a
 * tactile paper sticker. Every visible effect is alpha-derived, so transparent
 * areas remain transparent and even hair, handles, straws and other irregular
 * details receive their own cream paper edge.
 */
export const PaperCutoutSticker = memo(({
  uri,
  style,
  imageStyle,
  resizeMode = 'contain',
}: Props) => {
  const source = useMemo<ImageSourcePropType>(() => ({ uri }), [uri]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[style, styles.root]}
    >
      <View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={styles.artwork}
      >
        <View style={styles.subjectBounds}>
          {/* Soft cast shadow: blurred alpha copies, never a square view shadow. */}
          <AlphaLayer
            blurRadius={4}
            imageStyle={imageStyle}
            offset={[2.8, 9.5]}
            opacity={0.2}
            resizeMode={resizeMode}
            source={source}
            tintColor="#76533F"
          />
          <AlphaLayer
            blurRadius={1.4}
            imageStyle={imageStyle}
            offset={[1.2, 6.4]}
            opacity={0.16}
            resizeMode={resizeMode}
            source={source}
            tintColor="#B28A66"
          />

          {/* A warm deckled rim under a creamy-white inner paper layer. */}
          {outerPaperEdgeOffsets.map(([x, y]) => (
            <AlphaLayer
              key={`outer:${x}:${y}`}
              imageStyle={imageStyle}
              offset={[x, y]}
              resizeMode={resizeMode}
              source={source}
              tintColor="#EFE2CC"
            />
          ))}
          {innerPaperEdgeOffsets.map(([x, y]) => (
            <AlphaLayer
              key={`inner:${x}:${y}`}
              imageStyle={imageStyle}
              offset={[x, y]}
              resizeMode={resizeMode}
              source={source}
              tintColor="#FFFCF3"
            />
          ))}

          {/* Opposing edge light creates the pressed, slightly raised paper lip. */}
          <AlphaLayer
            imageStyle={imageStyle}
            offset={[1.5, 1.9]}
            opacity={0.32}
            resizeMode={resizeMode}
            source={source}
            tintColor="#C8AC83"
          />
          <AlphaLayer
            imageStyle={imageStyle}
            offset={[-1.35, -1.55]}
            opacity={0.86}
            resizeMode={resizeMode}
            source={source}
            tintColor="#FFFFFF"
          />

          <Image
            accessible={false}
            fadeDuration={0}
            resizeMode={resizeMode}
            source={source}
            style={[styles.layer, imageStyle, styles.alphaImage]}
          />

          {/* Sub-pixel highlights give the print a restrained fibrous matte grain. */}
          <AlphaLayer
            imageStyle={imageStyle}
            offset={[-0.35, -0.25]}
            opacity={0.025}
            resizeMode={resizeMode}
            source={source}
            tintColor="#FFFDF7"
          />
          <AlphaLayer
            imageStyle={imageStyle}
            offset={[0.4, 0.5]}
            opacity={0.014}
            resizeMode={resizeMode}
            source={source}
            tintColor="#9A7658"
          />
        </View>
      </View>
    </View>
  );
});

PaperCutoutSticker.displayName = 'PaperCutoutSticker';

const styles = StyleSheet.create({
  root: {
    /*
     * Call sites use the same sizing style as their old rectangular Image.
     * Explicitly neutralise visual frame properties while retaining its width,
     * height, flex and transform so that the alpha cutout stays truly clear.
     */
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRadius: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderWidth: 0,
    elevation: 0,
    overflow: 'visible',
    shadowOpacity: 0,
  },
  artwork: {
    position: 'absolute',
    bottom: -11,
    left: -11,
    right: -11,
    top: -11,
    overflow: 'visible',
  },
  subjectBounds: {
    position: 'absolute',
    bottom: 11,
    left: 11,
    right: 11,
    top: 11,
    overflow: 'visible',
  },
  layerFrame: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    overflow: 'visible',
  },
  layer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
  alphaImage: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderWidth: 0,
  },
});
