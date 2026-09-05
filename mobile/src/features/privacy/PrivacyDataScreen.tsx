import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors } from '../../design-system/theme';
import { archiveEnd, archiveStart } from '../shared/recordAssets';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyData'>;

export const PrivacyDataScreen = (_props: Props) => {
  const { repository, creativeRepository, assetStore } = useServices();
  const [exporting, setExporting] = useState(false);
  const exportData = useCallback(async () => {
    setExporting(true);
    try {
      const records = await repository.findSavedInRange(archiveStart, archiveEnd);
      const payload = records.map(({ record }) => ({
        date: record.occurredAt, drink: record.beverageName, category: record.category,
        shop: record.shopName, sugar: record.sugarLevel, temperature: record.temperature,
        city: record.city, mood: record.mood, note: record.note,
      }));
      await Share.share({ title: '我的饮品日记数据', message: JSON.stringify(payload, null, 2) });
    } catch {
      Alert.alert('导出失败', '数据仍然保存在本机，请稍后再试。');
    } finally {
      setExporting(false);
    }
  }, [repository]);

  const deleteEverything = useCallback(() => {
    Alert.alert(
      '删除全部本地数据？',
      '这会删除所有饮品记录、原图、成片、海报草稿、收藏和印章，无法恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认全部删除',
          style: 'destructive',
          onPress: () => {
            creativeRepository.deleteAllUserData()
              .then(assets => Promise.allSettled(assets.map(asset => assetStore.remove(asset))))
              .then(() => Alert.alert('已经清空', '本机上的饮品日记与照片已删除。'))
              .catch(() => Alert.alert('没有删完', '请重新打开 App 后再试，系统不会继续后台删除。'));
          },
        },
      ],
    );
  }, [assetStore, creativeRepository]);
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <View style={styles.content}>
        <Text style={styles.title}>你的照片，默认只属于你</Text>
        <Text style={styles.lead}>原图、滤镜成片、记录与创作草稿都保存在 App 私有目录。只有你主动使用 AI 或系统分享时，相关内容才会离开设备。</Text>
        <View style={styles.card}>
          <View style={styles.row}><Text style={styles.rowIcon}>⌂</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>本地保存</Text><Text style={styles.rowNote}>卸载 App 会删除未同步的数据</Text></View><Text style={styles.ok}>已开启</Text></View>
          <View style={[styles.row, styles.border]}><Text style={styles.rowIcon}>☁</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>云端同步</Text><Text style={styles.rowNote}>登录服务接入后由你主动开启</Text></View><Text style={styles.off}>未开启</Text></View>
          <View style={[styles.row, styles.border]}><Text style={styles.rowIcon}>AI</Text><View style={styles.rowCopy}><Text style={styles.rowTitle}>AI 上传</Text><Text style={styles.rowNote}>只上传你确认生成的那一张</Text></View><Text style={styles.off}>按次确认</Text></View>
        </View>
        <Pressable disabled={exporting} onPress={() => exportData().catch(() => undefined)} style={styles.export}><Text style={styles.exportText}>{exporting ? '正在整理…' : '导出我的记录（JSON）'}</Text></Pressable>
        <Pressable onPress={deleteEverything} style={styles.delete}><Text style={styles.deleteText}>删除全部本地数据</Text></Pressable>
        <Text style={styles.hint}>删除前会再次确认；删除会同时清理数据库和 App 私有照片文件，无法恢复。</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, padding: 24 },
  title: { marginTop: 10, color: colors.ink, fontSize: 27, lineHeight: 38, fontWeight: '900' },
  lead: { marginTop: 13, color: colors.inkMuted, fontSize: 12, lineHeight: 21 },
  card: { marginTop: 24, paddingHorizontal: 16, borderRadius: 23, backgroundColor: colors.card },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center' },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  rowIcon: { width: 38, color: colors.cocoa, fontSize: 18, fontWeight: '800' },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  rowNote: { marginTop: 4, color: colors.inkMuted, fontSize: 9 },
  ok: { color: colors.moss, fontSize: 9, fontWeight: '800' },
  off: { color: colors.inkMuted, fontSize: 9 },
  export: { marginTop: 16, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  exportText: { color: colors.card, fontSize: 12, fontWeight: '800' },
  delete: { marginTop: 10, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.danger },
  deleteText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
  hint: { marginTop: 14, color: colors.inkMuted, fontSize: 9, lineHeight: 16, textAlign: 'center' },
});
