import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { colors } from '../theme';
import { useMotionEnabled } from './useMotionEnabled';

type MotionBitProps = {
  active?: boolean;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

export const useGentleLoop = (delay: number, duration: number, active: boolean) => {
  const progress = useMemo(() => new Animated.Value(0), []);
  const enabled = useMotionEnabled(active);

  useEffect(() => {
    progress.stopAnimation();

    if (!enabled) {
      progress.setValue(0.5);
      return;
    }

    progress.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [delay, duration, progress, enabled]);

  return progress;
};

export type TwinklingStarProps = MotionBitProps & {
  color?: string;
  size?: number;
};

/** A tiny hand-drawn sparkle that breathes instead of flashing. */
export const TwinklingStar = ({
  active = true,
  color = colors.butter,
  size = 16,
  delay = 0,
  duration = 2600,
  style,
}: TwinklingStarProps) => {
  const progress = useGentleLoop(delay, duration, active);
  const opacity = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.38, 0.9, 0.38],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.82, 1.08, 0.82],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-5deg', '7deg', '-5deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ opacity, transform: [{ scale }, { rotate }] }, style]}
    >
      <Text style={{ color, fontSize: size, lineHeight: size * 1.2 }}>✦</Text>
    </Animated.View>
  );
};

export type RisingSteamProps = MotionBitProps & {
  color?: string;
  height?: number;
};

/** A narrow steam wisp for cups, cards, empty states, or loading moments. */
export const RisingSteam = ({
  active = true,
  color = colors.creamDeep,
  height = 28,
  delay = 0,
  duration = 3000,
  style,
}: RisingSteamProps) => {
  const progress = useGentleLoop(delay, duration, active);
  const opacity = progress.interpolate({
    inputRange: [0, 0.2, 0.7, 1],
    outputRange: [0, 0.42, 0.24, 0],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [7, -height * 0.7],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [-1, 3, -2],
  });
  const scaleY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 1.05, 0.92],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.steamFrame,
        {
          height,
          opacity,
          transform: [{ translateY }, { translateX }, { scaleY }],
        },
        style,
      ]}
    >
      <View style={[styles.steamStroke, { borderColor: color }]} />
    </Animated.View>
  );
};

export type FloatingBubbleProps = MotionBitProps & {
  color?: string;
  size?: number;
  travel?: number;
};

/** A translucent outlined bubble with a subtle upward drift. */
export const FloatingBubble = ({
  active = true,
  color = colors.blush,
  size = 9,
  travel = 20,
  delay = 0,
  duration = 3200,
  style,
}: FloatingBubbleProps) => {
  const progress = useGentleLoop(delay, duration, active);
  const opacity = progress.interpolate({
    inputRange: [0, 0.18, 0.72, 1],
    outputRange: [0, 0.44, 0.28, 0],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [6, -travel],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 3, -1],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.72, 1, 1.08],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubble,
        {
          borderColor: color,
          height: size,
          opacity,
          width: size,
          transform: [{ translateY }, { translateX }, { scale }],
        },
        style,
      ]}
    />
  );
};

export type WobblingCharmProps = MotionBitProps & {
  kind?: 'cup' | 'flower' | 'note';
  color?: string;
  paperColor?: string;
  size?: number;
};

const charmGlyphs = {
  cup: '☕︎',
  flower: '✿',
  note: '♪',
} as const;

/** A tiny paper charm that gently bobs like a hand-pinned journal trinket. */
export const WobblingCharm = ({
  active = true,
  kind = 'cup',
  color = colors.cocoa,
  paperColor = colors.butterSoft,
  size = 13,
  delay = 0,
  duration = 3600,
  style,
}: WobblingCharmProps) => {
  const progress = useGentleLoop(delay, duration, active);
  const opacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.62, 0.94, 0.62],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1.5, -2.5, 1.5],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-4deg', '4deg', '-4deg'],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.96, 1.04, 0.96],
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.charm,
        {
          backgroundColor: paperColor,
          height: size + 11,
          opacity,
          transform: [{ translateY }, { rotate }, { scale }],
          width: size + 11,
        },
        style,
      ]}
    >
      <Text style={[styles.charmGlyph, { color, fontSize: size, lineHeight: size + 2 }]}>
        {charmGlyphs[kind]}
      </Text>
    </Animated.View>
  );
};

