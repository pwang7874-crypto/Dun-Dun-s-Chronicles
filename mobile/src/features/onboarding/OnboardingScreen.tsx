import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors, radii, spacing } from '../../design-system/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;
type IllustrationKind = 'calendar' | 'life' | 'create' | 'share';

export const onboardingSlides: Array<{
  eyebrow: string;
  title: string;
  description: string;
  kind: IllustrationKind;
}> = [
  {
    eyebrow: '01 · 每日一杯',
    title: '把今天喝的，\n贴进日历里',
    description: '拍下奶茶或咖啡，再补上店铺、糖度和冷热。以后翻日历，就能看见每一天的小快乐。',
    kind: 'calendar',
  },
  {
    eyebrow: '02 · 今日旁白',
    title: '穿搭和美食，\n也一起贴下来',
    description: '可继续添加今日穿搭与搭配美食。会在手机本地抠出主体并生成奶油纸贴，原照片始终保留。',
    kind: 'life',
  },
  {
    eyebrow: '03 · 慢慢创作',
    title: '先免费修图，\n再选择 AI 灵感',
    description: '六款滤镜、裁切、调整和贴纸永久免费。AI 艺术化属于会员灵感，每天一次，失败不占次数。',
    kind: 'create',
  },
  {
    eyebrow: '04 · 留给以后',
    title: '做成小海报，\n分享也收藏',
    description: '生成适合小红书和朋友圈的海报与文案，也能在饮印册、护照和月刊里慢慢回看。',
    kind: 'share',
  },
];

const CalendarIllustration = () => (
  <View style={styles.calendarPaper}>
    <View style={styles.paperTape} />
    <View style={styles.calendarHeader}>
      <Text style={styles.calendarMonth}>9月</Text>
      <Text style={styles.calendarNote}>今天喝了什么？</Text>
    </View>
    <View style={styles.weekRow}>
      {['一', '二', '三', '四', '五', '六', '日'].map(day => (
        <Text key={day} style={styles.weekDay}>{day}</Text>
      ))}
    </View>
    <View style={styles.dayRow}>
      {[1, 2, 3, 4, 5, 6, 7].map(day => (
        <View key={day} style={[styles.dayCell, day === 3 && styles.dayCellActive]}>
          <Text style={styles.dayNumber}>{day}</Text>
          {day === 2 || day === 3 || day === 6 ? (
            <Text style={styles.miniDrink}>{day === 3 ? '🧋' : '☕︎'}</Text>
          ) : null}
        </View>
      ))}
    </View>
    <Text style={styles.calendarStar}>★</Text>
    <Text style={styles.calendarWave}>〜</Text>
  </View>
);

const LifeIllustration = () => (
  <View style={styles.collage}>
    <View style={[styles.collageCard, styles.outfitCard]}>
      <View style={styles.personHead} />
      <View style={styles.personDress} />
      <Text style={styles.collageLabel}>今日穿搭 ♡</Text>
    </View>
    <View style={[styles.collageCard, styles.drinkCard]}>
      <Text style={styles.bigEmoji}>🧋</Text>
      <Text style={styles.collageLabel}>这一杯</Text>
    </View>
    <View style={[styles.collageCard, styles.foodCard]}>
      <Text style={styles.bigEmoji}>🍰</Text>
      <Text style={styles.collageLabel}>咖啡搭子</Text>
    </View>
    <View style={styles.cutoutBadge}><Text style={styles.cutoutBadgeText}>本机生成奶油纸贴</Text></View>
  </View>
);

const CreateIllustration = () => (
  <View style={styles.createPaper}>
    <View style={styles.filterPhoto}><Text style={styles.filterCup}>☕︎</Text></View>
    <View style={styles.filterRail}>
      {[colors.blushSoft, colors.butterSoft, colors.skySoft, '#E8D6BE'].map((tone, index) => (
        <View key={tone} style={[styles.filterChip, { backgroundColor: tone }, index === 1 && styles.filterChipActive]}>
          <Text style={styles.filterChipText}>{['胶片', '奶油', '雨天', '可可'][index]}</Text>
        </View>
      ))}
    </View>
    <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>免费滤镜 6 款</Text></View>
    <View style={styles.aiBadge}><Text style={styles.aiCrown}>♛</Text><Text style={styles.aiBadgeText}>AI 灵感 · 1/天</Text></View>
  </View>
);

