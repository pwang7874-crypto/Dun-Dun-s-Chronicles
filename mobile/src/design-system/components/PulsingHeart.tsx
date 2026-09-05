import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';

import { colors } from '../theme';
import { useReducedMotion } from './useReducedMotion';

export type PulsingHeartProps = {
  /** The rendered square and glyph size in points. */
  size?: number;
  /** Resting outline colour. */
  baseColor?: string;
  /** Colour used at the top of each heartbeat. */
  warmColor?: string;
  /** Duration of one complete, intentionally gentle heartbeat. */
  duration?: number;
  /** Fill the heart at the peak; disable for an outline-only treatment. */
  fillOnBeat?: boolean;
  /** Pause the loop while its screen is not visible. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * A warm, slow heartbeat designed for the calendar action in the cream UI.
 * It remains a static resting outline when the user enables Reduce Motion.
 */
export const PulsingHeart = ({
  size = 30,
  baseColor = colors.cocoa,
  warmColor = '#D95F58',
  duration = 3400,
  fillOnBeat = true,
  active = true,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}: PulsingHeartProps) => {
  const progress = useMemo(() => new Animated.Value(0), []);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    progress.stopAnimation();

    if (reducedMotion || !active) {
      // Keep the resting outline rather than freezing on a bright red frame.
      progress.setValue(0);
      return;
    }

    progress.setValue(0);
    const cycleDuration = Math.max(2200, duration);
    const firstRise = cycleDuration * 0.16;
    const firstRelease = cycleDuration * 0.09;
    const echoRise = cycleDuration * 0.11;
    const settle = cycleDuration * 0.2;
    const rest = cycleDuration - firstRise - firstRelease - echoRise - settle;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: firstRise,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(progress, {
          toValue: 0.32,
          duration: firstRelease,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(progress, {
          toValue: 0.82,
          duration: echoRise,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: settle,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(rest),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [active, duration, progress, reducedMotion]);

  const scale = progress.interpolate({
    inputRange: [0, 0.32, 0.82, 1],
    outputRange: [1, 1.035, 1.105, 1.14],
  });
  const warmOpacity = progress.interpolate({
    inputRange: [0, 0.16, 0.32, 0.55, 0.82, 1],
    outputRange: [0, 0.02, 0.14, 0.48, 0.84, 1],
  });
  const outlineOpacity = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 0.82, 0.3],
  });
  const haloOpacity = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0.04, 0.16],
  });
  const haloScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1.28],
  });
  const lift = progress.interpolate({
    inputRange: [0, 0.32, 0.82, 1],
    outputRange: [0, -0.2, -0.7, -1.1],
  });
  const lineHeight = size * 1.08;

  return (
    <Animated.View
      accessibilityElementsHidden={!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      pointerEvents="none"
      style={[
        styles.heart,
        { height: lineHeight, width: lineHeight, transform: [{ translateY: lift }, { scale }] },
        style,
      ]}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.halo,
          {
            backgroundColor: warmColor,
            height: size * 0.78,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
            width: size * 0.78,
          },
        ]}
      />
      <Animated.Text
        style={[
          styles.glyph,
          { color: baseColor, fontSize: size, lineHeight, opacity: outlineOpacity },
          textStyle,
        ]}
      >
        ♡
      </Animated.Text>
      <Animated.Text
        style={[
          styles.glyph,
          styles.warmGlyph,
          {
            color: warmColor,
            fontSize: size,
            lineHeight,
            opacity: warmOpacity,
          },
          textStyle,
        ]}
      >
        {fillOnBeat ? '♥' : '♡'}
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  heart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    borderRadius: 999,
  },
  glyph: {
    fontFamily: 'Georgia',
    includeFontPadding: false,
    textAlign: 'center',
  },
  warmGlyph: {
    position: 'absolute',
  },
});
