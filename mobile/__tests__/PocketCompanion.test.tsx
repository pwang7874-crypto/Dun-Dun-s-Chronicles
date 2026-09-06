import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PocketCompanion } from '../src/design-system/components/PocketCompanion';

jest.mock('../src/design-system/components/useMotionEnabled', () => ({ useMotionEnabled: () => false }));

it('gives a new companion response even with reduced motion', async () => {
  const screen = await render(<PocketCompanion mood="calendar" active={false} />);
  expect(screen.getByText('今天的小快乐，我帮你收好')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '摸摸小酱油' }));
  expect(screen.getByText('碰杯！普通一天也闪闪发光')).toBeTruthy();
  await screen.unmount();
});
