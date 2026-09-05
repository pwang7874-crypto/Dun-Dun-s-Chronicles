import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MainTabParamList, RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors, typography } from '../../design-system/theme';
import type { LocalProfile, RecordAggregate } from '../../domain/models';
import { monthRange } from '../../shared/dates';
import { archiveEnd, archiveStart, previewAssetFor } from '../shared/recordAssets';

const diaryGirlMascot = require('../../assets/images/diary-girl-mascot.png');

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

export const ProfileScreen = ({ navigation }: Props) => {
  const { repository, creativeRepository, assetStore, now } = useServices();
  const [monthRecords, setMonthRecords] = useState<RecordAggregate[]>([]);
  const [archive, setArchive] = useState<RecordAggregate[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [profile, setProfile] = useState<LocalProfile | null>(null);

  const load = useCallback(async () => {
    const range = monthRange(now());
    const [monthly, all, favorites, localProfile] = await Promise.all([
      repository.findSavedInRange(range.startISO, range.endISO),
      repository.findSavedInRange(archiveStart, archiveEnd),
      creativeRepository.listFavoriteIds(),
      creativeRepository.getProfile(),
    ]);
    setMonthRecords(monthly);
    setArchive(all);
    setFavoriteIds(favorites);
    setProfile(localProfile);
  }, [creativeRepository, now, repository]);

  useFocusEffect(useCallback(() => {
    load().catch(() => undefined);
  }, [load]));

  const shops = useMemo(() => [...new Set(
    archive.map(item => item.record.shopName?.trim()).filter((value): value is string => Boolean(value)),
  )], [archive]);
  const favorites = useMemo(() => {
    const chosen = archive.filter(item => favoriteIds.includes(item.record.id)).reverse();
    const suggestions = archive.filter(item => !favoriteIds.includes(item.record.id)).reverse();
    return [...chosen, ...suggestions].slice(0, 4);
  }, [archive, favoriteIds]);
  const recent = archive.slice(-6).reverse();
  const points = (profile?.points ?? 0) + archive.length * 10 + shops.length * 5;
  const stampTarget = Math.max(12, Math.ceil(Math.max(shops.length + 1, 12) / 12) * 12);

  const toggleFavorite = async (recordId: string) => {
    const favorite = !favoriteIds.includes(recordId);
    await creativeRepository.setFavorite(recordId, favorite, now().toISOString());
    setFavoriteIds(current => favorite ? [recordId, ...current] : current.filter(id => id !== recordId));
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <PaperTexture />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>我的饮品柜</Text>
            <Text style={styles.pinkWave}>〜〜</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable accessibilityLabel="通知" onPress={() => Alert.alert('饮品提醒', `本月已经记录 ${monthRecords.length} 杯，解锁 ${shops.length} 枚店铺印章。`)} style={styles.iconButton}>
              <Text style={styles.iconText}>♧</Text>
              {monthRecords.length ? <View style={styles.noticeDot} /> : null}
            </Pressable>
            <Pressable accessibilityLabel="设置" onPress={() => navigation.navigate('PrivacyData')} style={styles.iconButton}>
              <Text style={styles.iconText}>⚙</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.avatarSticker}>
            <Image source={diaryGirlMascot} resizeMode="contain" style={styles.avatarImage} />
          </View>
          <View style={styles.summaryNumbers}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>本月记录</Text>
              <Text style={styles.summaryValue}>{monthRecords.length}</Text>
              <Text style={styles.summaryUnit}>杯</Text>
            </View>
            <View style={styles.summaryRule} />
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>贴纸收藏</Text>
              <Text style={styles.summaryValue}>{shops.length}</Text>
              <Text style={styles.summaryUnit}>/ {stampTarget} 枚</Text>
            </View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, (shops.length / stampTarget) * 100)}%` }]} /></View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>我的最爱</Text>
            <Text style={styles.sectionHint}>点爱心收藏</Text>
          </View>
          {favorites.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoriteRail}>
              {favorites.map((item, index) => {
                const asset = previewAssetFor(item);
                const selected = favoriteIds.includes(item.record.id);
                return (
                  <Pressable key={item.record.id} onPress={() => toggleFavorite(item.record.id).catch(() => undefined)} style={styles.favoriteItem}>
                    <View style={[styles.favoritePhotoWrap, favoriteTones[index % favoriteTones.length]]}>
                      {asset ? (
                        <Image source={{ uri: assetStore.resolveUri(asset) }} resizeMode="contain" style={styles.favoritePhoto} />
                      ) : (
                        <View style={styles.favoriteNoPhoto}>
                          <Text style={styles.favoriteNoPhotoCharm}>☕︎</Text>
                          <Text style={styles.favoriteNoPhotoText}>文字杯</Text>
                        </View>
                      )}
                      <Text style={[styles.heart, selected && styles.heartSelected]}>{selected ? '♥' : '♡'}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.favoriteName}>{item.record.beverageName || item.record.category || '这一杯'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : <Text style={styles.emptyText}>记录第一杯后，就可以把喜欢的饮品收进这里。</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>历史海报</Text>
            <Text style={styles.sectionHint}>{archive.length} 杯  ›</Text>
          </View>
          {recent.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRail}>
              {recent.map((item, index) => {
                const asset = previewAssetFor(item);
                return (
                  <Pressable key={item.record.id} onPress={() => navigation.navigate('Detail', { recordId: item.record.id })} style={[styles.posterCard, index % 2 === 0 ? styles.turnLeft : styles.turnRight]}>
                    <Text numberOfLines={2} style={styles.posterHeadline}>{posterHeadlines[index % posterHeadlines.length]}</Text>
                    {asset ? (
                      <Image source={{ uri: assetStore.resolveUri(asset) }} style={styles.posterImage} />
                    ) : (
                      <View style={[styles.posterImage, styles.posterNoPhoto]}>
                        <Text style={styles.posterNoPhotoCharm}>♡</Text>
                        <Text style={styles.posterNoPhotoText}>没照片{`\n`}也可爱</Text>
                      </View>
                    )}
                    <Text numberOfLines={1} style={styles.posterMeta}>{item.record.shopName || '今日小店'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : <Text style={styles.emptyText}>保存过的饮品作品会按时间排在这里。</Text>}
        </View>

        <Pressable onPress={() => navigation.navigate('Membership')} style={styles.memberCard}>
          <View style={styles.crown}><Text style={styles.crownText}>♛</Text></View>
          <View style={styles.memberCopy}>
            <View style={styles.memberTitleLine}>
              <Text style={styles.memberTitle}>会员中心</Text>
              <Text style={styles.memberTag}>{profile?.membershipTier === 'free' ? '免费版' : '已开通'}</Text>
            </View>
            <Text style={styles.memberNote}>{profile?.membershipTier === 'free' ? `AI 试用 ${profile?.aiCredits ?? 1} 次` : '今日 AI 1 次'} · 免费功能永久免费</Text>
          </View>
          <View style={styles.points}><Text style={styles.pointsLabel}>积分余额</Text><Text style={styles.pointsValue}>{points}</Text></View>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('PrivacyData')} style={styles.menuRow}>
          <Text style={styles.menuIcon}>♢</Text><Text style={styles.menuTitle}>隐私与数据</Text><Text style={styles.menuMeta}>本机保存  ›</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Account')} style={styles.loginRow}>
          <Text style={styles.loginIcon}>♙</Text><Text style={styles.loginText}>登录 / 注册</Text><Text style={styles.loginArrow}>›</Text>
        </Pressable>

        <View style={styles.moreCard}>
          <Text style={styles.moreTitle}>更多收藏</Text>
          <View style={styles.moreGrid}>
            {[
              ['✿', '饮印册', 'StampAlbum'],
              ['⌖', '饮品护照', 'Passport'],
              ['⌕', '搜索', 'Search'],
              ['▤', '本月小刊', 'MonthlyRecap'],
              ['☻', '新手指南', 'Onboarding'],
            ].map(([icon, label, route]) => (
              <Pressable
                key={route}
                onPress={() => route === 'Onboarding'
                  ? navigation.navigate('Onboarding', { replay: true })
                  : navigation.navigate(route as 'StampAlbum' | 'Passport' | 'Search' | 'MonthlyRecap')}
                style={styles.moreItem}
              >
                <Text style={styles.moreIcon}>{icon}</Text>
                <Text style={styles.moreLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const favoriteTones = [
  { backgroundColor: '#F8DAA9' }, { backgroundColor: '#E8D6BE' },
  { backgroundColor: '#F5C9CD' }, { backgroundColor: '#DCE9D9' },
];
const posterHeadlines = ['下午好！', '超满足！', '今日快乐\n水果条', 'COOL!'];

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 17, paddingTop: 5, paddingBottom: 30, gap: 10 },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  titleWrap: { position: 'absolute', left: 55, right: 55, top: 7, alignItems: 'center' },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 27, fontWeight: '900' },
  pinkWave: { alignSelf: 'center', marginTop: -4, color: colors.blush, fontSize: 26, fontWeight: '900', transform: [{ rotate: '-5deg' }] },
  topActions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.ink, fontSize: 23 },
  noticeDot: { position: 'absolute', top: 5, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blush },
  summary: { minHeight: 112, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 1 },
  avatarSticker: { width: 119, height: 112, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 118, height: 118 },
  hair: { position: 'absolute', top: 15, width: 65, height: 55, borderTopLeftRadius: 35, borderTopRightRadius: 35, backgroundColor: '#9C7966' },
  face: { width: 59, height: 63, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8D8C3', borderWidth: 4, borderColor: colors.white },
  faceText: { marginTop: 9, color: colors.ink, fontSize: 13, fontWeight: '700' },
  miniCup: { position: 'absolute', right: 5, bottom: 5, width: 43, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cocoa, borderWidth: 4, borderColor: colors.white, transform: [{ rotate: '5deg' }] },
  miniCupHeart: { color: colors.blushSoft, fontSize: 20 },
  avatarStar: { position: 'absolute', left: 1, bottom: 3, color: colors.sky, fontSize: 27 },
  summaryNumbers: { flex: 1, marginLeft: 5 },
  summaryLine: { minHeight: 35, flexDirection: 'row', alignItems: 'baseline' },
  summaryLabel: { width: 78, color: colors.ink, fontSize: 11, fontWeight: '700' },
  summaryValue: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  summaryUnit: { marginLeft: 5, color: colors.inkMuted, fontSize: 10 },
  summaryRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  progressTrack: { marginTop: 2, marginLeft: 78, height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.paperDeep },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.mint },
  card: { padding: 14, borderRadius: 21, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontFamily: typography.title, fontSize: 14, fontWeight: '900' },
  sectionHint: { color: colors.inkMuted, fontSize: 9 },
  favoriteRail: { paddingTop: 12, gap: 10 },
  favoriteItem: { width: 72, alignItems: 'center' },
  favoritePhotoWrap: { width: 68, height: 68, padding: 6, borderRadius: 19 },
  favoritePhoto: { flex: 1, borderRadius: 14, resizeMode: 'contain' },
  favoriteNoPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.52)' },
  favoriteNoPhotoCharm: { color: colors.creamDeep, fontSize: 19 },
  favoriteNoPhotoText: { marginTop: 2, color: colors.cocoa, fontSize: 7, fontWeight: '800' },
  heart: { position: 'absolute', right: 2, bottom: 1, color: colors.white, fontSize: 17, textShadowColor: colors.blush, textShadowRadius: 2 },
  heartSelected: { color: colors.blush },
  favoriteName: { marginTop: 6, width: 70, color: colors.ink, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  posterRail: { paddingTop: 12, gap: 8 },
  posterCard: { width: 93, height: 124, padding: 7, overflow: 'hidden', backgroundColor: colors.butterSoft, borderWidth: 1, borderColor: colors.line },
  posterHeadline: { height: 29, color: colors.ink, fontSize: 12, lineHeight: 14, fontWeight: '900' },
  posterImage: { alignSelf: 'center', marginTop: 3, width: 61, height: 66, borderRadius: 17, borderWidth: 3, borderColor: colors.white },
  posterNoPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blushSoft },
  posterNoPhotoCharm: { color: colors.blush, fontSize: 19, fontWeight: '900' },
  posterNoPhotoText: { marginTop: 3, color: colors.cocoa, fontSize: 7, lineHeight: 10, fontWeight: '800', textAlign: 'center' },
  posterMeta: { marginTop: 5, color: colors.inkMuted, fontSize: 7, textAlign: 'center' },
  turnLeft: { transform: [{ rotate: '-1deg' }] },
  turnRight: { transform: [{ rotate: '1deg' }], backgroundColor: colors.skySoft },
  emptyText: { paddingVertical: 20, color: colors.inkMuted, fontSize: 10, lineHeight: 17, textAlign: 'center' },
  memberCard: { minHeight: 64, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: '#FFF0C9' },
  crown: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creamDeep },
  crownText: { color: colors.white, fontSize: 19 },
  memberCopy: { flex: 1, marginLeft: 10 },
  memberTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  memberTag: { paddingVertical: 2, paddingHorizontal: 6, overflow: 'hidden', borderRadius: 7, color: colors.cocoa, backgroundColor: '#EADDB0', fontSize: 7 },
  memberNote: { marginTop: 4, color: colors.inkMuted, fontSize: 8 },
  points: { alignItems: 'flex-end' },
  pointsLabel: { color: colors.inkMuted, fontSize: 7 },
  pointsValue: { marginTop: 3, color: colors.ink, fontSize: 18, fontWeight: '900' },
  menuRow: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 17, backgroundColor: colors.card },
  menuIcon: { width: 30, color: colors.cocoa, fontSize: 19 },
  menuTitle: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700' },
  menuMeta: { color: colors.inkMuted, fontSize: 9 },
  loginRow: { minHeight: 53, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.card },
  loginIcon: { marginRight: 9, color: colors.ink, fontSize: 18 },
  loginText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  loginArrow: { position: 'absolute', right: 15, color: colors.inkMuted, fontSize: 20 },
  moreCard: { padding: 13, borderRadius: 18, backgroundColor: colors.card },
  moreTitle: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  moreGrid: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  moreItem: { width: '19%', minHeight: 51, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.paper },
  moreIcon: { color: colors.cocoa, fontSize: 18 },
  moreLabel: { marginTop: 4, color: colors.inkMuted, fontSize: 7.5, fontWeight: '700' },
});
