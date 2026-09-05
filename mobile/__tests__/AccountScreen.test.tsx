import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AuthError } from '../src/domain/auth';
import { AccountScreen } from '../src/features/account/AccountScreen';

const profile = { displayName: '饮品收藏家', membershipTier: 'free', aiCredits: 1, points: 0, updatedAt: '2026-09-05T08:00:00Z' };
const mockServices = {
  creativeRepository: { getProfile: jest.fn(), saveProfile: jest.fn() },
  authService: { getSession: jest.fn(), requestSmsCode: jest.fn(), verifySmsCode: jest.fn(), signOut: jest.fn() },
  now: () => new Date('2026-09-05T08:00:00Z'),
};

jest.mock('../src/app/ServicesContext', () => ({ useServices: () => mockServices }));
jest.mock('../src/design-system/components/CuteMotionBits', () => ({ TwinklingStar: () => null, WobblingCharm: () => null }));

const renderAccount = async () => {
  const screen = await render(<AccountScreen navigation={{ goBack: jest.fn() } as never} route={{ params: undefined } as never} />);
  await waitFor(() => expect(screen.getByLabelText('本机称呼').props.editable).toBe(true));
  return screen;
};

const sendCode = async (screen: Awaited<ReturnType<typeof renderAccount>>) => {
  await fireEvent.changeText(screen.getByLabelText('手机号'), '13800000000');
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '获取验证码' }));
  });
};

describe('AccountScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServices.creativeRepository.getProfile.mockResolvedValue(profile);
    mockServices.creativeRepository.saveProfile.mockResolvedValue(undefined);
    mockServices.authService.getSession.mockResolvedValue(null);
    mockServices.authService.requestSmsCode.mockResolvedValue({ challengeId: 'challenge-1', expiresIn: 300 });
    mockServices.authService.verifySmsCode.mockResolvedValue({ phoneMasked: '138****0000', expiresAt: Date.now() + 3600000 });
    mockServices.authService.signOut.mockResolvedValue(undefined);
  });

  it('requests the SMS only on tap, counts down and prevents duplicate requests', async () => {
    const screen = await renderAccount();
    expect(mockServices.authService.requestSmsCode).not.toHaveBeenCalled();
    expect(screen.getByText('微信 · 待开通')).toBeTruthy();
    expect(screen.getByText('QQ · 待开通')).toBeTruthy();
    await sendCode(screen);
    expect(mockServices.authService.requestSmsCode).toHaveBeenCalledWith('13800000000');
    expect(screen.getByText('60 秒后重发')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '获取验证码' }));
    expect(mockServices.authService.requestSmsCode).toHaveBeenCalledTimes(1);
  });

  it('signs in with the received challenge and does not claim cloud sync', async () => {
    const screen = await renderAccount();
    await sendCode(screen);
    await fireEvent.changeText(screen.getByLabelText('验证码'), '123456');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: '验证码登录' }));
    });
    expect(mockServices.authService.verifySmsCode).toHaveBeenCalledWith('challenge-1', '123456');
    expect(screen.getByText('138****0000')).toBeTruthy();
    expect(screen.getByText('登录成功，欢迎回来。本机记录仍保存在这台设备，暂未开启云同步。')).toBeTruthy();
    expect(mockServices.creativeRepository.saveProfile).not.toHaveBeenCalled();
  });

  it('invalidates an old challenge when the phone changes', async () => {
    const screen = await renderAccount();
    await sendCode(screen);
    await fireEvent.changeText(screen.getByLabelText('手机号'), '13900000000');
    await fireEvent.changeText(screen.getByLabelText('验证码'), '123456');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: '验证码登录' }));
    });
    expect(mockServices.authService.verifySmsCode).not.toHaveBeenCalled();
    expect(screen.getByText('请先获取当前手机号的验证码；过期的小纸条需要重新领取。')).toBeTruthy();
  });

  it('keeps the login form and shows a verification error', async () => {
    mockServices.authService.verifySmsCode.mockRejectedValue(new AuthError('SMS_CODE_INVALID', '验证码不正确，请再看看短信。'));
    const screen = await renderAccount();
    await sendCode(screen);
    await fireEvent.changeText(screen.getByLabelText('验证码'), '123456');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: '验证码登录' }));
    });
    expect(screen.getByText('验证码不正确，请再看看短信。')).toBeTruthy();
    expect(screen.queryByText('♡ 你的小账号已登录')).toBeNull();
  });

  it('saves a device nickname without logging in', async () => {
    const screen = await renderAccount();
    await fireEvent.changeText(screen.getByLabelText('本机称呼'), ' 奶油收藏家 ');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: '保存本机称呼' }));
    });
    expect(mockServices.creativeRepository.saveProfile).toHaveBeenCalledWith({ ...profile, displayName: '奶油收藏家', updatedAt: '2026-09-05T08:00:00.000Z' });
    expect(mockServices.authService.verifySmsCode).not.toHaveBeenCalled();
    expect(screen.getByText('称呼已保存在本机，不会自动上传你的照片或记录。')).toBeTruthy();
  });

  it('confirms local logout in the cream prompt without deleting the profile', async () => {
    mockServices.authService.getSession.mockResolvedValue({ phoneMasked: '138****0000', expiresAt: Date.now() + 3600000 });
    const screen = await renderAccount();
    await fireEvent.press(screen.getByRole('button', { name: '退出本机登录' }));
    await waitFor(() => expect(screen.getByText('先把账号小门关上？')).toBeTruthy());
    const buttons = screen.getAllByRole('button', { name: /退出本机登录/ });
    const confirmButton = buttons[buttons.length - 1];
    if (!confirmButton) {
      throw new Error('Missing logout confirmation');
    }
    await act(async () => {
      await fireEvent.press(confirmButton);
    });
    expect(mockServices.authService.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText('已退出这台设备的登录，本机记录和称呼都还在。')).toBeTruthy();
    expect(mockServices.creativeRepository.saveProfile).not.toHaveBeenCalled();
  });

  it('does not claim logout succeeded when secure storage removal fails', async () => {
    mockServices.authService.getSession.mockResolvedValue({ phoneMasked: '138****0000', expiresAt: Date.now() + 3600000 });
    mockServices.authService.signOut.mockRejectedValue(new AuthError('SECURE_STORAGE_UNAVAILABLE', '安全存储无法清除，请重试。'));
    const screen = await renderAccount();
    await fireEvent.press(screen.getByRole('button', { name: '退出本机登录' }));
    await waitFor(() => expect(screen.getByText('先把账号小门关上？')).toBeTruthy());
    const buttons = screen.getAllByRole('button', { name: /退出本机登录/ });
    const confirmButton = buttons[buttons.length - 1];
    if (!confirmButton) {
      throw new Error('Missing logout confirmation');
    }
    await act(async () => {
      await fireEvent.press(confirmButton);
    });
    expect(screen.getByText('安全存储无法清除，请重试。')).toBeTruthy();
    expect(screen.getByText('138****0000')).toBeTruthy();
  });
});