export type CuteMotionLayerProps = {
  active?: boolean;
  variant?: 'sparkles' | 'steam' | 'bubbles' | 'charms' | 'mixed';
  style?: StyleProp<ViewStyle>;
};

/**
 * A ready-to-place, pointer-transparent decorative layer. Its sparse layout is
 * intentionally calm enough for a full card or screen background.
 */
export const CuteMotionLayer = ({
  active = true,
  variant = 'mixed',
  style,
}: CuteMotionLayerProps) => {
  const showSparkles = variant === 'sparkles' || variant === 'mixed';
  const showSteam = variant === 'steam' || variant === 'mixed';
  const showBubbles = variant === 'bubbles' || variant === 'mixed';
  const showCharms = variant === 'charms';

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {showSparkles ? (
        <>
          <TwinklingStar active={active} style={styles.starTop} />
          <TwinklingStar
            active={active}
            color={colors.blush}
            delay={850}
            size={11}
            style={styles.starBottom}
          />
        </>
      ) : null}
      {showSteam ? (
        <View style={styles.steamCluster}>
          <RisingSteam active={active} />
          <RisingSteam active={active} delay={750} height={24} style={styles.steamMiddle} />
          <RisingSteam active={active} delay={1450} height={21} style={styles.steamRight} />
        </View>
      ) : null}
      {showBubbles ? (
        <View style={styles.bubbleCluster}>
          <FloatingBubble active={active} />
          <FloatingBubble
            active={active}
            color={colors.sky}
            delay={950}
            size={7}
            style={styles.bubbleMiddle}
          />
          <FloatingBubble
            active={active}
            color={colors.butter}
            delay={1650}
            size={11}
            style={styles.bubbleRight}
          />
        </View>
      ) : null}
      {showCharms ? (
        <>
          <WobblingCharm active={active} kind="cup" style={styles.charmCup} />
          <WobblingCharm
            active={active}
            color={colors.creamDeep}
            delay={1100}
            kind="flower"
            paperColor={colors.blushSoft}
            size={11}
            style={styles.charmFlower}
          />
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  steamFrame: {
    width: 11,
    alignItems: 'center',
  },
  steamStroke: {
    width: 8,
    height: '100%',
    borderLeftWidth: 1.5,
    borderRadius: 999,
    transform: [{ skewX: '-9deg' }],
  },
  bubble: {
    borderRadius: 999,
    borderWidth: 1.2,
    backgroundColor: 'rgba(255,252,246,0.22)',
  },
  charm: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 9,
    shadowColor: colors.cocoa,
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  charmGlyph: {
    fontFamily: 'Georgia',
    includeFontPadding: false,
    textAlign: 'center',
  },
  charmCup: {
    position: 'absolute',
    right: -7,
    top: '31%',
  },
  charmFlower: {
    position: 'absolute',
    bottom: '10%',
    left: -6,
  },
  starTop: {
    position: 'absolute',
    right: '9%',
    top: '10%',
  },
  starBottom: {
    position: 'absolute',
    bottom: '14%',
    left: '7%',
  },
  steamCluster: {
    position: 'absolute',
    right: '19%',
    top: '7%',
    width: 38,
    height: 42,
  },
  steamMiddle: {
    position: 'absolute',
    left: 12,
    top: 5,
  },
  steamRight: {
    position: 'absolute',
    left: 24,
    top: 10,
  },
  bubbleCluster: {
    position: 'absolute',
    bottom: '9%',
    right: '9%',
    width: 48,
    height: 52,
  },
  bubbleMiddle: {
    position: 'absolute',
    left: 17,
    top: 12,
  },
  bubbleRight: {
    position: 'absolute',
    left: 31,
    top: 25,
  },
});
