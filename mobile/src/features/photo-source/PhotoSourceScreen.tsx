import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { AppError } from '../../domain/errors';
import type { PhotoSource } from '../../domain/ports';
import {
  PrimaryButton,
  SecondaryButton,
} from '../../design-system/components/Buttons';
import { ErrorNotice } from '../../design-system/components/ErrorNotice';
import {
  FloatingBubble,
  TwinklingStar,
  WobblingCharm,
} from '../../design-system/components/CuteMotionBits';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { colors, radii, spacing } from '../../design-system/theme';
import { newId } from '../../shared/id';
import {
  createDraftFromSource,
  createTextOnlyDraft,
} from './createDraftFromSource';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoSource'>;

export const PhotoSourceScreen = ({ navigation }: Props) => {
  const { photoImporter, assetStore, repository, now } = useServices();
  const [busySource, setBusySource] = useState<PhotoSource | 'text'>();
  const [error, setError] = useState<string>();

  const begin = async (source: PhotoSource) => {
    if (busySource) {
      return;
    }
    setBusySource(source);
    setError(undefined);
    try {
      const recordId = await createDraftFromSource(source, {
        photoImporter,
        assetStore,
        repository,
        now,
        createId: newId,
      });
      if (recordId) {
        navigation.replace('Editor', { recordId });
      }
    } catch (beginError) {
      setError(
        beginError instanceof AppError
          ? beginError.userMessage
          : '照片还没有准备好，请再试一次。',
      );
    } finally {
      setBusySource(undefined);
    }
  };

  const beginWithWords = async () => {
    if (busySource) {
      return;
    }
    setBusySource('text');
    setError(undefined);
    try {
      const recordId = await createTextOnlyDraft({
        repository,
        now,
        createId: newId,
      });
      navigation.replace('Editor', { recordId });
    } catch (beginError) {
      setError(
        beginError instanceof AppError
          ? beginError.userMessage
          : '文字日记还没有准备好，请再试一次。',
      );
    } finally {
      setBusySource(undefined);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.illustration}>
          <View style={styles.blushBlob} />
          <View style={styles.skyBlob} />
          <View style={styles.tape} />
          <TwinklingStar color={colors.blush} size={28} style={styles.starLeft} />
          <Text style={styles.waveRight}>〜</Text>
          <View style={styles.cupSticker}>
            <View style={styles.cupLid} />
            <View style={styles.straw} />
            <View style={styles.cupBody}>
              <Text style={styles.cupLabel}>TODAY{`\n`}DRINK</Text>
            </View>
          </View>
          <View style={styles.mascotSticker}>
            <Image
              accessibilityLabel="吨吨记奶油小画家"
              source={require('../../assets/images/diary-girl-mascot.png')}
              resizeMode="contain"
              style={styles.mascot}
            />
          </View>
          <WobblingCharm kind="flower" delay={300} style={styles.flowerCharm} />
          <FloatingBubble size={10} style={styles.bubbleOne} />
          <FloatingBubble color={colors.sky} delay={850} size={7} style={styles.bubbleTwo} />
          <Text style={styles.smallStamp}>A DAY IN A CUP · 01</Text>
        </View>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>今天这一杯，{`\n`}想怎样留下来？</Text>
            <Text style={styles.titleHeart}>♡</Text>
          </View>
          <Text style={styles.subtitle}>
            拍下杯子、从相册挑一张，或只写几句话。每一种记法都算完整。
          </Text>
        </View>
        <ErrorNotice message={error} />
        <View style={styles.actions}>
          <PrimaryButton
            label="拍一张"
            busy={busySource === 'camera'}
            disabled={Boolean(busySource)}
            onPress={() => begin('camera').catch(() => undefined)}
          />
          <SecondaryButton
            label="从相册选择"
            busy={busySource === 'library'}
            disabled={Boolean(busySource)}
            onPress={() => begin('library').catch(() => undefined)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="不添加照片，直接写这一杯"
            disabled={Boolean(busySource)}
            onPress={() => beginWithWords().catch(() => undefined)}
            style={({ pressed }) => [
              styles.wordsButton,
              pressed && styles.wordsButtonPressed,
              busySource && styles.wordsButtonDisabled,
            ]}
          >
            <Text style={styles.wordsIcon}>{busySource === 'text' ? '…' : '✎'}</Text>
            <View style={styles.wordsCopy}>
              <Text style={styles.wordsTitle}>今天先写字</Text>
              <Text style={styles.wordsHint}>没有照片也能保存，我们会放一句可爱的话</Text>
            </View>
            <Text style={styles.wordsArrow}>→</Text>
          </Pressable>
        </View>
        <Text style={styles.privacy}>
          🎀 照片只留在 App 私有目录，滤镜也在本机完成；不会自动公开。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  illustration: {
    height: 230,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.butterSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  blushBlob: { position: 'absolute', left: -38, bottom: -52, width: 150, height: 150, borderRadius: 75, backgroundColor: colors.blushSoft, opacity: 0.68 },
  skyBlob: { position: 'absolute', right: -44, top: -53, width: 164, height: 164, borderRadius: 82, backgroundColor: colors.skySoft, opacity: 0.8 },
  tape: { position: 'absolute', top: 2, width: 82, height: 24, backgroundColor: 'rgba(157,190,215,0.55)', transform: [{ rotate: '-4deg' }] },
  starLeft: { position: 'absolute', left: 28, top: 80 },
  waveRight: { position: 'absolute', right: 25, top: 112, color: colors.sky, fontSize: 34, fontWeight: '800', transform: [{ rotate: '-22deg' }] },
  cupSticker: { width: 105, height: 143, alignItems: 'center', transform: [{ rotate: '3deg' }] },
  cupLid: { zIndex: 2, width: 105, height: 17, borderRadius: 9, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.white },
  straw: { position: 'absolute', top: -23, right: 24, width: 6, height: 44, borderRadius: 3, backgroundColor: colors.blush, transform: [{ rotate: '5deg' }] },
  cupBody: { width: 88, height: 112, marginTop: -1, alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 25, borderBottomRightRadius: 25, backgroundColor: colors.cocoa, borderWidth: 4, borderColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cupLabel: { color: colors.paper, fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  mascotSticker: { position: 'absolute', right: 13, bottom: 20, width: 78, height: 92, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.88)', transform: [{ rotate: '4deg' }], shadowColor: colors.cocoa, shadowOpacity: 0.12, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  mascot: { width: '100%', height: '100%' },
  flowerCharm: { position: 'absolute', left: 21, bottom: 30 },
  bubbleOne: { position: 'absolute', right: 107, top: 34 },
  bubbleTwo: { position: 'absolute', left: 67, bottom: 51 },
  smallStamp: {
    position: 'absolute',
    bottom: 13,
    color: colors.cocoa,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { flex: 1, color: colors.ink, fontSize: 28, lineHeight: 38, fontWeight: '800' },
  titleHeart: { marginTop: 4, color: colors.blush, fontSize: 33, transform: [{ rotate: '7deg' }] },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 24,
  },
  actions: { gap: spacing.md },
  wordsButton: { minHeight: 70, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.cream, backgroundColor: '#FFF8E9' },
  wordsButtonPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  wordsButtonDisabled: { opacity: 0.45 },
  wordsIcon: { width: 35, color: colors.creamDeep, fontSize: 24, fontWeight: '800' },
  wordsCopy: { flex: 1 },
  wordsTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  wordsHint: { marginTop: 3, color: colors.inkMuted, fontSize: 10, lineHeight: 15 },
  wordsArrow: { color: colors.creamDeep, fontSize: 19, fontWeight: '800' },
  privacy: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
});
