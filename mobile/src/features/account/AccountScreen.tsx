import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { CreamPromptModal } from '../../design-system/components/CreamPromptModal';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors } from '../../design-system/theme';
import { AuthError, type AuthSession } from '../../domain/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;
type BusyAction = 'request' | 'login' | 'logout' | 'name' | 'invite';
type Challenge = { challengeId: string; phone: string; expiresAt: number };

export const AccountScreen = ({ navigation }: Props) => {
  const { creativeRepository, authService, now } = useServices();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const countdown = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  const disabled = initializing || busy !== null;

  useEffect(() => {
    mounted.current = true;
    Promise.allSettled([
      creativeRepository.getProfile(),
      authService.getSession(),
    ]).then(([profileResult, sessionResult]) => {
      if (!mounted.current) {
        return;
      }
      if (profileResult.status === 'fulfilled') {
        setName(profileResult.value.displayName);
      }
      if (sessionResult.status === 'fulfilled') {
        setSession(sessionResult.value);
      }
      const failure = sessionResult.status === 'rejected' ? sessionResult : profileResult.status === 'rejected' ? profileResult : null;
      if (failure) {
        setFailed(true);
        setMessage(failure.reason instanceof AuthError ? failure.reason.message : '暂时没能读取账号信息，本机记录仍然保留。');
      }
    }).finally(() => {
      if (mounted.current) {
        setInitializing(false);
      }
    });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setClock(Date.now());
        authService.getSession().then(value => {
          if (mounted.current && !lock.current) {
            setSession(value);
          }
        }).catch(() => {
          if (mounted.current && !lock.current) {
            setSession(null);
            setFailed(true);
            setMessage('暂时无法读取安全登录信息，请解锁设备后重试。');
          }
        });
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [authService, creativeRepository]);

  useEffect(() => {
    if (!resendAt) {
      return;
    }
    const interval = setInterval(() => {
      const timestamp = Date.now();
      setClock(timestamp);
      if (timestamp >= resendAt) {
        setResendAt(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [resendAt]);

  const runAction = async (action: BusyAction, run: () => Promise<void>) => {
    if (lock.current || initializing) {
      return;
    }
    lock.current = true;
    setBusy(action);
    setMessage('');
    setFailed(false);
    try {
      await run();
    } catch (error) {
      if (mounted.current) {
        setFailed(true);
        setMessage(error instanceof AuthError ? error.message : '这一步暂时没完成，请稍后再试。');
      }
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(null);
      }
    }
  };

  const requestCode = () => runAction('request', async () => {
    if (resendAt > Date.now()) {
      return;
    }
    const result = await authService.requestSmsCode(phone);
    if (mounted.current) {
      const timestamp = Date.now();
      setChallenge({ challengeId: result.challengeId, phone, expiresAt: timestamp + result.expiresIn * 1000 });
      setClock(timestamp);
      setResendAt(timestamp + Math.min(60, result.expiresIn) * 1000);
      setCode('');
      setMessage('验证码已发送，看看手机收到的小纸条吧。');
    }
  });

  const signIn = () => runAction('login', async () => {
    if (!challenge || challenge.phone !== phone || challenge.expiresAt <= Date.now()) {
      throw new AuthError('CHALLENGE_EXPIRED', '请先获取当前手机号的验证码；过期的小纸条需要重新领取。');
    }
    const loggedIn = await authService.verifySmsCode(challenge.challengeId, code);
    if (mounted.current) {
      setSession(loggedIn);
      setChallenge(null);
      setCode('');
      setPhone('');
      setMessage('登录成功，欢迎回来。本机记录仍保存在这台设备，暂未开启云同步。');
    }
  });

  const signInWithInvite = () => runAction('invite', async () => {
    const loggedIn = await authService.loginWithInvite(inviteCode);
    if (mounted.current) {
      setSession(loggedIn);
      setInviteCode('');
      setChallenge(null);
      setCode('');
      setPhone('');
      setMessage('邀请码登录成功，AI 创作次数已激活。');
    }
  });

  const saveDeviceName = () => runAction('name', async () => {
    const profile = await creativeRepository.getProfile();
    const displayName = name.trim() || profile.displayName;
    await creativeRepository.saveProfile({ ...profile, displayName, updatedAt: now().toISOString() });
    if (mounted.current) {
      setName(displayName);
      setMessage('称呼已保存在本机，不会自动上传你的照片或记录。');
    }
  });

  const signOut = () => {
    setShowLogout(false);
    return runAction('logout', async () => {
      await authService.signOut();
      if (mounted.current) {
        setSession(null);
        setChallenge(null);
        setCode('');
        setMessage('已退出这台设备的登录，本机记录和称呼都还在。');
      }
    });
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Image source={require('../../assets/images/diary-girl-mascot.png')} style={styles.mascot} resizeMode="contain" accessibilityLabel="小酱油陪你登录" />
            <Text style={styles.kicker}>YOUR LITTLE CUPBOARD</Text>
            <Text accessibilityRole="header" style={styles.title}>给小小日常，{`\n`}留一个专属名字</Text>
          </View>
          <Text style={styles.note}>未登录也能记录和修图。手机号用于登录与账号识别；本机照片和日记不会因为登录而自动上传。</Text>
          {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, failed && styles.error]}>{message}</Text> : null}

          {session ? (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>♡ 你的小账号已登录</Text>
              <Text style={styles.sessionPhone}>{session.phoneMasked}</Text>
              <Text style={styles.note}>登录仅在这台设备生效。云同步尚未开通，请保留本机数据。</Text>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setShowLogout(true)} style={[styles.secondary, disabled && styles.disabled]}>
                <Text style={styles.secondaryText}>{busy === 'logout' ? '正在退出…' : '退出本机登录'}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>内测邀请码登录</Text>
                <Text style={styles.label}>邀请码</Text>
                <View style={styles.phoneRow}>
                  <TextInput
                    accessibilityLabel="邀请码"
                    value={inviteCode}
                    onChangeText={value => setInviteCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32))}
                    editable={!disabled}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={32}
                    placeholder="输入内测邀请码"
                    placeholderTextColor={colors.inkMuted}
                    style={[styles.input, styles.phoneInput]}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel="邀请码登录" accessibilityState={{ disabled: disabled || !inviteCode }} disabled={disabled || !inviteCode} onPress={signInWithInvite} style={[styles.codeButton, (disabled || !inviteCode) && styles.disabled]}>
                    <Text style={styles.codeButtonText}>{busy === 'invite' ? '登录中…' : '邀请码登录'}</Text>
                  </Pressable>
                </View>
                <Text style={styles.status}>内测期间用邀请码直接登录，无需手机号。</Text>
              </View>
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>一张验证码小纸条</Text>
              <Text style={styles.label}>手机号</Text>
              <View style={styles.phoneRow}>
                <TextInput
                  accessibilityLabel="手机号"
                  value={phone}
                  onChangeText={value => {
                    setPhone(value.replace(/\D/g, '').slice(0, 11));
                    setChallenge(null);
                    setCode('');
                  }}
                  editable={!disabled}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={11}
                  placeholder="11 位手机号"
                  placeholderTextColor={colors.inkMuted}
                  style={[styles.input, styles.phoneInput]}
                />
                <Pressable accessibilityRole="button" accessibilityLabel="获取验证码" accessibilityState={{ disabled: disabled || countdown > 0 }} disabled={disabled || countdown > 0} onPress={requestCode} style={[styles.codeButton, (disabled || countdown > 0) && styles.disabled]}>
                  <Text style={styles.codeButtonText}>{busy === 'request' ? '发送中…' : countdown > 0 ? `${countdown} 秒后重发` : '获取验证码'}</Text>
                </Pressable>
              </View>
              <Text style={styles.label}>验证码</Text>
              <TextInput accessibilityLabel="验证码" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} editable={!disabled} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} placeholder="短信里的 6 位数字" placeholderTextColor={colors.inkMuted} style={styles.input} />
              <Pressable accessibilityRole="button" accessibilityLabel="验证码登录" accessibilityState={{ disabled }} disabled={disabled} onPress={signIn} style={[styles.primary, disabled && styles.disabled]}>
                <Text style={styles.primaryText}>{initializing ? '正在打开小账号…' : busy === 'login' ? '正在登录…' : '验证码登录  ♡'}</Text>
              </Pressable>
              <Text style={styles.status}>仅在你点击获取时请求发送验证码</Text>
              <View style={styles.socialRow}>
                <View accessibilityLabel="微信登录，待开通" style={styles.socialPill}><Text style={styles.socialText}>微信 · 待开通</Text></View>
                <View accessibilityLabel="QQ 登录，待开通" style={styles.socialPill}><Text style={styles.socialText}>QQ · 待开通</Text></View>
              </View>
              <Text style={styles.status}>微信 / QQ 登录尚待平台审核与正式接入，暂不可使用。</Text>
              </View>
            </>
          )}

          <View style={styles.form}>
            <Text style={styles.sectionTitle}>小酱油怎么称呼你？</Text>
            <Text style={styles.label}>本机称呼 · 不需要登录</Text>
            <TextInput accessibilityLabel="本机称呼" value={name} onChangeText={setName} editable={!disabled} maxLength={40} placeholder="饮品收藏家" placeholderTextColor={colors.inkMuted} style={styles.input} />
            <Pressable accessibilityRole="button" disabled={disabled} onPress={saveDeviceName} style={[styles.secondary, disabled && styles.disabled]}>
              <Text style={styles.secondaryText}>{busy === 'name' ? '正在保存…' : '保存本机称呼'}</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.status}>先继续记录今天 →</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <CreamPromptModal visible={showLogout} title="先把账号小门关上？" body="只移除这台设备的登录凭证，不删除本机照片、日记或称呼，也不会注销账号。" note="♡ 你的本机小日常还会在这里" confirmLabel="退出本机登录" cancelLabel="继续留下" onConfirm={signOut} onCancel={() => setShowLogout(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  keyboard: { flex: 1 },
  content: { padding: 24, paddingBottom: 36 },
  intro: { paddingRight: 78 },
  mascot: { position: 'absolute', right: -10, bottom: 0, width: 102, height: 122, transform: [{ rotate: '5deg' }] },
  kicker: { color: colors.creamDeep, fontSize: 9, letterSpacing: 2, fontWeight: '800' },
  title: { marginTop: 12, color: colors.ink, fontSize: 27, lineHeight: 39, fontWeight: '900' },
  note: { marginTop: 12, color: colors.inkMuted, fontSize: 12, lineHeight: 20 },
  form: { marginTop: 20, padding: 18, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  sectionTitle: { color: colors.cocoa, fontSize: 17, fontWeight: '800' },
  label: { marginTop: 15, marginBottom: 7, color: colors.ink, fontSize: 12, fontWeight: '800' },
  input: { height: 48, paddingHorizontal: 13, borderRadius: 14, color: colors.ink, backgroundColor: colors.paperDeep, fontSize: 14 },
  phoneRow: { flexDirection: 'row', gap: 8 },
  phoneInput: { flex: 1, minWidth: 0 },
  codeButton: { width: 106, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.butterSoft },
  codeButtonText: { color: colors.cocoa, fontSize: 11, fontWeight: '800' },
  primary: { marginTop: 18, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creamDeep },
  primaryText: { color: colors.card, fontSize: 14, fontWeight: '800' },
  secondary: { marginTop: 14, minHeight: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blushSoft },
  secondaryText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  status: { marginTop: 10, color: colors.inkMuted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  notice: { marginTop: 18, padding: 14, borderRadius: 16, color: colors.cocoa, backgroundColor: colors.butterSoft, fontSize: 13, lineHeight: 21 },
  error: { color: colors.danger, backgroundColor: colors.blushSoft },
  disabled: { opacity: 0.55 },
  sessionPhone: { marginTop: 14, color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: 2 },
  socialRow: { flexDirection: 'row', marginTop: 18, gap: 10 },
  socialPill: { flex: 1, padding: 13, borderRadius: 15, alignItems: 'center', backgroundColor: colors.paperDeep },
  socialText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  backButton: { minHeight: 48, justifyContent: 'center', marginTop: 8 },
});
