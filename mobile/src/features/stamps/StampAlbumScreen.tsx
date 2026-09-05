import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { ErrorNotice } from '../../design-system/components/ErrorNotice';
import { LoadingView } from '../../design-system/components/LoadingView';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors, radii, spacing } from '../../design-system/theme';
import type { RecordAggregate } from '../../domain/models';
import { buildMilestoneStamps, buildShopStamps, type DrinkStamp } from './stampCatalog';

type Props = NativeStackScreenProps<RootStackParamList, 'StampAlbum'>;

const archiveStart = new Date(2000, 0, 1).toISOString();
const archiveEnd = new Date(2100, 0, 1).toISOString();
const perforations = Array.from({ length: 8 }, (_, index) => index);

const stampPalettes = [
  { paper: '#F9D9D3', ink: '#A9534E', accent: '#F7B5A9' },
  { paper: '#FCE8AA', ink: '#9D651F', accent: '#F4C858' },
  { paper: '#DDEAF4', ink: '#557895', accent: '#9DBED7' },
  { paper: '#EADDD4', ink: '#76503E', accent: '#C59A80' },
  { paper: '#E5DFF0', ink: '#695A82', accent: '#B8A9D2' },
  { paper: '#F7DED0', ink: '#A65E43', accent: '#EDAA86' },
] as const;

