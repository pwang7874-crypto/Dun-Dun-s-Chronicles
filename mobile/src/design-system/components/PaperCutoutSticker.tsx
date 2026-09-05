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
 * 小红书式贴纸：主体周围一圈明显的纯白描边 + 向下深色投影。
 * 每层都是同一张透明 PNG 的染色偏移副本，透明区域保持透明，
 * 所以描边和投影会贴合头发、吸管、把手等不规则轮廓，而不是方形框。
 * 白边用纯白 #FFFFFF 并在奶油底上形成清晰对比，贴纸感更强。
 */
const outerWhiteEdgeOffsets: readonly Offset[] = [
  [-12, 0],
  [0, -12],
  [12, 0.5],
  [-0.4, 12],
  [-8.6, -8.6],
  [8.6, -8.4],
  [-8.4, 8.6],
  [8.5, 8.4],
  [-15, 0.3],
  [-0.3, -15],
  [15, -0.2],
  [0.2, 15],
  [-10.8, -10.6],
  [10.6, -10.4],
  [-10.5, 10.7],
  [10.7, 10.5],
];

const innerWhiteEdgeOffsets: readonly Offset[] = [
  [-8, 0],
  [0, -8],
  [8, 0],
  [0, 8],
  [-5.7, -5.7],
  [5.7, -5.6],
  [-5.6, 5.7],
  [5.6, 5.6],
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
          {/* 明显向下的深色投影，让贴纸与浅色画布分离开。 */}
          <AlphaLayer
            blurRadius={6}
            imageStyle={imageStyle}
            offset={[3, 13]}
            opacity={0.32}
            resizeMode={resizeMode}
            source={source}
            tintColor="#5A3E2B"
          />
          <AlphaLayer
            blurRadius={2.6}
            imageStyle={imageStyle}
            offset={[2, 7]}
            opacity={0.24}
            resizeMode={resizeMode}
            source={source}
            tintColor="#6B4A32"
          />

          {/* 一圈纯白粗描边：先外圈后内圈，覆盖主体轮廓形成贴纸白边。 */}
          {outerWhiteEdgeOffsets.map(([x, y]) => (
            <AlphaLayer
              key={`outer:${x}:${y}`}
              imageStyle={imageStyle}
              offset={[x, y]}
              resizeMode={resizeMode}
              source={source}
              tintColor="#FFFFFF"
            />
          ))}
          {innerWhiteEdgeOffsets.map(([x, y]) => (
            <AlphaLayer
              key={`inner:${x}:${y}`}
              imageStyle={imageStyle}
              offset={[x, y]}
              resizeMode={resizeMode}
              source={source}
              tintColor="#FFFFFF"
            />
          ))}

          {/* 主体本身。 */}
          <Image
            accessible={false}
            fadeDuration={0}
            resizeMode={resizeMode}
            source={source}
            style={[styles.layer, imageStyle, styles.alphaImage]}
          />

          {/* 轻微顶部高光，保留一点手账质感但不抢白边。 */}
          <AlphaLayer
            imageStyle={imageStyle}
            offset={[-0.6, -0.8]}
            opacity={0.12}
            resizeMode={resizeMode}
            source={source}
            tintColor="#FFFFFF"
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