const ShareIllustration = () => (
  <View style={styles.shareScene}>
    <View style={styles.poster}>
      <View style={styles.posterTape} />
      <Text style={styles.posterTitle}>今天也要{`\n`}喝甜甜的</Text>
      <View style={styles.posterSun} />
      <Text style={styles.posterCup}>🧋</Text>
      <Text style={styles.posterDate}>2026.09.03</Text>
    </View>
    <View style={styles.stamp}><Text style={styles.stampText}>DUNDUN{`\n`}DIARY</Text></View>
    <View style={styles.shareTags}><Text style={styles.shareTagsText}># 每日一杯　# 奶茶日常</Text></View>
  </View>
);

const Illustration = ({ kind }: { kind: IllustrationKind }) => (
  <View accessibilityElementsHidden style={styles.illustrationStage}>
    {kind === 'calendar' ? <CalendarIllustration /> : null}
    {kind === 'life' ? <LifeIllustration /> : null}
    {kind === 'create' ? <CreateIllustration /> : null}
    {kind === 'share' ? <ShareIllustration /> : null}
  </View>
);

export const OnboardingScreen = ({ route, navigation }: Props) => {
  const { creativeRepository, now } = useServices();
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const replay = route.params?.replay === true;
  const slide = onboardingSlides[page] ?? onboardingSlides[0]!;
  const lastPage = page === onboardingSlides.length - 1;

  const close = async () => {
    if (replay) {
      navigation.goBack();
      return;
    }
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const profile = await creativeRepository.getProfile();
      const completedAt = now().toISOString();
      await creativeRepository.saveProfile({
        ...profile,
        onboardingCompletedAt: completedAt,
        updatedAt: completedAt,
      });
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch {
      setError('这页暂时没有合上，请再点一次。你的记录不会受影响。');
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (lastPage) {
      close().catch(() => undefined);
      return;
    }
    setPage(value => value + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <PaperTexture />
      <View style={styles.topBar}>
        <View style={styles.brandLockup}>
          <Text style={styles.brand}>吨吨记</Text>
          <View
            accessible
            accessibilityLabel="来自小酱油的贴心引导"
            style={styles.guideSignature}
          >
            <Text accessibilityElementsHidden style={styles.guideSparkle}>✦</Text>
            <Text style={styles.guideSignatureText}>来自小酱油的贴心引导</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={replay ? '关闭教程' : '跳过教程'}
          disabled={busy}
          onPress={() => close().catch(() => undefined)}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>{replay ? '关闭' : '跳过'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Illustration kind={slide.kind} />
        <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View accessibilityLabel={`第 ${page + 1} 页，共 ${onboardingSlides.length} 页`} style={styles.dots}>
          {onboardingSlides.map((item, index) => (
            <View key={item.kind} style={[styles.dot, index === page && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={lastPage ? (replay ? '看完啦' : '开始记录今天') : '下一页'}
          disabled={busy}
          onPress={next}
          style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed, busy && styles.nextButtonDisabled]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.nextText}>{lastPage ? (replay ? '看完啦' : '开始记录今天') : '下一页　→'}</Text>
          )}
        </Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    minHeight: 66,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: { alignItems: 'flex-start', gap: 4 },
  brand: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  guideSignature: {
    minHeight: 24,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.butterSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  guideSparkle: { color: colors.creamDeep, fontSize: 10, fontWeight: '900' },
  guideSignatureText: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  skipButton: { minWidth: 52, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: colors.inkMuted, fontSize: 13, fontWeight: '700' },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  illustrationStage: {
    height: 282,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  eyebrow: { marginTop: spacing.lg, color: colors.creamDeep, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: spacing.sm, color: colors.ink, fontSize: 31, lineHeight: 41, fontWeight: '900' },
  description: { marginTop: spacing.md, color: colors.inkMuted, fontSize: 14, lineHeight: 23 },
  bottomBar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  dots: { height: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotActive: { width: 21, backgroundColor: colors.creamDeep },
  nextButton: { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: colors.ink },
  nextButtonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  nextButtonDisabled: { opacity: 0.6 },
  nextText: { color: colors.white, fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  error: { marginTop: spacing.sm, color: colors.danger, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  calendarPaper: { width: 266, height: 194, padding: 18, borderRadius: 24, backgroundColor: '#FFF9EF', borderWidth: 1, borderColor: colors.line, transform: [{ rotate: '-1deg' }] },
  paperTape: { position: 'absolute', top: -8, alignSelf: 'center', width: 74, height: 24, backgroundColor: 'rgba(224, 207, 161, 0.6)', transform: [{ rotate: '2deg' }] },
  calendarHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  calendarMonth: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  calendarNote: { color: colors.blush, fontSize: 10, fontWeight: '900' },
  weekRow: { marginTop: 17, flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { width: 25, color: colors.inkMuted, fontSize: 9, textAlign: 'center' },
  dayRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { width: 28, height: 61, alignItems: 'center', paddingTop: 5, borderRadius: 11, backgroundColor: colors.paperDeep },
  dayCellActive: { backgroundColor: colors.butterSoft, borderWidth: 2, borderColor: colors.creamDeep },
  dayNumber: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  miniDrink: { marginTop: 6, fontSize: 17 },
  calendarStar: { position: 'absolute', right: 17, bottom: 7, color: colors.butter, fontSize: 24, transform: [{ rotate: '9deg' }] },
  calendarWave: { position: 'absolute', left: 17, bottom: 5, color: colors.sky, fontSize: 25 },
  collage: { width: 274, height: 224 },
  collageCard: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: colors.white, shadowColor: colors.cocoa, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  outfitCard: { left: 4, top: 12, width: 112, height: 146, borderRadius: 37, backgroundColor: colors.skySoft, transform: [{ rotate: '-5deg' }] },
  drinkCard: { right: 8, top: 1, width: 121, height: 133, borderRadius: 42, backgroundColor: colors.butterSoft, transform: [{ rotate: '4deg' }] },
  foodCard: { right: 26, bottom: 1, width: 111, height: 92, borderRadius: 31, backgroundColor: colors.blushSoft, transform: [{ rotate: '-2deg' }] },
  personHead: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F4CDB7', borderWidth: 5, borderColor: colors.cocoa },
  personDress: { marginTop: -2, width: 55, height: 55, borderTopLeftRadius: 23, borderTopRightRadius: 23, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, backgroundColor: colors.blush },
  bigEmoji: { fontSize: 46 },
  collageLabel: { marginTop: 5, color: colors.ink, fontSize: 10, fontWeight: '900' },
  cutoutBadge: { position: 'absolute', left: 13, bottom: 4, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.ink },
  cutoutBadgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  createPaper: { width: 268, height: 213, padding: 17, borderRadius: 28, backgroundColor: '#FFF9EF', borderWidth: 1, borderColor: colors.line },
  filterPhoto: { alignSelf: 'center', width: 116, height: 106, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: '#E7C99F', borderWidth: 6, borderColor: colors.white, transform: [{ rotate: '-2deg' }] },
  filterCup: { fontSize: 51 },
  filterRail: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between' },
  filterChip: { width: 53, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  filterChipActive: { borderWidth: 2, borderColor: colors.creamDeep },
  filterChipText: { color: colors.ink, fontSize: 8, fontWeight: '800' },
  freeBadge: { position: 'absolute', left: -8, top: 25, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.sky },
  freeBadgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  aiBadge: { position: 'absolute', right: -6, top: 46, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.pill, backgroundColor: colors.ink },
  aiCrown: { color: colors.butter, fontSize: 12 },
  aiBadgeText: { color: colors.white, fontSize: 8, fontWeight: '900' },
  shareScene: { width: 266, height: 225 },
  poster: { position: 'absolute', left: 28, top: 4, width: 166, height: 210, padding: 15, overflow: 'hidden', borderRadius: 8, backgroundColor: colors.butterSoft, borderWidth: 6, borderColor: colors.white, transform: [{ rotate: '-3deg' }], shadowColor: colors.cocoa, shadowOpacity: 0.12, shadowRadius: 9, shadowOffset: { width: 0, height: 5 } },
  posterTape: { position: 'absolute', top: -4, left: 52, width: 57, height: 18, backgroundColor: 'rgba(239, 164, 159, 0.7)' },
  posterTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '900' },
  posterSun: { position: 'absolute', right: 14, top: 71, width: 92, height: 92, borderRadius: 46, backgroundColor: colors.blushSoft },
  posterCup: { position: 'absolute', right: 29, top: 87, fontSize: 57 },
  posterDate: { position: 'absolute', right: 12, bottom: 10, color: colors.ink, fontSize: 9, fontWeight: '800' },
  stamp: { position: 'absolute', right: 0, top: 22, width: 79, height: 79, alignItems: 'center', justifyContent: 'center', borderRadius: 40, borderWidth: 3, borderColor: colors.creamDeep, transform: [{ rotate: '8deg' }] },
  stampText: { color: colors.creamDeep, fontSize: 9, lineHeight: 12, fontWeight: '900', textAlign: 'center' },
  shareTags: { position: 'absolute', right: 3, bottom: 18, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 7, backgroundColor: colors.skySoft, transform: [{ rotate: '3deg' }] },
  shareTagsText: { color: colors.ink, fontSize: 8, fontWeight: '800' },
});
