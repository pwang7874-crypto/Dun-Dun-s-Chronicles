import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { AppError } from '../../domain/errors';
import type { PhotoAssetV1, RecordAggregate } from '../../domain/models';
import { PrimaryButton } from '../../design-system/components/Buttons';
import { ErrorNotice } from '../../design-system/components/ErrorNotice';
import { LoadingView } from '../../design-system/components/LoadingView';
import { PaperCutoutSticker } from '../../design-system/components/PaperCutoutSticker';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors, radii, spacing } from '../../design-system/theme';
import { displayDate } from '../../shared/dates';
import { getFilterPreset } from '../../infrastructure/rendering/filters';
import { journalStickerAssetFor } from '../shared/recordAssets';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

const byId = (
  aggregate: RecordAggregate,
  id?: string,
): PhotoAssetV1 | undefined =>
  id ? aggregate.assets.find(asset => asset.id === id) : undefined;

export const RecordDetailScreen = ({ route, navigation }: Props) => {
  const { repository, assetStore } = useServices();
  const [aggregate, setAggregate] = useState<RecordAggregate>();
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      repository
        .findById(route.params.recordId)
        .then(result => {
          if (!mounted) {
            return;
          }
          if (result) {
            setAggregate(result);
            setError(undefined);
          } else {
            setError('这杯记录没有找到。');
          }
        })
        .catch(loadError => {
          if (mounted) {
            setError(
              loadError instanceof AppError
                ? loadError.userMessage
                : '这杯记录暂时没有打开。',
            );
          }
        });
      return () => {
        mounted = false;
      };
    }, [repository, route.params.recordId]),
  );

  const original = useMemo(
    () =>
      aggregate ? byId(aggregate, aggregate.record.originalAssetId) : undefined,
    [aggregate],
  );
  const display = useMemo(
    () =>
      aggregate ? byId(aggregate, aggregate.record.displayAssetId) : undefined,
    [aggregate],
  );

  if (!aggregate && !error) {
    return <LoadingView label="正在翻到这一页…" />;
  }
  if (!aggregate) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.centered}>
        <PaperTexture />
        <ErrorNotice message={error ?? '这杯记录暂时没有找到。'} />
      </SafeAreaView>
    );
  }

  const visibleAsset = showOriginal || !display ? original : display;
  const record = aggregate.record;
  const recipePreset = aggregate.recipe
    ? getFilterPreset(aggregate.recipe.presetId)
    : undefined;
  const facts = [
    record.category,
    record.shopName,
    record.sugarLevel,
    record.temperature,
    record.city,
    record.mood,
  ].filter((value): value is string => Boolean(value));
  const outfitSticker = aggregate.journalStickers?.find(item => item.category === 'outfit');
  const foodSticker = aggregate.journalStickers?.find(item => item.category === 'food');
  const outfitAsset = outfitSticker ? journalStickerAssetFor(aggregate, outfitSticker) : undefined;
  const foodAsset = foodSticker ? journalStickerAssetFor(aggregate, foodSticker) : undefined;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {visibleAsset && original ? (
          <Image
            source={{ uri: assetStore.resolveUri(visibleAsset) }}
            style={[
              styles.hero,
              { aspectRatio: original.pixelWidth / original.pixelHeight },
            ]}
            resizeMode="contain"
            accessibilityLabel={showOriginal ? '饮品原图' : '奶油晨光滤镜照片'}
          />
        ) : (
          <View accessibilityLabel="这页是没有照片的文字日记" style={styles.textOnlyHero}>
            <View style={styles.textOnlyBlob} />
            <Text style={styles.textOnlySpark}>✦ 〜 ♡</Text>
            <Image
              source={require('../../assets/images/diary-girl-mascot.png')}
              resizeMode="contain"
              style={styles.textOnlyMascot}
            />
            <Text style={styles.textOnlyTitle}>这天没拍照</Text>
            <Text style={styles.textOnlyCopy}>但你写下的这一杯，{`\n`}还是被好好收进了今天 ☕</Text>
          </View>
        )}

        {original ? <View style={styles.toggle}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !showOriginal }}
            onPress={() => setShowOriginal(false)}
            style={[styles.toggleItem, !showOriginal && styles.toggleSelected]}
          >
            <Text
              style={[
                styles.toggleText,
                !showOriginal && styles.toggleTextSelected,
              ]}
            >
              {recipePreset?.name ?? '成片'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: showOriginal }}
            onPress={() => setShowOriginal(true)}
            style={[styles.toggleItem, showOriginal && styles.toggleSelected]}
          >
            <Text
              style={[
                styles.toggleText,
                showOriginal && styles.toggleTextSelected,
              ]}
            >
              原图
            </Text>
          </Pressable>
        </View> : null}

        <View style={styles.story}>
          <Text style={styles.date}>{displayDate(record.occurredAt)}</Text>
          <Text style={styles.title}>
            {record.beverageName || '今天这一杯'}
          </Text>
          {facts.length ? (
            <Text style={styles.facts}>{facts.join(' · ')}</Text>
          ) : null}
          {record.note ? (
            <Text style={styles.note}>“{record.note}”</Text>
          ) : (
            <Text style={styles.noteMuted}>没有写下文字，也是一种完整。</Text>
          )}
          <View style={styles.recipeLine}>
            <Text style={styles.recipeLabel}>{original ? '滤镜配方' : '记录方式'}</Text>
            <Text style={styles.recipeValue}>
              {original
                ? `${recipePreset?.name ?? '原片'} ${Math.round((aggregate.recipe?.intensity ?? 0) * 100)}`
                : '奶油文字卡'}
            </Text>
          </View>
        </View>

        {aggregate.journalStickers?.length ? (
          <View style={styles.lifeDiary}>
            <View style={styles.lifeDiaryHeading}>
              <View>
                <Text style={styles.lifeDiaryBrand}>Dundun Journal</Text>
                <Text style={styles.lifeDiaryTitle}>把这一刻贴进今天</Text>
              </View>
              <Text style={styles.lifeDiaryDay}>{new Date(record.occurredAt).getDate()}</Text>
            </View>
            <View style={styles.lifeStickerGrid}>
              {outfitSticker && outfitAsset ? (
                <View style={[styles.lifeSticker, styles.lifeStickerLeft, outfitSticker.cutoutStatus === 'ready' && styles.lifeStickerCutout, outfitSticker.cutoutStatus === 'source-only' && styles.lifeStickerFramed]}>
                  {outfitSticker.cutoutStatus === 'ready' ? (
                    <View accessible accessibilityLabel={`穿搭奶油纸贴：${outfitSticker.label}`} style={styles.lifeStickerImage}>
                      <PaperCutoutSticker uri={assetStore.resolveUri(outfitAsset)} style={styles.lifeStickerImageFill} />
                    </View>
                  ) : (
                    <Image accessibilityLabel={`穿搭照片卡：${outfitSticker.label}`} source={{ uri: assetStore.resolveUri(outfitAsset) }} resizeMode="cover" style={styles.lifeStickerImage} />
                  )}
                  <Text numberOfLines={1} style={styles.lifeStickerLabel}>{outfitSticker.label}</Text>
                  <Text style={[styles.lifeStickerType, styles.lifeStickerOutfit]}>♧ 穿搭</Text>
                </View>
              ) : null}
              <View style={[styles.lifeSticker, styles.lifeStickerRight]}>
                {visibleAsset ? (
                  <Image accessibilityLabel="这一杯饮品贴纸" source={{ uri: assetStore.resolveUri(visibleAsset) }} resizeMode="contain" style={styles.lifeStickerImage} />
                ) : (
                  <View style={[styles.lifeStickerImage, styles.lifeTextOnlySticker]}>
                    <Text style={styles.lifeTextOnlyIcon}>☕</Text>
                    <Text style={styles.lifeTextOnlyCopy}>今天用文字{`\n`}记住这杯 ♡</Text>
                  </View>
                )}
                <Text numberOfLines={1} style={styles.lifeStickerLabel}>{record.beverageName || '今天这一杯'}</Text>
                <Text style={[styles.lifeStickerType, styles.lifeStickerDrink]}>♨ 饮品</Text>
              </View>
              {foodSticker && foodAsset ? (
                <View style={[styles.lifeSticker, styles.lifeStickerLeft, foodSticker.cutoutStatus === 'ready' && styles.lifeStickerCutout, foodSticker.cutoutStatus === 'source-only' && styles.lifeStickerFramed]}>
                  {foodSticker.cutoutStatus === 'ready' ? (
                    <View accessible accessibilityLabel={`美食奶油纸贴：${foodSticker.label}`} style={styles.lifeStickerImage}>
                      <PaperCutoutSticker uri={assetStore.resolveUri(foodAsset)} style={styles.lifeStickerImageFill} />
                    </View>
                  ) : (
                    <Image accessibilityLabel={`美食照片卡：${foodSticker.label}`} source={{ uri: assetStore.resolveUri(foodAsset) }} resizeMode="cover" style={styles.lifeStickerImage} />
                  )}
                  <Text numberOfLines={1} style={styles.lifeStickerLabel}>{foodSticker.label}</Text>
                  <Text style={[styles.lifeStickerType, styles.lifeStickerFood]}>♨ 美食</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <ErrorNotice message={error} />
        <PrimaryButton
          label="继续调整"
          onPress={() => navigation.navigate('Editor', { recordId: record.id })}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.popToTop()}
          style={styles.backToCalendar}
        >
          <Text style={styles.backToCalendarText}>回到月历</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.paper,
  },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  hero: {
    width: '100%',
    maxHeight: 520,
    minHeight: 280,
    borderRadius: radii.lg,
    backgroundColor: colors.black,
  },
  textOnlyHero: { minHeight: 300, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.cream, backgroundColor: colors.butterSoft },
  textOnlyBlob: { position: 'absolute', left: -58, bottom: -71, width: 190, height: 190, borderRadius: 95, backgroundColor: colors.blushSoft, opacity: 0.78 },
  textOnlySpark: { position: 'absolute', top: 25, right: 27, color: colors.blush, fontSize: 20, fontWeight: '800', transform: [{ rotate: '4deg' }] },
  textOnlyMascot: { width: 112, height: 112, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.76)', transform: [{ rotate: '-2deg' }] },
  textOnlyTitle: { marginTop: 13, color: colors.ink, fontSize: 21, fontWeight: '900' },
  textOnlyCopy: { marginTop: 7, color: colors.cocoa, fontSize: 12, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  toggle: {
    alignSelf: 'center',
    flexDirection: 'row',
    padding: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.paperDeep,
  },
  toggleItem: {
    minHeight: 40,
    minWidth: 108,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  toggleSelected: { backgroundColor: colors.card },
  toggleText: { color: colors.inkMuted, fontSize: 13 },
  toggleTextSelected: { color: colors.ink, fontWeight: '700' },
  story: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  date: { color: colors.creamDeep, fontSize: 12, letterSpacing: 1 },
  title: {
    marginTop: spacing.sm,
    color: colors.ink,
    fontSize: 27,
    lineHeight: 36,
    fontWeight: '700',
  },
  facts: { marginTop: spacing.sm, color: colors.inkMuted, fontSize: 14 },
  note: {
    marginTop: spacing.lg,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 28,
  },
  noteMuted: {
    marginTop: spacing.lg,
    color: colors.inkMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  recipeLine: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recipeLabel: { color: colors.inkMuted, fontSize: 12 },
  recipeValue: { color: colors.creamDeep, fontSize: 12, fontWeight: '700' },
  lifeDiary: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  lifeDiaryHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  lifeDiaryTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  lifeDiaryBrand: { color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  lifeDiaryDay: { color: colors.ink, fontSize: 27, fontWeight: '900' },
  lifeStickerGrid: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  lifeSticker: {
    width: '46%',
    minWidth: 128,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.paper,
  },
  lifeStickerLeft: { transform: [{ rotate: '-1.5deg' }] },
  lifeStickerRight: { transform: [{ rotate: '1.5deg' }] },
  lifeStickerCutout: { backgroundColor: 'transparent', overflow: 'visible' },
  lifeStickerFramed: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  lifeStickerImage: { width: '100%', height: 132 },
  lifeStickerImageFill: { width: '100%', height: '100%' },
  lifeTextOnlySticker: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm, backgroundColor: colors.butterSoft },
  lifeTextOnlyIcon: { color: colors.cocoa, fontSize: 28 },
  lifeTextOnlyCopy: { marginTop: 6, color: colors.cocoa, fontSize: 10, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  lifeStickerLabel: {
    marginTop: spacing.xs,
    color: colors.ink,
    fontSize: 12,
    textAlign: 'center',
  },
  lifeStickerType: { marginTop: 3, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  lifeStickerOutfit: { color: '#7474AD' },
  lifeStickerDrink: { color: colors.cocoa },
  lifeStickerFood: { color: colors.blush },
  backToCalendar: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToCalendarText: { color: colors.inkMuted, fontSize: 14 },
});
