import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';

import { colors, radii, spacing } from '../theme';
import { useMotionEnabled } from './useMotionEnabled';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const useButtonSquish = (enabled: boolean) => {
  const progress = useRef(new Animated.Value(0)).current;
  const motion = useMotionEnabled(enabled);
  useEffect(() => {
    if (!motion) { progress.stopAnimation(); progress.setValue(0); }
    return () => progress.stopAnimation();
  }, [motion, progress]);
  return {
    style: { transform: [
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.965] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1.5] }) },
    ] },
    animate: (down: boolean) => {
      if (!motion) return;
      Animated.spring(progress, { toValue: down ? 1 : 0, damping: down ? 20 : 9, stiffness: 280, mass: 0.65, useNativeDriver: true, isInteraction: false }).start();
    },
  };
};

type ButtonProps = PressableProps & {
  label: string;
  busy?: boolean;
};

export const PrimaryButton = ({
  label,
  busy = false,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) => {
  const squish = useButtonSquish(!disabled && !busy);
  const [pressed, setPressed] = useState(false);
  return <AnimatedPressable
    accessibilityRole="button"
    disabled={disabled || busy}
    style={[
      styles.primary,
      pressed && styles.pressed,
      (disabled || busy) && styles.disabled,
      typeof style === 'function' ? style({ pressed }) : style,
      squish.style,
    ]}
    {...props}
    onPressIn={event => { setPressed(true); squish.animate(true); onPressIn?.(event); }}
    onPressOut={event => { setPressed(false); squish.animate(false); onPressOut?.(event); }}
  >
    {busy ? (
      <ActivityIndicator color={colors.white} />
    ) : (
      <Text style={styles.primaryText}>{label}</Text>
    )}
  </AnimatedPressable>;
};

export const SecondaryButton = ({
  label,
  busy = false,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) => {
  const squish = useButtonSquish(!disabled && !busy);
  const [pressed, setPressed] = useState(false);
  return <AnimatedPressable
    accessibilityRole="button"
    disabled={disabled || busy}
    style={[
      styles.secondary,
      pressed && styles.pressed,
      (disabled || busy) && styles.disabled,
      typeof style === 'function' ? style({ pressed }) : style,
      squish.style,
    ]}
    {...props}
    onPressIn={event => { setPressed(true); squish.animate(true); onPressIn?.(event); }}
    onPressOut={event => { setPressed(false); squish.animate(false); onPressOut?.(event); }}
  >
    {busy ? (
      <ActivityIndicator color={colors.creamDeep} />
    ) : (
      <Text style={styles.secondaryText}>{label}</Text>
    )}
  </AnimatedPressable>;
};

const styles = StyleSheet.create({
  primary: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.creamDeep,
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondary: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
});
