import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';

import { colors, radii, spacing } from '../theme';

type ButtonProps = PressableProps & {
  label: string;
  busy?: boolean;
};

export const PrimaryButton = ({
  label,
  busy = false,
  disabled,
  style,
  ...props
}: ButtonProps) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled || busy}
    style={({ pressed }) => [
      styles.primary,
      pressed && styles.pressed,
      (disabled || busy) && styles.disabled,
      typeof style === 'function' ? style({ pressed }) : style,
    ]}
    {...props}
  >
    {busy ? (
      <ActivityIndicator color={colors.white} />
    ) : (
      <Text style={styles.primaryText}>{label}</Text>
    )}
  </Pressable>
);

export const SecondaryButton = ({
  label,
  busy = false,
  disabled,
  style,
  ...props
}: ButtonProps) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled || busy}
    style={({ pressed }) => [
      styles.secondary,
      pressed && styles.pressed,
      (disabled || busy) && styles.disabled,
      typeof style === 'function' ? style({ pressed }) : style,
    ]}
    {...props}
  >
    {busy ? (
      <ActivityIndicator color={colors.creamDeep} />
    ) : (
      <Text style={styles.secondaryText}>{label}</Text>
    )}
  </Pressable>
);

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
