import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../design-system/theme';
import { displayDate } from '../../shared/dates';

export const DateField = ({
  value,
  onChange,
}: {
  value: Date;
  onChange: (value: Date) => void;
}) => {
  const [showIOS, setShowIOS] = useState(false);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) {
            onChange(selected);
          }
        },
      });
    } else {
      setShowIOS(current => !current);
    }
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`记录日期，${displayDate(value.toISOString())}`}
        onPress={open}
        style={styles.field}
      >
        <Text style={styles.fieldLabel}>日期</Text>
        <Text style={styles.fieldValue}>
          {displayDate(value.toISOString())}
        </Text>
      </Pressable>
      {showIOS ? (
        <DateTimePicker
          value={value}
          mode="date"
          display="inline"
          maximumDate={new Date()}
          onChange={(_, selected) => selected && onChange(selected)}
          accentColor={colors.creamDeep}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  fieldLabel: { color: colors.inkMuted, fontSize: 14 },
  fieldValue: { color: colors.ink, fontSize: 15, fontWeight: '600' },
});
