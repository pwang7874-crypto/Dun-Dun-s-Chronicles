import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

export const ErrorNotice = ({ message }: { message?: string }) =>
  message ? (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  ) : null;

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: '#F6E3DF',
  },
  text: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 21,
  },
});