const formatIssue = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const TicketStamp = ({ stamp, index }: { stamp: DrinkStamp; index: number }) => {
  const palette = stampPalettes[stamp.paletteIndex % stampPalettes.length]!;
  return (
    <View
      accessibilityLabel={`${stamp.title}，${stamp.unlocked ? '已解锁' : '未解锁'}`}
      style={[
        styles.ticket,
        { backgroundColor: palette.paper },
        !stamp.unlocked && styles.ticketLocked,
        { transform: [{ rotate: index % 2 === 0 ? '-1.2deg' : '1deg' }] },
      ]}
    >
      <View style={[styles.perforationColumn, styles.perforationLeft]}>
        {perforations.map(dot => <View key={dot} style={styles.perforation} />)}
      </View>
      <View style={[styles.perforationColumn, styles.perforationRight]}>
        {perforations.map(dot => <View key={dot} style={styles.perforation} />)}
      </View>
      <View style={[styles.ticketFrame, { borderColor: palette.ink }]}>
        <View style={styles.ticketTop}>
          <Text style={[styles.ticketKind, { color: palette.ink }]}>
            {stamp.kind === 'shop' ? 'DRINK STOP' : 'LITTLE MILESTONE'}
          </Text>
          <View style={[styles.cornerCode, { backgroundColor: palette.accent }]}>
            <Text style={[styles.cornerCodeText, { color: palette.ink }]}>DD</Text>
          </View>
        </View>
        <Text style={[styles.monogram, { color: palette.ink }, !stamp.unlocked && styles.ticketTextLocked]}>
          {stamp.unlocked ? stamp.monogram : '··'}
        </Text>
        <View style={[styles.ticketRule, { backgroundColor: palette.ink }]} />
        <Text numberOfLines={1} style={[styles.ticketTitle, { color: palette.ink }]}>
          {stamp.title}
        </Text>
        <Text numberOfLines={1} style={[styles.ticketSubtitle, { color: palette.ink }]}>
          {stamp.subtitle}
        </Text>
        <View style={styles.ticketBottom}>
          <Text style={[styles.ticketMeta, { color: palette.ink }]}>{stamp.serial}</Text>
          <Text style={[styles.ticketMeta, { color: palette.ink }]}>
            {stamp.unlocked ? `${formatIssue(stamp.issueDate)} · ${stamp.count}杯` : '待解锁'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const StampAlbumScreen = (_props: Props) => {
  const { repository } = useServices();
  const [records, setRecords] = useState<RecordAggregate[]>();
  const [error, setError] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      repository
        .findSavedInRange(archiveStart, archiveEnd)
        .then(result => {
          if (mounted) {
            setRecords(result);
            setError(undefined);
          }
        })
        .catch(() => {
          if (mounted) {
            setError('印章册暂时没有打开，请稍后再试。');
          }
        });
      return () => {
        mounted = false;
      };
    }, [repository]),
  );

  const shopStamps = useMemo(() => buildShopStamps(records ?? []), [records]);
  const milestones = useMemo(
    () => buildMilestoneStamps(records ?? [], shopStamps.length),
    [records, shopStamps.length],
  );
  const cities = new Set(
    (records ?? []).map(item => item.record.city).filter(Boolean),
  ).size;
  const unlockedMilestones = milestones.filter(item => item.unlocked).length;

  if (!records && !error) {
    return <LoadingView label="正在翻开印章册…" />;
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.cover}>
          <Text style={styles.coverKicker}>DRINK NOTE / STAMP ALBUM</Text>
          <Text style={styles.coverTitle}>一杯一票，{`\n`}收藏去过的小店</Text>
          <Text style={styles.coverCopy}>
            每家店会按名称生成自己的编号、字首与色票；不使用别人的圆章、地名排版或英文椭圆章。
          </Text>
          <View style={styles.coverStats}>
            <View style={styles.coverStat}>
              <Text style={styles.statValue}>{shopStamps.length}</Text>
              <Text style={styles.statLabel}>店铺色票</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.coverStat}>
              <Text style={styles.statValue}>{cities}</Text>
              <Text style={styles.statLabel}>城市</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.coverStat}>
              <Text style={styles.statValue}>{unlockedMilestones}</Text>
              <Text style={styles.statLabel}>里程章</Text>
            </View>
          </View>
        </View>

        <ErrorNotice message={error} />

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>店铺色票</Text>
          <Text style={styles.sectionCount}>{shopStamps.length} 枚</Text>
        </View>
        {shopStamps.length ? (
          <View style={styles.grid}>
            {shopStamps.map((stamp, index) => (
              <TicketStamp key={stamp.id} stamp={stamp} index={index} />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyMark}>DD</Text>
            <Text style={styles.emptyTitle}>第一枚色票在等你</Text>
            <Text style={styles.emptyCopy}>保存一杯并填写店铺名，它就会被裁成一枚独有的店铺色票。</Text>
          </View>
        )}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>慢慢解锁</Text>
          <Text style={styles.sectionCount}>不用赶</Text>
        </View>
        <View style={styles.grid}>
          {milestones.map((stamp, index) => (
            <TicketStamp key={stamp.id} stamp={stamp} index={index + shopStamps.length} />
          ))}
        </View>

        <Text style={styles.privacy}>印章只由你保存在本机的饮品记录生成，不需要定位，也不会自动公开。</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  cover: {
    padding: spacing.lg,
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  coverKicker: { color: colors.creamDeep, fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  coverTitle: { marginTop: 12, color: colors.ink, fontSize: 27, lineHeight: 37, fontWeight: '800' },
  coverCopy: { marginTop: 10, color: colors.inkMuted, fontSize: 11, lineHeight: 18 },
  coverStats: { marginTop: 20, paddingTop: 16, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  coverStat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.ink, fontSize: 23, fontWeight: '800' },
  statLabel: { marginTop: 3, color: colors.inkMuted, fontSize: 9 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.line },
  sectionHeading: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  sectionCount: { color: colors.inkMuted, fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ticket: { width: '48%', aspectRatio: 0.78, padding: 9, overflow: 'hidden' },
  ticketLocked: { backgroundColor: '#ECE7DE' },
  ticketTextLocked: { color: '#AAA197' },
  ticketFrame: { flex: 1, padding: 11, borderWidth: 1.2 },
  perforationColumn: { position: 'absolute', top: 8, bottom: 8, justifyContent: 'space-between', zIndex: 2 },
  perforationLeft: { left: -3 },
  perforationRight: { right: -3 },
  perforation: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.paper },
  ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketKind: { fontSize: 6.5, fontWeight: '800', letterSpacing: 0.8 },
  cornerCode: { width: 25, height: 20, alignItems: 'center', justifyContent: 'center' },
  cornerCodeText: { fontSize: 7, fontWeight: '900' },
  monogram: { marginTop: 13, fontSize: 40, lineHeight: 44, fontWeight: '900' },
  ticketRule: { width: 30, height: 3, marginVertical: 8 },
  ticketTitle: { fontSize: 14, fontWeight: '800' },
  ticketSubtitle: { marginTop: 3, fontSize: 8.5 },
  ticketBottom: { flex: 1, paddingTop: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  ticketMeta: { fontSize: 6.5, fontWeight: '700', letterSpacing: 0.4 },
  empty: { minHeight: 180, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.card },
  emptyMark: { color: colors.blush, fontSize: 31, fontWeight: '900', letterSpacing: -2 },
  emptyTitle: { marginTop: 10, color: colors.ink, fontSize: 16, fontWeight: '800' },
  emptyCopy: { marginTop: 6, maxWidth: 270, color: colors.inkMuted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  privacy: { padding: spacing.md, color: colors.inkMuted, fontSize: 10, lineHeight: 17, textAlign: 'center' },
});
