import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

export const LoadingView = ({ label = '正在打开…' }: { label?: string }) => (
  <View style={styles.container}>
    <ActivityIndicator color={colors.creamDeep} />
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.paper,
  },
  label: { color: colors.inkMuted, fontSize: 14 },
});
