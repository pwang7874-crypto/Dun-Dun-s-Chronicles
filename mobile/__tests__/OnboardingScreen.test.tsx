import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { OnboardingScreen } from '../src/features/onboarding/OnboardingScreen';

const mockGetProfile = jest.fn();
const mockSaveProfile = jest.fn();

jest.mock('../src/app/ServicesContext', () => ({
  useServices: () => ({
    creativeRepository: {
      getProfile: mockGetProfile,
      saveProfile: mockSaveProfile,
    },
    now: () => new Date('2026-09-03T08:00:00.000Z'),
  }),
}));

const profile = {
  displayName: '饮品收藏家',
  membershipTier: 'free' as const,
  aiCredits: 1,
  points: 0,
  updatedAt: '2026-09-01T08:00:00.000Z',
};

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfile.mockResolvedValue(profile);
    mockSaveProfile.mockResolvedValue(undefined);
  });

  it('walks through the four product moments and persists first-launch completion', async () => {
    const reset = jest.fn();
    const screen = await render(
      <OnboardingScreen
        navigation={{ reset, goBack: jest.fn() } as never}
        route={{ params: undefined } as never}
      />,
    );

    expect(screen.getByLabelText('来自小酱油的贴心引导')).toBeTruthy();
    expect(screen.getByText('把今天喝的，\n贴进日历里')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(screen.getByText('穿搭和美食，\n也一起贴下来')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(screen.getByText('先免费修图，\n再选择 AI 灵感')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(screen.getByText('做成小海报，\n分享也收藏')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: '开始记录今天' }));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockSaveProfile).toHaveBeenCalledWith({
      ...profile,
      onboardingCompletedAt: '2026-09-03T08:00:00.000Z',
      updatedAt: '2026-09-03T08:00:00.000Z',
    }));
    expect(reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
  });

  it('can be reopened and closed from My without rewriting first-launch state', async () => {
    const goBack = jest.fn();
    const screen = await render(
      <OnboardingScreen
        navigation={{ reset: jest.fn(), goBack } as never}
        route={{ params: { replay: true } } as never}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: '关闭教程' }));
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(mockSaveProfile).not.toHaveBeenCalled();
  });
});
