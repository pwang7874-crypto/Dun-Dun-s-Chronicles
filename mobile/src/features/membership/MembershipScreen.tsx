import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors } from '../../design-system/theme';
import type { AiEntitlement } from '../../domain/ports';
import { AiArtError } from '../../infrastructure/network/HttpAiArtService';

type Props = NativeStackScreenProps<RootStackParamList, 'Membership'>;

export const MembershipScreen = ({ navigation }: Props) => {
  const { aiArtService, authService } = useServices();
  const [entitlement, setEntitlement] = useState<AiEntitlement | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    authService.getSession().then(session => {
      setLoggedIn(Boolean(session));
      if (session) {
        aiArtService.getEntitlement().then(setEntitlement).catch(() => setEntitlement(null));
      }
    }).catch(() => undefined);
  }, [aiArtService, authService]);

  const redeem = useCallback(async () => {
    if (redeeming) return;
    setRedeeming(true);
    setMessage('');
    setFailed(false);
    try {
      const result = await aiArtService.redeemInvite(inviteCode);
      setInviteCode('');
      setEntitlement(current => current ? {
        ...current,
        inviteCreditsRemaining: result.inviteCreditsRemaining,
        entitlementKind: result.inviteCreditsRemaining > 0 ? 'invite' : current.entitlementKind,
      } : current);
      setMessage(`兑换成功，获得 ${result.creditsGranted} 次创作，现在共有 ${result.inviteCreditsRemaining} 次。`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof AiArtError ? error.message : '兑换暂时没完成，请稍后再试。');
    } finally {
      setRedeeming(false);
    }
  }, [aiArtService, inviteCode, redeeming]);

  const purchase = useCallback(() => {
    Alert.alert('需要应用商店商品配置', '会员支付尚未接入。内测期间请使用邀请码获得 AI 创作次数。');
  }, []);

  const inviteRemaining = entitlement?.inviteCreditsRemaining;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.crown}><Text style={styles.crownText}>♛</Text></View>
          <Text style={styles.title}>吨吨灵感</Text>
          <Text style={styles.subtitle}>记录、日历和本地修图永久免费。内测期间，AI 艺术创作通过邀请码获得次数；失败不扣次数。</Text>

          <View style={styles.balance}>
            <Text style={styles.balanceLabel}>我的创作次数</Text>
            <Text style={styles.balanceValue}>{loggedIn ? (inviteRemaining ?? '…') : '未登录'}</Text>
          </View>

          <View style={styles.inviteCard}>
            <Text style={styles.sectionTitle}>输入邀请码</Text>
            <Text style={styles.inviteHint}>邀请码由内测发放，兑换后获得对应创作次数。</Text>
            {!loggedIn ? (
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Account')} style={styles.primary}>
                <Text style={styles.primaryText}>先去登录账号</Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.inviteRow}>
                  <TextInput
                    accessibilityLabel="邀请码"
                    value={inviteCode}
                    onChangeText={value => setInviteCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32))}
                    editable={!redeeming}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="邀请码"
                    placeholderTextColor={colors.inkMuted}
                    style={styles.inviteInput}
                  />
                  <Pressable accessibilityRole="button" accessibilityState={{ disabled: redeeming || !inviteCode }} disabled={redeeming || !inviteCode} onPress={redeem} style={[styles.redeemButton, (redeeming || !inviteCode) && styles.disabled]}>
                    <Text style={styles.redeemText}>{redeeming ? '兑换中…' : '兑换'}</Text>
                  </Pressable>
                </View>
                {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, failed && styles.error]}>{message}</Text> : null}
              </>
            )}
          </View>

          <View style={styles.planRow}>
            <Pressable onPress={purchase} style={styles.plan}><Text style={styles.planName}>月度灵感</Text><Text style={styles.planCredits}>每天 1 次</Text><Text style={styles.planPrice}>¥18</Text><Text style={styles.planSuffix}>待接入</Text></Pressable>
            <Pressable onPress={purchase} style={[styles.plan, styles.planBest]}><Text style={styles.best}>更划算</Text><Text style={styles.planName}>年度灵感</Text><Text style={styles.planCredits}>每天 1 次</Text><Text style={styles.planPrice}>¥128</Text><Text style={styles.planSuffix}>待接入</Text></Pressable>
          </View>

          <View style={styles.promise}>
            <Text style={styles.promiseTitle}>创作次数，清清楚楚</Text>
            <Text style={styles.promiseText}>每成功生成一张扣 1 次；生成失败自动返还；邀请码次数用完前不会自动扣费。会员支付接入后，会员每天另有 1 次。</Text>
          </View>

          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>先继续记录今天 →</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  keyboard: { flex: 1 },
  content: { padding: 24, paddingBottom: 36, alignItems: 'center' },
  crown: { marginTop: 20, width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.butterSoft, transform: [{ rotate: '-4deg' }] },
  crownText: { color: colors.creamDeep, fontSize: 38 },
  title: { marginTop: 18, color: colors.ink, fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 10, maxWidth: 310, color: colors.inkMuted, fontSize: 12, lineHeight: 20, textAlign: 'center' },
  balance: { width: '100%', marginTop: 24, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 20, backgroundColor: colors.card },
  balanceLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  balanceValue: { color: colors.creamDeep, fontSize: 24, fontWeight: '900' },
  inviteCard: { width: '100%', marginTop: 12, padding: 18, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  sectionTitle: { color: colors.cocoa, fontSize: 17, fontWeight: '800' },
  inviteHint: { marginTop: 6, color: colors.inkMuted, fontSize: 11, lineHeight: 18 },
  inviteRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  inviteInput: { flex: 1, minWidth: 0, height: 50, paddingHorizontal: 14, borderRadius: 14, color: colors.ink, backgroundColor: colors.paperDeep, fontSize: 15, letterSpacing: 1 },
  redeemButton: { minWidth: 88, height: 50, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.creamDeep },
  redeemText: { color: colors.card, fontSize: 14, fontWeight: '900' },
  notice: { marginTop: 12, padding: 12, borderRadius: 14, color: colors.cocoa, backgroundColor: colors.butterSoft, fontSize: 12, lineHeight: 19 },
  error: { color: colors.danger, backgroundColor: colors.blushSoft },
  primary: { marginTop: 14, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creamDeep },
  primaryText: { color: colors.card, fontSize: 14, fontWeight: '800' },
  planRow: { width: '100%', marginTop: 12, flexDirection: 'row', gap: 10 },
  plan: { flex: 1, minHeight: 156, padding: 17, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  planBest: { backgroundColor: colors.butterSoft, borderColor: colors.cream },
  best: { alignSelf: 'flex-start', marginBottom: 7, paddingVertical: 3, paddingHorizontal: 7, overflow: 'hidden', borderRadius: 8, color: colors.white, backgroundColor: colors.blush, fontSize: 8, fontWeight: '900' },
  planName: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  planCredits: { marginTop: 7, color: colors.inkMuted, fontSize: 10 },
  planPrice: { marginTop: 24, color: colors.ink, fontSize: 27, fontWeight: '900' },
  planSuffix: { marginTop: 4, color: colors.inkMuted, fontSize: 8 },
  promise: { width: '100%', marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.blushSoft },
  promiseTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  promiseText: { marginTop: 7, color: colors.inkMuted, fontSize: 10, lineHeight: 17 },
  backButton: { minHeight: 48, justifyContent: 'center', marginTop: 8 },
  backText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
