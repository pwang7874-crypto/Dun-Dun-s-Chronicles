import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PrimaryButton } from '../src/design-system/components/Buttons';

describe('PrimaryButton', () => {
  it('fires once per press when available', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <PrimaryButton label="保存这一杯" onPress={onPress} />,
    );

    fireEvent.press(screen.getByRole('button', { name: '保存这一杯' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('blocks duplicate input while busy', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <PrimaryButton label="保存这一杯" busy onPress={onPress} />,
    );

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
