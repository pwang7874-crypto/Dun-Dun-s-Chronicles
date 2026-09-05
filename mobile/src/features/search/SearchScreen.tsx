import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors, radii } from '../../design-system/theme';
import type { RecordAggregate } from '../../domain/models';
import { archiveEnd, archiveStart, previewAssetFor } from '../shared/recordAssets';
import { searchRecords } from './searchRecords';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;
const suggestions = ['雨天咖啡', '五分糖奶茶', '上海', '我最喜欢的店'];

export const SearchScreen = ({ navigation }: Props) => {
  const { repository, assetStore } = useServices();
  const [records, setRecords] = useState<RecordAggregate[]>([]);
  const [query, setQuery] = useState('');

  useFocusEffect(useCallback(() => {
    repository.findSavedInRange(archiveStart, archiveEnd).then(setRecords).catch(() => setRecords([]));
  }, [repository]));

  const results = useMemo(() => searchRecords(records, query), [query, records]);
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>FIND A LITTLE MEMORY</Text>
        <Text style={styles.title}>想找哪一杯？</Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="搜索饮品记录"
            value={query}
            onChangeText={setQuery}
            placeholder="试试“雨天的拿铁”或一家店"
            placeholderTextColor={colors.inkMuted}
            returnKeyType="search"
            style={styles.input}
          />
          {query ? <Pressable accessibilityLabel="清空搜索" onPress={() => setQuery('')}><Text style={styles.clear}>×</Text></Pressable> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRail}>
          {suggestions.map(item => <Pressable key={item} onPress={() => setQuery(item)} style={styles.suggestion}><Text style={styles.suggestionText}>{item}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.heading}><Text style={styles.headingTitle}>{query ? `找到 ${results.length} 杯` : `全部 ${results.length} 杯`}</Text><Text style={styles.headingNote}>全部在本机搜索</Text></View>
        {results.map(item => {
          const asset = previewAssetFor(item);
          return (
            <Pressable key={item.record.id} onPress={() => navigation.navigate('Detail', { recordId: item.record.id })} style={styles.result}>
              {asset ? (
                <Image source={{ uri: assetStore.resolveUri(asset) }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.noPhoto]}>
                  <Text style={styles.noPhotoCharm}>☕︎</Text>
                  <Text style={styles.noPhotoText}>文字也很甜</Text>
                </View>
              )}
              <View style={styles.resultCopy}>
                <Text numberOfLines={1} style={styles.resultTitle}>{item.record.beverageName || item.record.category || '今天这一杯'}</Text>
                <Text numberOfLines={1} style={styles.resultMeta}>{[item.record.shopName, item.record.city, item.record.sugarLevel, item.record.temperature].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.resultDate}>{new Date(item.record.occurredAt).toLocaleDateString('zh-CN')}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          );
        })}
        {!results.length ? <View style={styles.empty}><Text style={styles.emptyMark}>☕︎</Text><Text style={styles.emptyTitle}>这一页还没有线索</Text><Text style={styles.emptyText}>换一个饮品名、店铺、城市、糖度或心情试试。</Text></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, paddingBottom: 34 },
  kicker: { color: colors.creamDeep, fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  title: { marginTop: 8, color: colors.ink, fontSize: 29, fontWeight: '900' },
  searchBox: { marginTop: 20, minHeight: 54, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', borderRadius: 19, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  searchIcon: { color: colors.cocoa, fontSize: 22 },
  input: { flex: 1, paddingHorizontal: 10, color: colors.ink, fontSize: 13 },
  clear: { padding: 8, color: colors.inkMuted, fontSize: 21 },
  suggestionRail: { paddingVertical: 13, gap: 8 },
  suggestion: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.blushSoft },
  suggestionText: { color: colors.ink, fontSize: 10 },
  heading: { marginTop: 7, marginBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headingTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  headingNote: { color: colors.inkMuted, fontSize: 9 },
  result: { minHeight: 92, marginBottom: 9, padding: 10, flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, backgroundColor: colors.card },
  photo: { width: 70, height: 70, borderRadius: 18, backgroundColor: colors.paperDeep },
  noPhoto: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, backgroundColor: colors.blushSoft },
  noPhotoCharm: { color: colors.creamDeep, fontSize: 20 },
  noPhotoText: { marginTop: 3, color: colors.cocoa, fontSize: 7, fontWeight: '800', textAlign: 'center' },
  resultCopy: { flex: 1, marginLeft: 12 },
  resultTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  resultMeta: { marginTop: 6, color: colors.inkMuted, fontSize: 9 },
  resultDate: { marginTop: 7, color: colors.creamDeep, fontSize: 8, fontWeight: '800' },
  arrow: { color: colors.inkMuted, fontSize: 23 },
  empty: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  emptyMark: { color: colors.creamDeep, fontSize: 38 },
  emptyTitle: { marginTop: 12, color: colors.ink, fontSize: 16, fontWeight: '900' },
  emptyText: { marginTop: 7, color: colors.inkMuted, fontSize: 10 },
});
