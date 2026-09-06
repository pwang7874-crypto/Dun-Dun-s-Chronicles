import React, { memo, useMemo, useState } from 'react';
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
 * 小红书式贴纸：主体周围一圈明显的纯白描边 + 向下深色投影。
 * 每层都是同一张透明 PNG 的染色偏移副本，透明区域保持透明，
 * 所以描边和投影会贴合头发、吸管、把手等不规则轮廓，而不是方形框。
 * 白边用纯白 #FFFFFF 并在奶油底上形成清晰对比，贴纸感更强。
 */
const edgeDirections: readonly Offset[] = Array.from({ length: 12 }, (_, i) => [
  Math.cos(i * Math.PI / 6), Math.sin(i * Math.PI / 6),
] as const);

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
 * red-book style sticker: a crisp white outline around the subject and a soft
 * cast shadow below it. Every visible effect is alpha-derived.
 */
export const PaperCutoutSticker = memo(({
  uri,
  style,
  imageStyle,
  resizeMode = 'contain',
}: Props) => {
  const source = useMemo<ImageSourcePropType>(() => ({ uri }), [uri]);
  const [edge, setEdge] = useState(5);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      onLayout={({ nativeEvent: { layout } }) => {
        setEdge(Math.max(3, Math.min(8, Math.min(layout.width, layout.height) * 0.035)));
      }}
      style={[style, styles.root]}
    >
      <View
        style={styles.artwork}
      >
        <View style={styles.subjectBounds}>
          {/* 明显向下的深色投影，让贴纸与浅色画布分离开。 */}
          <AlphaLayer
            blurRadius={4}
            imageStyle={imageStyle}
            offset={[1, edge + 4]}
            opacity={0.2}
            resizeMode={resizeMode}
            source={source}
            tintColor="#5A3E2B"
          />
          <AlphaLayer
            blurRadius={1.5}
            imageStyle={imageStyle}
            offset={[0, edge + 1]}
            opacity={0.16}
            resizeMode={resizeMode}
            source={source}
            tintColor="#6B4A32"
          />

          {/* 一圈纯白粗描边：先外圈后内圈，覆盖主体轮廓形成贴纸白边。 */}
          {edgeDirections.map(([x, y], index) => (
            <AlphaLayer
              key={`edge:${index}`}
              imageStyle={imageStyle}
              offset={[x * edge, y * edge]}
              resizeMode={resizeMode}
              source={source}
              tintColor="#FFFFFF"
            />
          ))}
          <AlphaLayer imageStyle={imageStyle} resizeMode={resizeMode} source={source} tintColor="#FFFFFF" />

          {/* 主体本身。 */}
          <Image
            accessible={false}
            fadeDuration={0}
            resizeMode={resizeMode}
            source={source}
            style={[styles.layer, imageStyle, styles.alphaImage]}
          />

          {/* No texture or white overlay above the original-colour photo. */}
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
    bottom: -16,
    left: -16,
    right: -16,
    top: -16,
    overflow: 'visible',
  },
  subjectBounds: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    top: 16,
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
