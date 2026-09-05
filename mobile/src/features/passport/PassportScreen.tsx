import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors, radii } from '../../design-system/theme';
import type { RecordAggregate } from '../../domain/models';
import { archiveEnd, archiveStart } from '../shared/recordAssets';

type Props = NativeStackScreenProps<RootStackParamList, 'Passport'>;

export const PassportScreen = (_props: Props) => {
  const { repository } = useServices();
  const [records, setRecords] = useState<RecordAggregate[]>([]);
  useFocusEffect(useCallback(() => {
    repository.findSavedInRange(archiveStart, archiveEnd).then(setRecords).catch(() => setRecords([]));
  }, [repository]));

  const cities = useMemo(() => groupBy(records, item => item.record.city?.trim()), [records]);
  const shops = useMemo(() => groupBy(records, item => item.record.shopName?.trim()), [records]);
  const categories = useMemo(() => groupBy(records, item => item.record.category), [records]);
  const challengeTarget = 5;
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cover}>
          <Text style={styles.coverKicker}>DRINK PASSPORT / LOCAL ONLY</Text>
          <Text style={styles.coverTitle}>把喝过的城市，{`\n`}装订成一本小护照</Text>
          <Text style={styles.coverText}>只使用你主动填写的城市与店铺，不读取定位，也不会把去过哪里公开。</Text>
          <View style={styles.stats}>
            <PassportStat value={cities.length} label="城市" />
            <PassportStat value={shops.length} label="店铺" />
            <PassportStat value={records.length} label="杯" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>城市页签</Text>
        {cities.length ? <View style={styles.cityGrid}>{cities.map(([city, items], index) => (
          <View key={city} style={[styles.cityCard, index % 3 === 1 && styles.cityPink, index % 3 === 2 && styles.cityBlue]}>
            <Text style={styles.cityNo}>{String(index + 1).padStart(2, '0')}</Text>
            <Text numberOfLines={1} style={styles.cityName}>{city}</Text>
            <Text style={styles.cityCount}>{items.length} 杯 · {new Set(items.map(item => item.record.shopName).filter(Boolean)).size} 店</Text>
            <Text style={styles.cityStamp}>DD / {city.slice(0, 2)}</Text>
          </View>
        ))}</View> : <EmptyCard text="记录时填下城市，第一张城市页签就会出现。" />}

        <Text style={styles.sectionTitle}>慢慢完成的挑战</Text>
        <View style={styles.challenge}>
          <View style={styles.challengeTop}><Text style={styles.challengeName}>五种饮品散步</Text><Text style={styles.challengeValue}>{Math.min(categories.length, challengeTarget)} / {challengeTarget}</Text></View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, categories.length / challengeTarget * 100)}%` }]} /></View>
          <Text style={styles.challengeText}>{categories.length ? categories.map(([name]) => name).join('、') : '咖啡、奶茶、茶、果汁……从喜欢的第一杯开始。'}</Text>
        </View>
        <View style={[styles.challenge, styles.challengeSoft]}>
          <View style={styles.challengeTop}><Text style={styles.challengeName}>三家小店漫游</Text><Text style={styles.challengeValue}>{Math.min(shops.length, 3)} / 3</Text></View>
          <View style={styles.track}><View style={[styles.fill, styles.fillPink, { width: `${Math.min(100, shops.length / 3 * 100)}%` }]} /></View>
          <Text style={styles.challengeText}>品牌文字只是你的记录，不代表本产品与店铺存在合作。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const groupBy = (records: RecordAggregate[], keyFor: (item: RecordAggregate) => string | undefined) => {
  const groups = new Map<string, RecordAggregate[]>();
  records.forEach(item => {
    const key = keyFor(item);
    if (key) groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
};

const PassportStat = ({ value, label }: { value: number; label: string }) => <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
const EmptyCard = ({ text }: { text: string }) => <View style={styles.empty}><Text style={styles.emptyMark}>⌖</Text><Text style={styles.emptyText}>{text}</Text></View>;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, paddingBottom: 36, gap: 13 },
  cover: { padding: 22, borderRadius: 28, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  coverKicker: { color: colors.creamDeep, fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  coverTitle: { marginTop: 12, color: colors.ink, fontSize: 26, lineHeight: 36, fontWeight: '900' },
  coverText: { marginTop: 9, color: colors.inkMuted, fontSize: 10, lineHeight: 17 },
  stats: { marginTop: 20, paddingTop: 15, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  statLabel: { marginTop: 3, color: colors.inkMuted, fontSize: 8 },
  sectionTitle: { marginTop: 8, color: colors.ink, fontSize: 17, fontWeight: '900' },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cityCard: { width: '48.5%', minHeight: 146, padding: 15, overflow: 'hidden', borderRadius: radii.lg, backgroundColor: colors.butterSoft },
  cityPink: { backgroundColor: colors.blushSoft },
  cityBlue: { backgroundColor: colors.skySoft },
  cityNo: { color: colors.creamDeep, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cityName: { marginTop: 14, color: colors.ink, fontSize: 22, fontWeight: '900' },
  cityCount: { marginTop: 6, color: colors.inkMuted, fontSize: 8 },
  cityStamp: { marginTop: 22, color: colors.cocoa, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  challenge: { padding: 18, borderRadius: radii.lg, backgroundColor: colors.card },
  challengeSoft: { backgroundColor: colors.blushSoft },
  challengeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  challengeName: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  challengeValue: { color: colors.creamDeep, fontSize: 14, fontWeight: '900' },
  track: { marginTop: 13, height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.paperDeep },
  fill: { height: 7, borderRadius: 4, backgroundColor: colors.creamDeep },
  fillPink: { backgroundColor: colors.blush },
  challengeText: { marginTop: 10, color: colors.inkMuted, fontSize: 9, lineHeight: 16 },
  empty: { minHeight: 145, padding: 20, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.card },
  emptyMark: { color: colors.creamDeep, fontSize: 31 },
  emptyText: { marginTop: 9, color: colors.inkMuted, fontSize: 10, textAlign: 'center' },
});
