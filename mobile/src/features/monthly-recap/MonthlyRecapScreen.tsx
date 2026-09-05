import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, findNodeHandle, Image, NativeModules, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TurboModuleRegistry, View } from 'react-native';
import type { HostInstance, TurboModule } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors, radii } from '../../design-system/theme';
import type { RecordAggregate } from '../../domain/models';
import { monthRange } from '../../shared/dates';
import { previewAssetFor } from '../shared/recordAssets';

type Props = NativeStackScreenProps<RootStackParamList, 'MonthlyRecap'>;

export const MonthlyRecapScreen = (_props: Props) => {
  const { repository, assetStore, now } = useServices();
  const [records, setRecords] = useState<RecordAggregate[]>([]);
  const [note, setNote] = useState('这个月，也有一些被好好接住的小时刻。');
  const [busy, setBusy] = useState(false);
  const posterRef = useRef<HostInstance>(null);
  const today = now();
  const range = useMemo(() => monthRange(today), [today]);

  useEffect(() => {
    repository.findSavedInRange(range.startISO, range.endISO).then(setRecords).catch(() => setRecords([]));
  }, [range.endISO, range.startISO, repository]);

  const shops = new Set(records.map(item => item.record.shopName).filter(Boolean)).size;
  const mood = mostCommon(records.map(item => item.record.mood).filter((value): value is string => Boolean(value))) || '松弛';
  const featured = [...records].reverse().slice(0, 3);
  const summary = `${today.getFullYear()}年${today.getMonth() + 1}月，我记录了${records.length}杯饮品，去了${shops}家店。这个月的关键词是“${mood}”。${note}`;

  const capture = async () => {
    const node = findNodeHandle(posterRef.current);
    type ViewShotModule = TurboModule & { captureRef?: (target: number, options: Record<string, unknown>) => Promise<string> };
    const module = TurboModuleRegistry.get<ViewShotModule>('RNViewShot') ?? NativeModules.RNViewShot as ViewShotModule | undefined;
    if (!node || !module?.captureRef) throw new Error('POSTER_CAPTURE_FAILED');
    return module.captureRef(node, { format: 'jpg', quality: 0.96, result: 'tmpfile' });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (Platform.OS === 'android' && Number(Platform.Version) <= 28) {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('PHOTO_PERMISSION_DENIED');
      }
      const uri = await capture();
      await CameraRoll.save(uri, Platform.OS === 'ios' ? { type: 'photo' } : { type: 'photo', album: '吨吨记' });
      Alert.alert('本月小刊已保存', '可以在系统照片里找到这张月刊。');
    } catch {
      Alert.alert('还没有保存', '请允许照片写入权限后再试。');
    } finally {
      setBusy(false);
    }
  };

  if (!records.length) {
    return <SafeAreaView edges={['bottom']} style={styles.safeArea}><PaperTexture /><View style={styles.empty}><Text style={styles.emptyMark}>▤</Text><Text style={styles.emptyTitle}>本月还没有入刊的照片</Text><Text style={styles.emptyText}>先记录一杯，本月小刊会自动用真实记录排版。</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <ScrollView contentContainerStyle={styles.content}>
        <View ref={posterRef} collapsable={false} style={styles.poster}>
          <View style={styles.tape} />
          <Text style={styles.issue}>DRINK NOTES · ISSUE {String(today.getMonth() + 1).padStart(2, '0')}</Text>
          <Text style={styles.posterTitle}>{today.getMonth() + 1}月，{`\n`}生活微甜</Text>
          <Text style={styles.posterLead}>{note}</Text>
          <View style={styles.photoRow}>
            {featured.map((item, index) => {
              const asset = previewAssetFor(item);
              return (
                <View key={item.record.id} style={[styles.photoWrap, index === 1 && styles.photoTurn]}>
                  {asset ? (
                    <Image source={{ uri: assetStore.resolveUri(asset) }} style={styles.photo} />
                  ) : (
                    <View style={[styles.photo, styles.noPhoto]}>
                      <Text style={styles.noPhotoCharm}>☕︎ ♡</Text>
                      <Text style={styles.noPhotoText}>没拍照{`\n`}也要入刊</Text>
                    </View>
                  )}
                  <Text numberOfLines={1} style={styles.photoCaption}>{item.record.beverageName || item.record.category || '文字记录的一杯'}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.posterStats}><Text style={styles.posterStat}>{records.length} CUPS</Text><Text style={styles.posterStat}>{shops} SHOPS</Text><Text style={styles.posterStat}>{mood.toLocaleUpperCase('zh-CN')}</Text></View>
          <Text style={styles.posterDate}>{today.getFullYear()} / {String(today.getMonth() + 1).padStart(2, '0')}</Text>
        </View>
        <View style={styles.editor}>
          <Text style={styles.editorLabel}>本月页尾</Text>
          <TextInput accessibilityLabel="本月小刊页尾" value={note} onChangeText={setNote} multiline maxLength={100} style={styles.input} />
          <Text style={styles.editorHint}>照片、杯数和店铺来自本机记录；文字可以继续改。</Text>
        </View>
        <View style={styles.actionRow}>
          <Pressable disabled={busy} onPress={() => save().catch(() => undefined)} style={[styles.button, styles.save]}><Text style={styles.buttonIcon}>⇩</Text><Text style={styles.buttonText}>{busy ? '保存中' : '保存月刊'}</Text></Pressable>
          <Pressable onPress={() => { Clipboard.setString(summary); Alert.alert('本月总结已复制'); }} style={[styles.button, styles.copy]}><Text style={styles.buttonIcon}>▣</Text><Text style={styles.buttonText}>复制总结</Text></Pressable>
        </View>
        <Text style={styles.privacy}>免费本地排版，不调用 AI，也不会自动公开。</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const mostCommon = (values: string[]) => {
  const counts = new Map<string, number>();
  values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 18, paddingBottom: 36, gap: 12 },
  poster: { width: '100%', aspectRatio: 0.8, padding: 24, overflow: 'hidden', backgroundColor: '#F3E3C8', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tape: { position: 'absolute', right: 30, top: 8, width: 84, height: 22, opacity: 0.65, backgroundColor: colors.skySoft, transform: [{ rotate: '8deg' }] },
  issue: { color: colors.creamDeep, fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  posterTitle: { marginTop: 22, color: colors.ink, fontSize: 35, lineHeight: 42, fontWeight: '900' },
  posterLead: { marginTop: 12, width: '80%', color: colors.inkMuted, fontSize: 10, lineHeight: 17 },
  photoRow: { height: 174, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoWrap: { width: '31%', padding: 5, paddingBottom: 18, backgroundColor: colors.card, transform: [{ rotate: '-2deg' }] },
  photoTurn: { transform: [{ rotate: '2deg' }] },
  photo: { width: '100%', height: 136, backgroundColor: colors.paperDeep },
  noPhoto: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: colors.blushSoft },
  noPhotoCharm: { color: colors.creamDeep, fontSize: 22, fontWeight: '900' },
  noPhotoText: { marginTop: 7, color: colors.cocoa, fontSize: 8, lineHeight: 12, fontWeight: '800', textAlign: 'center' },
  photoCaption: { marginTop: 6, color: colors.ink, fontSize: 7, fontWeight: '800', textAlign: 'center' },
  posterStats: { paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.cocoa },
  posterStat: { color: colors.cocoa, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  posterDate: { marginTop: 10, color: colors.ink, fontSize: 9, fontWeight: '900', textAlign: 'right' },
  editor: { padding: 16, borderRadius: radii.lg, backgroundColor: colors.card },
  editorLabel: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  input: { minHeight: 56, marginTop: 8, padding: 0, color: colors.ink, fontSize: 12, lineHeight: 19, textAlignVertical: 'top' },
  editorHint: { color: colors.inkMuted, fontSize: 8 },
  actionRow: { flexDirection: 'row', gap: 9 },
  button: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  save: { backgroundColor: colors.butterSoft },
  copy: { backgroundColor: colors.blushSoft },
  buttonIcon: { color: colors.ink, fontSize: 18 },
  buttonText: { marginTop: 4, color: colors.ink, fontSize: 9, fontWeight: '900' },
  privacy: { color: colors.inkMuted, fontSize: 8, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyMark: { color: colors.creamDeep, fontSize: 45 },
  emptyTitle: { marginTop: 15, color: colors.ink, fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 8, color: colors.inkMuted, fontSize: 10 },
});
