import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ImageStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MainTabParamList, RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { ErrorNotice } from '../../design-system/components/ErrorNotice';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { PulsingHeart } from '../../design-system/components/PulsingHeart';
import { CuteMotionLayer, TwinklingStar } from '../../design-system/components/CuteMotionBits';
import { useReducedMotion } from '../../design-system/components/useReducedMotion';
import { colors, radii, typography } from '../../design-system/theme';
import type { RecordAggregate } from '../../domain/models';
import { calendarDays, localDateKey, monthRange, moveMonth } from '../../shared/dates';
import { archiveEnd, archiveStart, previewAssetFor } from '../shared/recordAssets';
import {
  calendarMonthDirectionForGesture,
  isHorizontalCalendarGesture,
} from './calendarMotion';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Diary'>,
  NativeStackScreenProps<RootStackParamList>
>;

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

type CalendarPhotoRevealProps = {
  active: boolean;
  children: ReactNode;
  delay: number;
  reducedMotion: boolean;
};

/** Mirrors the reference calendar's softly staggered photo “landing” motion. */
const CalendarPhotoReveal = ({ active, children, delay, reducedMotion }: CalendarPhotoRevealProps) => {
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (!active || reducedMotion) {
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const entrance = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(progress, {
        toValue: 1,
        damping: 11,
        stiffness: 165,
        mass: 0.72,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [active, delay, progress, reducedMotion]);

  return (
    <Animated.View
      style={{
        opacity: progress.interpolate({
          inputRange: [0, 0.34, 1],
          outputRange: [0, 0.58, 1],
        }),
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.72, 1],
              outputRange: [0.84, 1.045, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

export const CalendarScreen = ({ navigation }: Props) => {
  const { repository, assetStore, now } = useServices();
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const [month, setMonth] = useState(now());
  const [records, setRecords] = useState<RecordAggregate[]>([]);
  const [archive, setArchive] = useState<RecordAggregate[]>([]);
  const [draft, setDraft] = useState<RecordAggregate | null>(null);
  const [wallOpen, setWallOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string>();
  const [error, setError] = useState<string>();
  const monthTranslateX = useRef(new Animated.Value(0)).current;
  const monthOpacity = useRef(new Animated.Value(1)).current;
  const monthTransitionRunning = useRef(false);

  const changeMonth = useCallback((direction: -1 | 1) => {
    if (monthTransitionRunning.current) {
      return;
    }

    setSelectedDayKey(undefined);
    if (reducedMotion) {
      setMonth(value => moveMonth(value, direction));
      return;
    }

    monthTransitionRunning.current = true;
    Animated.parallel([
      Animated.timing(monthTranslateX, {
        toValue: direction * -28,
        duration: 145,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(monthOpacity, {
        toValue: 0.12,
        duration: 135,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        monthTransitionRunning.current = false;
        return;
      }

      setMonth(value => moveMonth(value, direction));
      monthTranslateX.setValue(direction * 36);
      Animated.parallel([
        Animated.spring(monthTranslateX, {
          toValue: 0,
          damping: 14,
          stiffness: 160,
          mass: 0.74,
          useNativeDriver: true,
        }),
        Animated.timing(monthOpacity, {
          toValue: 1,
          duration: 230,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        monthTransitionRunning.current = false;
      });
    });
  }, [monthOpacity, monthTranslateX, reducedMotion]);

  const monthSwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => isHorizontalCalendarGesture(gesture.dx, gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      const direction = calendarMonthDirectionForGesture(gesture.dx, gesture.vx);
      if (direction) {
        changeMonth(direction);
      }
    },
    onPanResponderTerminationRequest: () => true,
  }), [changeMonth]);

  const load = useCallback(async () => {
    try {
      const range = monthRange(month);
      const [monthRecords, allRecords, latestDraft] = await Promise.all([
        repository.findSavedInRange(range.startISO, range.endISO),
        repository.findSavedInRange(archiveStart, archiveEnd),
        repository.findLatestDraft(),
      ]);
      setRecords(monthRecords);
      setArchive(allRecords);
      setDraft(latestDraft);
      setError(undefined);
    } catch {
      setError('日历暂时没有打开，请稍后再试。');
    }
  }, [month, repository]);

  useFocusEffect(useCallback(() => {
    load().catch(() => undefined);
  }, [load]));

  const byDay = useMemo(() => {
    const map = new Map<string, RecordAggregate[]>();
    records.forEach(item => {
      const key = localDateKey(new Date(item.record.occurredAt));
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return map;
  }, [records]);

  const shopCount = useMemo(() => new Set(
    archive
      .map(item => item.record.shopName?.trim().toLocaleLowerCase('zh-CN'))
      .filter(Boolean),
  ).size, [archive]);
  const selectedDayRecords = useMemo(
    () => [...(selectedDayKey ? byDay.get(selectedDayKey) ?? [] : [])]
      .sort((left, right) => left.record.occurredAt.localeCompare(right.record.occurredAt)),
    [byDay, selectedDayKey],
  );
  const latest = records.at(-1);
  const latestAsset = latest ? previewAssetFor(latest) : undefined;
  const today = now();
  const dateText = today.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <PaperTexture />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <CuteMotionLayer active={isFocused} variant="sparkles" style={styles.headerMotion} />
          <View>
            <View style={styles.titleLine}>
              <Text style={styles.squiggle}>≈</Text>
              <Text style={styles.title}>今天喝了什么？</Text>
              <Text style={styles.squiggleRight}>∿</Text>
            </View>
            <Text style={styles.date}>{dateText}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={wallOpen ? '返回饮品日历' : '打开留影墙'}
            onPress={() => setWallOpen(value => !value)}
            style={({ pressed }) => [styles.wallButton, pressed && styles.pressed]}
          >
            <View style={styles.calendarGlyphTop} />
            {wallOpen ? <Text style={styles.wallButtonIcon}>▦</Text> : <PulsingHeart active={isFocused} size={25} style={styles.wallHeart} warmColor="#DE5F59" />}
          </Pressable>
        </View>

        {draft ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Editor', { recordId: draft.record.id })}
            style={styles.draftStrip}
          >
            <Text style={styles.draftText}>还有一杯没写完，继续补完  →</Text>
          </Pressable>
        ) : null}
        <ErrorNotice message={error} />

        {wallOpen ? (
          <View style={styles.wallCard}>
            <CuteMotionLayer active={isFocused} variant="charms" style={styles.cardMotion} />
            <View style={styles.wallHeading}>
              <Text style={styles.monthTitle}>本月留影墙</Text>
              <Text style={styles.wallCount}>{records.length} 杯</Text>
            </View>
            <View style={styles.wallGrid}>
              {records.map((item, index) => {
                const asset = previewAssetFor(item);
                return (
                  <Pressable
                    key={item.record.id}
                    onPress={() => navigation.navigate('Detail', { recordId: item.record.id })}
                    style={[styles.wallPhoto, index % 2 === 0 ? styles.turnLeft : styles.turnRight]}
                  >
                    {asset ? (
                      <Image source={{ uri: assetStore.resolveUri(asset) }} style={styles.wallImage as ImageStyle} />
                    ) : (
                      <View style={[styles.wallImage, styles.noPhotoWall]}>
                        <Text style={styles.noPhotoWallCharm}>☕︎ ♡</Text>
                        <Text style={styles.noPhotoWallText}>这一杯先用文字抱住</Text>
                      </View>
                    )}
                    <Text numberOfLines={1} style={styles.wallName}>
                      {item.record.beverageName || '今天这一杯'}
                    </Text>
                  </Pressable>
                );
              })}
              {!records.length ? <Text style={styles.emptyWall}>这个月的第一杯，等你贴上来。</Text> : null}
            </View>
          </View>
        ) : (
          <View style={styles.calendarCard}>
            <CuteMotionLayer active={isFocused} variant="charms" style={styles.cardMotion} />
            <Animated.View
              accessibilityHint="也可以左右滑动切换月份"
              style={{ opacity: monthOpacity, transform: [{ translateX: monthTranslateX }] }}
              {...monthSwipeResponder.panHandlers}
            >
              <View style={styles.monthHeader}>
                <View style={styles.monthCenter}>
                  <View style={styles.monthTitleLine}>
                    <Text style={styles.monthTitle}>{month.getMonth() + 1}月</Text>
                    <Text style={styles.swipeHint}>轻轻滑一滑</Text>
                  </View>
                  <View style={styles.monthUnderline} />
                </View>
                <View style={styles.monthNavigation}>
                  <Pressable accessibilityLabel="上个月" hitSlop={12} onPress={() => changeMonth(-1)} style={({ pressed }) => pressed && styles.monthArrowPressed}>
                    <Text style={styles.monthArrow}>‹</Text>
                  </Pressable>
                  <Pressable accessibilityLabel="下个月" hitSlop={12} onPress={() => changeMonth(1)} style={({ pressed }) => pressed && styles.monthArrowPressed}>
                    <Text style={styles.monthArrow}>›</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.weekRow}>
                {weekdays.map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}
              </View>
              <View style={styles.grid}>
                {calendarDays(month).map((day, index) => {
                  const dayRecords = byDay.get(day.key) ?? [];
                  const item = dayRecords[0];
                  const photoRecords = dayRecords.filter(record => Boolean(previewAssetFor(record)));
                  const hasPhoto = photoRecords.length > 0;
                  return (
                    <Pressable
                      key={day.key}
                      disabled={!item}
                      accessibilityLabel={`${day.dayOfMonth}日${item ? `，${dayRecords.length}杯` : ''}`}
                      onPress={() => item && setSelectedDayKey(day.key)}
                      style={({ pressed }) => [styles.dayCell, pressed && styles.dayCellPressed]}
                    >
                      <Text style={[styles.dayNumber, !day.belongsToMonth && styles.outside]}>{day.dayOfMonth}</Text>
                      {item ? (
                        <CalendarPhotoReveal
                          active={isFocused}
                          delay={Math.min(260, 18 * index)}
                          reducedMotion={reducedMotion}
                        >
                          {hasPhoto ? (
                            <View style={[styles.photoStack, index % 3 === 0 ? styles.turnLeft : index % 3 === 1 ? styles.turnRight : undefined]}>
                              {photoRecords.slice(0, 3).map((record, stackIndex) => {
                                const stackAsset = previewAssetFor(record);
                                return stackAsset ? (
                                  <View key={record.record.id} style={[styles.stackPhoto, stackIndex === 0 ? styles.stackPhotoFirst : stackIndex === 1 ? styles.stackPhotoSecond : styles.stackPhotoThird]}>
                                    <Image source={{ uri: assetStore.resolveUri(stackAsset) }} resizeMode="contain" style={styles.dayPhoto as ImageStyle} />
                                  </View>
                                ) : null;
                              })}
                              {dayRecords.length > 1 ? <Text style={styles.countBadge}>{dayRecords.length}杯</Text> : null}
                            </View>
                          ) : (
                            <View style={styles.noPhotoDay}>
                              <Text style={styles.noPhotoDayText}>有一杯♡</Text>
                            </View>
                          )}
                        </CalendarPhotoReveal>
                      ) : (
                        day.isToday ? <View style={styles.todayDot} /> : null
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.monthStat]}>
            <Text style={styles.statLabel}>本月</Text>
            <View style={styles.statNumberLine}>
              <Text style={styles.statNumber}>{records.length}</Text>
              <Text style={styles.statUnit}>杯</Text>
            </View>
            {latestAsset ? (
              <View style={styles.latestSticker}>
                <Image source={{ uri: assetStore.resolveUri(latestAsset) }} resizeMode="contain" style={styles.latestPhoto as ImageStyle} />
              </View>
            ) : <Text style={styles.tinyHeart}>♡</Text>}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('StampAlbum')}
            style={({ pressed }) => [styles.statCard, styles.stampStat, pressed && styles.pressed]}
          >
            <Text style={styles.statLabel}>解锁</Text>
            <View style={styles.statNumberLine}>
              <Text style={styles.statNumber}>{shopCount}</Text>
              <Text style={styles.statUnit}>枚印章</Text>
            </View>
            <View style={styles.bigStar}><Text style={styles.bigStarText}>★</Text></View>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selectedDayKey)}
        onRequestClose={() => setSelectedDayKey(undefined)}
      >
        <Pressable style={styles.dayModalBackdrop} onPress={() => setSelectedDayKey(undefined)}>
          <Pressable style={styles.daySheet} onPress={event => event.stopPropagation()}>
            <View style={styles.daySheetHandle} />
            <View style={styles.daySheetHeader}>
              <View>
                <Text style={styles.daySheetEyebrow}>TODAY'S LITTLE CUPS</Text>
                <Text style={styles.daySheetTitle}>
                  {selectedDayKey ? `${Number(selectedDayKey.slice(5, 7))}月${Number(selectedDayKey.slice(8, 10))}日 · ${selectedDayRecords.length}杯` : ''}
                </Text>
              </View>
              <Pressable accessibilityLabel="关闭当天饮品" hitSlop={12} onPress={() => setSelectedDayKey(undefined)} style={styles.daySheetClose}>
                <Text style={styles.daySheetCloseText}>×</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayDrinkRail}>
              {selectedDayRecords.map((item, index) => {
                const asset = previewAssetFor(item);
                const recipe = [item.record.sugarLevel, item.record.temperature].filter(Boolean).join(' · ');
                return (
                  <View key={item.record.id} style={[styles.dayDrinkCard, index % 2 === 0 ? styles.dayCardLeft : styles.dayCardRight]}>
                    <View style={styles.dayDrinkPhotoWrap}>
                      {asset ? (
                        <Image source={{ uri: assetStore.resolveUri(asset) }} resizeMode="contain" style={styles.dayDrinkPhoto} />
                      ) : (
                        <View style={styles.noPhotoDetail}>
                          <Text style={styles.noPhotoDetailCharm}>☕︎</Text>
                          <Text style={styles.noPhotoDetailTitle}>没放照片，也是一杯好日子</Text>
                          <Text style={styles.noPhotoDetailCopy}>文字已经替你把味道留住啦</Text>
                        </View>
                      )}
                      <Text style={styles.dayDrinkIndex}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.dayDrinkName}>{item.record.beverageName || '今天这一杯'}</Text>
                    <Text numberOfLines={1} style={styles.dayDrinkShop}>{item.record.shopName || '还没写店铺'}{recipe ? ` · ${recipe}` : ''}</Text>
                    <View style={styles.dayDrinkActions}>
                      <Pressable onPress={() => { setSelectedDayKey(undefined); navigation.navigate('Detail', { recordId: item.record.id }); }} style={styles.daySmallButton}>
                        <Text style={styles.daySmallButtonText}>查看</Text>
                      </Pressable>
                      <Pressable onPress={() => { setSelectedDayKey(undefined); navigation.navigate('Editor', { recordId: item.record.id }); }} style={styles.daySmallButton}>
                        <Text style={styles.daySmallButtonText}>调整</Text>
                      </Pressable>
                    </View>
                    <View style={styles.dayDrinkActions}>
                      <Pressable onPress={() => { setSelectedDayKey(undefined); navigation.navigate('Create', { recordId: item.record.id }); }} style={[styles.daySmallButton, styles.dayCreateButton]}>
                        <Text style={styles.dayCreateButtonText}>创作</Text>
                      </Pressable>
                      <Pressable onPress={() => { setSelectedDayKey(undefined); navigation.navigate('Publish', { recordId: item.record.id }); }} style={[styles.daySmallButton, styles.dayPublishButton]}>
                        <Text style={styles.dayPublishButtonText}>发布</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.daySheetActions}>
              <Pressable onPress={() => { setSelectedDayKey(undefined); navigation.navigate('PhotoSource'); }} style={styles.dayAddButton}>
                <Text style={styles.dayAddButtonText}>＋ 再记一杯</Text>
              </Pressable>
              {selectedDayRecords.length > 1 ? (
                <Pressable onPress={() => { const dayKey = selectedDayKey; setSelectedDayKey(undefined); if (dayKey) navigation.navigate('Publish', { dayKey }); }} style={styles.dayCollectionButton}>
                  <Text style={styles.dayCollectionButtonText}>生成今日合集海报</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.daySheetTip}>每杯独立保存 · 照片、口味、贴纸与排版互不覆盖</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="记录新的一杯"
        onPress={() => navigation.navigate('PhotoSource')}
        style={({ pressed }) => [styles.addButton, pressed && styles.addPressed]}
      >
        <TwinklingStar active={isFocused} color={colors.butterSoft} delay={420} size={10} style={styles.addTwinkle} />
        <Text style={styles.addText}>＋</Text>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 18, paddingTop: 7, paddingBottom: 95, gap: 11 },
  header: { minHeight: 91, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerMotion: { opacity: 0.75 },
  cardMotion: { opacity: 0.72 },
  titleLine: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#2F201C', fontFamily: typography.display, fontSize: 29, fontWeight: '900', letterSpacing: 0.2 },
  squiggle: { marginRight: 3, color: colors.blush, fontSize: 26, fontWeight: '900', transform: [{ rotate: '35deg' }] },
  squiggleRight: { marginLeft: 5, color: colors.blush, fontSize: 24, fontWeight: '900' },
  date: { marginTop: 5, marginLeft: 23, color: colors.ink, fontSize: 12, fontWeight: '600' },
  wallButton: { width: 47, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line },
  calendarGlyphTop: { position: 'absolute', top: 7, width: 20, height: 5, borderTopWidth: 2, borderBottomWidth: 1, borderColor: colors.cocoa },
  wallHeart: { marginTop: 8 },
  wallButtonIcon: { marginTop: 7, color: colors.cocoa, fontSize: 22, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  draftStrip: { minHeight: 36, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 12, backgroundColor: colors.blushSoft },
  draftText: { color: colors.cocoa, fontSize: 11, fontWeight: '700' },
  calendarCard: { minHeight: 399, paddingHorizontal: 15, paddingTop: 15, paddingBottom: 14, borderRadius: 25, backgroundColor: '#FFFDF9', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, shadowColor: colors.cocoa, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  monthHeader: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthCenter: { alignItems: 'flex-start' },
  monthTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthTitle: { color: colors.ink, fontFamily: typography.title, fontSize: 20, fontWeight: '900' },
  swipeHint: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, overflow: 'hidden', color: colors.cocoa, backgroundColor: colors.butterSoft, fontSize: 7.5, fontWeight: '800' },
  monthUnderline: { marginTop: 5, marginLeft: 8, width: 13, height: 1.5, borderRadius: 2, backgroundColor: colors.inkMuted },
  monthNavigation: { flexDirection: 'row', gap: 10 },
  monthArrow: { paddingHorizontal: 5, color: '#C7BCAF', fontSize: 22 },
  monthArrowPressed: { opacity: 0.45, transform: [{ scale: 0.84 }] },
  weekRow: { flexDirection: 'row', height: 32, alignItems: 'center' },
  weekday: { width: `${100 / 7}%`, color: colors.inkMuted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 49, paddingHorizontal: 2, alignItems: 'center' },
  dayCellPressed: { opacity: 0.72, transform: [{ scale: 0.93 }] },
  dateTile: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  todayTile: { backgroundColor: colors.paperDeep, borderWidth: 1, borderColor: colors.cream },
  dayNumber: { zIndex: 2, height: 17, color: colors.ink, fontSize: 9.5, fontWeight: '700', textAlign: 'center' },
  outside: { color: '#C1B8AF' },
  todayDot: { position: 'absolute', top: -1, width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.blushSoft },
  noPhotoDay: { width: 35, height: 28, marginTop: -1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.blushSoft, borderWidth: 1, borderColor: colors.white, shadowColor: colors.cocoa, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  noPhotoDayText: { color: colors.cocoa, fontSize: 6.5, fontWeight: '900' },
  photoStack: { width: 35, height: 31, marginTop: -1 },
  stackPhoto: { position: 'absolute', width: 31, height: 29, padding: 1.5, borderRadius: 9, backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.13, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  stackPhotoFirst: { left: 2, top: 1, zIndex: 3 },
  stackPhotoSecond: { left: -1, top: 0, zIndex: 2, transform: [{ rotate: '-7deg' }] },
  stackPhotoThird: { left: 5, top: 0, zIndex: 1, transform: [{ rotate: '7deg' }] },
  dayPhoto: { flex: 1, borderRadius: 8 },
  countBadge: { position: 'absolute', right: -8, bottom: -3, zIndex: 5, minWidth: 24, height: 15, paddingHorizontal: 3, borderRadius: 8, overflow: 'hidden', color: colors.white, backgroundColor: colors.blush, fontSize: 7, fontWeight: '900', textAlign: 'center', lineHeight: 15 },
  turnLeft: { transform: [{ rotate: '-3deg' }] },
  turnRight: { transform: [{ rotate: '3deg' }] },
  wallCard: { minHeight: 365, padding: 14, borderRadius: radii.lg, backgroundColor: colors.card },
  wallHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  wallCount: { color: colors.inkMuted, fontSize: 10 },
  wallGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wallPhoto: { width: '31.5%', padding: 5, paddingBottom: 9, backgroundColor: colors.white, shadowColor: colors.cocoa, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  wallImage: { width: '100%', aspectRatio: 1, borderRadius: 5 },
  noPhotoWall: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, backgroundColor: colors.blushSoft },
  noPhotoWallCharm: { color: colors.creamDeep, fontSize: 16, fontWeight: '900' },
  noPhotoWallText: { marginTop: 3, color: colors.cocoa, fontSize: 6.5, fontWeight: '800', textAlign: 'center' },
  wallName: { marginTop: 5, color: colors.ink, fontSize: 8, fontWeight: '700' },
  emptyWall: { width: '100%', paddingVertical: 100, color: colors.inkMuted, fontSize: 12, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, height: 109, padding: 14, overflow: 'hidden', borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  monthStat: { backgroundColor: colors.blushSoft },
  stampStat: { backgroundColor: colors.butterSoft },
  statLabel: { color: colors.ink, fontFamily: typography.title, fontSize: 12, fontWeight: '800' },
  statNumberLine: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-end' },
  statNumber: { color: colors.ink, fontSize: 35, lineHeight: 38, fontWeight: '900' },
  statUnit: { marginLeft: 5, marginBottom: 4, color: colors.inkMuted, fontSize: 10 },
  latestSticker: { position: 'absolute', right: 12, bottom: 7, width: 52, height: 74, padding: 3, borderRadius: 17, backgroundColor: colors.white, transform: [{ rotate: '6deg' }] },
  latestPhoto: { flex: 1, borderRadius: 14 },
  tinyHeart: { position: 'absolute', right: 20, bottom: 17, color: colors.blush, fontSize: 30 },
  bigStar: { position: 'absolute', right: 10, bottom: 10, width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white, backgroundColor: colors.butter, transform: [{ rotate: '8deg' }] },
  bigStarText: { color: colors.white, fontSize: 28 },
  addButton: { position: 'absolute', right: 22, bottom: 18, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creamDeep, shadowColor: colors.cocoa, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  addPressed: { transform: [{ rotate: '-3deg' }, { scale: 0.93 }] },
  addTwinkle: { position: 'absolute', right: 8, top: 7 },
  addText: { marginTop: -3, color: colors.white, fontSize: 34, fontWeight: '300' },
  dayModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(47,32,28,0.28)' },
  daySheet: { maxHeight: '72%', paddingTop: 9, paddingBottom: 28, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFF9EF', borderWidth: 1, borderColor: colors.line },
  daySheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#D9CEC1' },
  daySheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14 },
  daySheetEyebrow: { color: colors.creamDeep, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  daySheetTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.title, fontSize: 23, fontWeight: '900' },
  daySheetClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  daySheetCloseText: { marginTop: -2, color: colors.inkMuted, fontSize: 25, fontWeight: '400' },
  dayDrinkRail: { gap: 12, paddingHorizontal: 20, paddingTop: 17, paddingBottom: 15 },
  dayDrinkCard: { width: 190, padding: 10, borderRadius: 20, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, shadowColor: colors.cocoa, shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  dayCardLeft: { transform: [{ rotate: '-0.8deg' }] },
  dayCardRight: { transform: [{ rotate: '0.8deg' }] },
  dayDrinkPhotoWrap: { height: 136, padding: 5, borderRadius: 15, backgroundColor: colors.paperDeep, overflow: 'hidden' },
  dayDrinkPhoto: { width: '100%', height: '100%' },
  noPhotoDetail: { flex: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blushSoft },
  noPhotoDetailCharm: { color: colors.creamDeep, fontSize: 30 },
  noPhotoDetailTitle: { marginTop: 7, color: colors.ink, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  noPhotoDetailCopy: { marginTop: 4, color: colors.inkMuted, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  dayDrinkIndex: { position: 'absolute', left: 8, top: 8, minWidth: 27, paddingVertical: 3, borderRadius: 9, overflow: 'hidden', color: colors.white, backgroundColor: colors.blush, fontSize: 8, fontWeight: '900', textAlign: 'center' },
  dayDrinkName: { marginTop: 9, color: colors.ink, fontSize: 14, fontWeight: '900' },
  dayDrinkShop: { marginTop: 3, marginBottom: 9, color: colors.inkMuted, fontSize: 9 },
  dayDrinkActions: { flexDirection: 'row', gap: 7, marginTop: 6 },
  daySmallButton: { flex: 1, minHeight: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.paperDeep },
  daySmallButtonText: { color: colors.inkMuted, fontSize: 10, fontWeight: '800' },
  dayCreateButton: { backgroundColor: colors.butterSoft },
  dayCreateButtonText: { color: colors.cocoa, fontSize: 10, fontWeight: '900' },
  dayPublishButton: { backgroundColor: colors.blushSoft },
  dayPublishButtonText: { color: '#A94B4B', fontSize: 10, fontWeight: '900' },
  daySheetActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  dayAddButton: { flex: 1, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.creamDeep, backgroundColor: colors.white },
  dayAddButtonText: { color: colors.creamDeep, fontSize: 12, fontWeight: '900' },
  dayCollectionButton: { flex: 1.35, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creamDeep },
  dayCollectionButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  daySheetTip: { marginTop: 12, color: colors.inkMuted, fontSize: 9, textAlign: 'center' },
});
