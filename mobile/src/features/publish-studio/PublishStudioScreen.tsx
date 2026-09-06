import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Clipboard from '@react-native-clipboard/clipboard';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Linking, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { captureRef: captureViewRef } = require('react-native-view-shot') as {
  captureRef: (target: ViewInstance, options: Record<string, unknown>) => Promise<string>;
};

import type { MainTabParamList, RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { CuteMotionLayer, TwinklingStar, WobblingCharm } from '../../design-system/components/CuteMotionBits';
import { PocketCompanion } from '../../design-system/components/PocketCompanion';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { PaperCutoutSticker } from '../../design-system/components/PaperCutoutSticker';
import { colors, radii, typography } from '../../design-system/theme';
import type { CreativeCanvasElement, CreativeProject, JournalSticker, RecordAggregate, ShareChannel, ShareDraft } from '../../domain/models';
import { hydrateCreativeCanvasElements } from '../../domain/creativeCanvas';
import { archiveEnd, archiveStart, displayAssetFor, journalStickerAssetFor } from '../shared/recordAssets';
import { localDateKey } from '../../shared/dates';
import { stickerSymbol } from '../create-studio/stickerCatalog';
import { journalLayouts } from '../create-studio/layoutCatalog';
import { shareDirectlyToTarget } from '../../infrastructure/native/targetShare';
import { LayoutDecorations } from '../create-studio/LayoutDecorations';
import {
  buildShareCopy,
  editableShareTags,
  normalizeShareTags,
  parseShareTags,
  prepareShareDraft,
} from './shareCopy';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Publish'>,
  NativeStackScreenProps<RootStackParamList>
>;

const defaultsFor = (item: RecordAggregate, channel: ShareChannel, now: Date): ShareDraft => {
  const drink = item.record.beverageName || item.record.category || '今天这一杯';
  const place = item.record.shopName || item.record.city;
  const recipe = [item.record.sugarLevel, item.record.temperature].filter(Boolean).join(' · ');
  const feeling = item.record.note || item.record.mood || '生活微甜，心情加满';
  return {
    recordId: item.record.id,
    channel,
    title: channel === 'redbook' ? `今天也要喝甜甜的｜${drink}` : `今天这一杯：${drink}`,
    body: channel === 'redbook'
      ? `${place ? `在${place}发现了` : '今天喝到'}${drink}。${recipe ? `点的是${recipe}，` : ''}${feeling}。`
      : `${place ? `${place}，` : ''}${drink}。${recipe ? `${recipe}。` : ''}${feeling}。`,
    tags: channel === 'redbook'
      ? ['吨吨记', '每日一杯', '奶茶日常', '甜甜的快乐']
      : ['吨吨记', '今天这一杯'],
    updatedAt: now.toISOString(),
  };
};

const defaultsForCollection = (
  items: RecordAggregate[],
  channel: ShareChannel,
  now: Date,
): ShareDraft => {
  const anchor = items.at(-1)!;
  const names = items.map(item => item.record.beverageName || item.record.category || '今天这一杯');
  const shops = [...new Set(items.map(item => item.record.shopName).filter(Boolean))];
  return {
    recordId: anchor.record.id,
    channel,
    title: channel === 'redbook'
      ? `今天喝了 ${items.length} 杯｜快乐加倍`
      : `今天的 ${items.length} 杯小确幸`,
    body: `${names.map((name, index) => `${index + 1}. ${name}`).join('\n')}${shops.length ? `\n来自：${shops.join('、')}` : ''}\n每一杯都有自己的小心情。`,
    tags: channel === 'redbook'
      ? ['吨吨记', '今日饮品合集', '奶茶日常', '咖啡日记']
      : ['吨吨记', '今天的小确幸'],
    updatedAt: now.toISOString(),
  };
};

export const PublishStudioScreen = ({ navigation, route }: Props) => {
  const { repository, creativeRepository, assetStore, now } = useServices();
  const isFocused = useIsFocused();
  const [latest, setLatest] = useState<RecordAggregate | null>(null);
  const [dayRecords, setDayRecords] = useState<RecordAggregate[]>([]);
  const [channel, setChannel] = useState<ShareChannel>('redbook');
  const [draft, setDraft] = useState<ShareDraft | null>(null);
  const [project, setProject] = useState<CreativeProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [posterSize, setPosterSize] = useState({ width: 360, height: 353 });
  const posterRef = useRef<ViewInstance>(null);

  const load = useCallback(async () => {
    const archive = await repository.findSavedInRange(archiveStart, archiveEnd);
    const requested = route.params?.recordId
      ? archive.find(item => item.record.id === route.params?.recordId)
      : undefined;
    const selectedDay = route.params?.dayKey
      ? archive.filter(item => localDateKey(new Date(item.record.occurredAt)) === route.params?.dayKey)
      : [];
    const recent = requested
      ?? [...selectedDay].sort((a, b) => a.record.updatedAt.localeCompare(b.record.updatedAt)).at(-1)
      ?? [...archive].sort((a, b) => a.record.updatedAt.localeCompare(b.record.updatedAt)).at(-1)
      ?? null;
    setLatest(recent);
    setDayRecords(selectedDay);
    setProject(recent ? await creativeRepository.getProject(recent.record.id) : null);
  }, [creativeRepository, repository, route.params?.dayKey, route.params?.recordId]);

  useFocusEffect(useCallback(() => {
    load().catch(() => undefined);
  }, [load]));

  useEffect(() => {
    if (!latest) {
      setDraft(null);
      return;
    }
    if (route.params?.dayKey && dayRecords.length > 1) {
      setDraft(defaultsForCollection(dayRecords, channel, now()));
      return;
    }
    creativeRepository.getShareDraft(latest.record.id, channel)
      .then(stored => setDraft(stored ?? defaultsFor(latest, channel, now())))
      .catch(() => setDraft(defaultsFor(latest, channel, now())));
  }, [channel, creativeRepository, dayRecords, latest, now, route.params?.dayKey]);

  const asset = latest ? displayAssetFor(latest) : undefined;
  const imageUri = asset ? assetStore.resolveUri(asset) : undefined;
  const collectionMode = Boolean(route.params?.dayKey && dayRecords.length > 1);
  const collectionItems = collectionMode
    ? dayRecords.map(item => {
      const itemAsset = displayAssetFor(item);
      return {
        id: item.record.id,
        label: item.record.beverageName || item.record.category || '今天这一杯',
        uri: itemAsset ? assetStore.resolveUri(itemAsset) : undefined,
      };
    })
    : [];
  const posterCanvasElements = useMemo(
    () => project && latest && !collectionMode
      ? hydrateCreativeCanvasElements(project, latest.journalStickers)
        .filter(element => element.visible)
        .sort((first, second) => first.zIndex - second.zIndex)
      : [],
    [collectionMode, latest, project],
  );
  const legacyPosterStickers: JournalSticker[] = collectionMode
    ? [...new Map(
        dayRecords
          .flatMap(item => item.journalStickers ?? [])
          .map(sticker => [sticker.id, sticker] as const),
      ).values()]
    : project
      ? []
      : latest?.journalStickers ?? [];
  const tags = draft ? normalizeShareTags(draft.tags) : [];
  const editableTagsText = editableShareTags(tags).map(tag => `#${tag}`).join(' ');
  const completeCopy = draft ? buildShareCopy(draft) : '';
  const posterTitle = draft?.title.replaceAll('｜', ' · ') || '今天这一杯，也值得被记住';
  const sweetPhrase = '喝甜甜的';
  const sweetPhraseIndex = posterTitle.indexOf(sweetPhrase);

  const patchDraft = (patch: Partial<ShareDraft>) => {
    setDraft(current => current ? { ...current, ...patch, updatedAt: now().toISOString() } : current);
  };

  const persistDraft = async () => {
    // A collection has no single owning drink. Keeping it ephemeral prevents
    // its copy from overwriting the selected drink's own saved share draft.
    if (draft && !collectionMode) {
      await creativeRepository.saveShareDraft({
        ...prepareShareDraft(draft),
        updatedAt: now().toISOString(),
      });
    }
  };

  const capturePoster = async (): Promise<string> => {
    await persistDraft();
    if (!posterRef.current) {
      throw new Error('POSTER_CAPTURE_FAILED');
    }
    // Wait for the latest text/image layout to be committed before snapshotting.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const uri = await captureViewRef(posterRef.current, {
      format: 'jpg',
      quality: 0.96,
      result: 'tmpfile',
    });
    if (!uri) {
      throw new Error('POSTER_CAPTURE_FAILED');
    }
    return uri;
  };

  const ensureLegacyWritePermission = async () => {
    if (Platform.OS !== 'android' || Number(Platform.Version) > 28) return;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: '保存饮品海报',
        message: '允许写入相册后，完成的海报才可以保存在手机里。',
        buttonPositive: '允许',
        buttonNegative: '暂不',
      },
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('PHOTO_PERMISSION_DENIED');
    }
  };

  const saveUriToPhotos = async (uri: string) => {
    await ensureLegacyWritePermission();
    await CameraRoll.saveAsset(uri, Platform.OS === 'ios'
      ? { type: 'photo' }
      : { type: 'photo', album: '吨吨记' });
  };

  const showSaveError = (error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    if (__DEV__) console.warn('poster operation failed', error);
    if (detail.includes('POSTER_CAPTURE_FAILED') || detail.includes('findNodeHandle')) {
      Alert.alert('海报生成失败', '图片还没有准备好，请稍等一秒再试。');
    } else if (/denied|permission|PHOTO_PERMISSION/i.test(detail)) {
      Alert.alert('需要相册权限', '请在系统设置中允许“吨吨记”添加照片，然后再保存。');
    } else {
      Alert.alert('保存失败', '相册暂时没有写入成功，请稍后再试。');
    }
  };

  const savePoster = async () => {
    setBusy(true);
    try {
      const uri = await capturePoster();
      await saveUriToPhotos(uri);
      Alert.alert('已经存进相册', Platform.OS === 'ios'
        ? '整张海报已保存到系统照片。'
        : '整张海报已保存到“吨吨记”相册。');
    } catch (error) {
      showSaveError(error);
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    await persistDraft();
    Clipboard.setString(completeCopy);
    Alert.alert('甜甜文案装进口袋啦', '标题、正文和 #吨吨记 标签都已复制，可以直接去发布。');
  };

  const publishToSelectedApp = async () => {
    if (!draft) return;
    // Copy first so the user's complete caption is safe even if poster export
    // or a third-party app fails later in the hand-off.
    Clipboard.setString(completeCopy);
    setBusy(true);
    try {
      const uri = await capturePoster();
      let posterSaved = false;
      try {
        await saveUriToPhotos(uri);
        posterSaved = true;
      } catch (saveError) {
        if (__DEV__) console.warn('poster could not be added to photos before sharing', saveError);
      }
      if (await shareDirectlyToTarget(uri, draft.title.trim(), completeCopy, channel)) return;
      if (!posterSaved) {
        Alert.alert('文案已经装好，海报还差一步', '标题、正文和标签已复制；请允许相册权限后再试一次，海报才会出现在发布选择器里。');
        return;
      }
      const appUrl = channel === 'redbook' ? 'xhsdiscover://' : 'weixin://';
      const installed = await Linking.canOpenURL(appUrl);
      if (installed) {
        await Linking.openURL(appUrl);
        return;
      }
      Alert.alert(
        channel === 'redbook' ? '还没有安装小红书' : '还没有安装微信',
        '海报已经保存到相册，标题、正文和标签也已复制。安装对应 App 后就能继续发布。',
      );
    } catch (error) {
      if (__DEV__) console.warn('publishToSelectedApp failed', error);
      Alert.alert('发布入口暂时在躲猫猫', '完整文案已经复制；海报暂时没能送过去，请稍后再试。');
    } finally {
      setBusy(false);
    }
  };

  if (!latest || !draft) {
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <PaperTexture />
        <View style={styles.emptyPage}>
          <Text style={styles.emptyStar}>★</Text>
          <Text style={styles.emptyTitle}>先记录一杯，再生成海报</Text>
          <Text style={styles.emptyNote}>照片、店铺、甜度和心情会自动带到这里。</Text>
          <Pressable onPress={() => navigation.navigate('PhotoSource')} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>去记录第一杯</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <PaperTexture />
      <CuteMotionLayer active={isFocused} variant="bubbles" style={styles.screenMotion} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.navigate('Create')} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
            <View style={styles.channelTabs}>
              <Pressable onPress={() => setChannel('redbook')} style={[styles.channelTab, channel === 'redbook' && styles.channelActive]}>
                <Text style={[styles.channelText, channel === 'redbook' && styles.channelTextActive]}>✿ 小红书</Text>
              </Pressable>
              <Pressable onPress={() => setChannel('moments')} style={[styles.channelTab, channel === 'moments' && styles.channelActive]}>
                <Text style={[styles.channelText, channel === 'moments' && styles.channelTextActive]}>♡ 朋友圈</Text>
              </Pressable>
            </View>
            <View style={styles.topSpacer} />
          </View>

          <View style={styles.shareHero}>
            <View style={styles.shareMascot}>
              <Text style={styles.shareMascotFace}>• ᴗ •</Text>
              <View style={styles.shareMascotHandle} />
            </View>
            <View style={styles.shareHeroCopy}>
              <Text style={styles.shareEyebrow}>DUNDUN'S SWEET POST</Text>
              <Text style={styles.shareHeading}>把今天的甜，递给朋友</Text>
              <Text style={styles.shareSubheading}>海报和完整文案已经一起准备好啦</Text>
            </View>
            <TwinklingStar active={isFocused} size={16} style={styles.shareHeroStar} />
            <WobblingCharm active={isFocused} delay={700} kind="flower" size={11} style={styles.shareHeroCharm} />
          </View>

          <PocketCompanion mood="publish" active={isFocused} />
          <View style={styles.posterShell}>
            <View
              ref={posterRef}
              collapsable={false}
              onLayout={event => setPosterSize({
                width: event.nativeEvent.layout.width,
                height: event.nativeEvent.layout.height,
              })}
              style={[
                styles.poster,
                posterLayoutStyle(project?.layoutId),
                project?.layoutId === 'plain' && styles.posterPlain,
                project?.layoutId === 'checker' && styles.posterChecker,
              ]}
            >
              <LayoutDecorations layoutId={project?.layoutId} />
              {project?.layoutId !== 'plain' ? <View style={styles.redTape} /> : null}
              <Text style={styles.posterBubble}>好喝 +1</Text>
              <View style={styles.sunShape} />
              {collectionMode ? (
                <View style={styles.collectionGrid}>
                  {collectionItems.slice(0, 4).map((item, index) => (
                    <View key={item.id} style={[styles.collectionPhotoWrap, index % 2 === 0 ? styles.collectionTiltLeft : styles.collectionTiltRight]}>
                      {item.uri ? (
                        <Image source={{ uri: item.uri }} resizeMode="contain" style={styles.collectionPhoto} />
                      ) : (
                        <View style={styles.collectionNoPhoto}>
                          <Text style={styles.collectionNoPhotoCup}>☕︎</Text>
                          <Text numberOfLines={2} style={styles.collectionNoPhotoText}>{item.label}{'\n'}记住啦</Text>
                        </View>
                      )}
                      <Text style={styles.collectionIndex}>{index + 1}</Text>
                    </View>
                  ))}
                  {collectionItems.length > 4 ? <Text style={styles.collectionMore}>＋{collectionItems.length - 4}</Text> : null}
                  {!collectionItems.length ? (
                    <View style={styles.noPhotoCard}>
                      <Text style={styles.noPhotoCup}>☕︎</Text>
                      <Text style={styles.noPhotoTitle}>今天忘记拍照啦</Text>
                      <Text style={styles.noPhotoNote}>没关系，快乐已经被吨吨记接住</Text>
                    </View>
                  ) : null}
                </View>
              ) : project ? (
                <>
                  {!imageUri || !posterCanvasElements.some(element => element.kind === 'photo') ? (
                    <View style={styles.posterPhotoTouchLayer}>
                      <View style={[styles.posterImageSticker, styles.posterEmptyPhotoSticker]}>
                        <View style={styles.noPhotoCard}>
                          <Text style={styles.noPhotoCup}>☕︎</Text>
                          <Text style={styles.noPhotoTitle}>{imageUri ? '主图先去休息啦' : '这一杯没有照片'}</Text>
                          <Text style={styles.noPhotoNote}>{imageUri ? '今天用文字和贴纸，也一样可爱' : '但今天的小甜，已经好好记下啦'}</Text>
                        </View>
                      </View>
                    </View>
                  ) : null}
                  {posterCanvasElements.map(element => {
                    if (element.kind === 'photo') {
                      if (!imageUri) return null;
                      return (
                        <View key={element.id} style={[
                          styles.posterPhotoTouchLayer,
                          posterCanvasElementTransform(element, posterSize),
                        ]}>
                          <View style={[
                            styles.posterImageSticker,
                            project.cropAspect && posterCropStyle(project.cropAspect),
                            project.layoutId === 'polaroid' && styles.posterPolaroid,
                            project.layoutId === 'torn' && styles.posterTorn,
                          ]}>
                            <Image source={{ uri: imageUri }} resizeMode="contain" style={styles.posterPhoto} />
                          </View>
                        </View>
                      );
                    }
                    if (element.kind === 'catalog-sticker') {
                      return (
                        <View key={element.id} style={[
                          styles.posterCatalogSticker,
                          posterCanvasElementTransform(element, posterSize),
                        ]}>
                          <View style={styles.posterCatalogStickerPaper}>
                            <Text style={styles.posterCatalogStickerText}>{stickerSymbol(element.stickerId)}</Text>
                          </View>
                        </View>
                      );
                    }
                    const sticker = latest.journalStickers?.find(item => item.id === element.journalStickerId);
                    const stickerAsset = sticker ? journalStickerAssetFor(latest, sticker) : undefined;
                    if (!sticker || !stickerAsset) return null;
                    return (
                      <View key={element.id} style={[
                        styles.posterLifeSticker,
                        styles.posterLifeAnchor,
                        posterCanvasElementTransform(element, posterSize),
                        sticker.cutoutStatus === 'source-only' && styles.posterLifeFramed,
                      ]}>
                        {sticker.cutoutStatus === 'ready' ? (
                          <PaperCutoutSticker uri={assetStore.resolveUri(stickerAsset)} style={styles.posterLifeImage} />
                        ) : (
                          <Image source={{ uri: assetStore.resolveUri(stickerAsset) }} resizeMode="cover" style={styles.posterLifeImage} />
                        )}
                        <Text numberOfLines={1} style={styles.posterLifeLabel}>{sticker.label}</Text>
                      </View>
                    );
                  })}
                </>
              ) : (
                <View style={styles.posterPhotoTouchLayer}>
                  <View style={styles.posterImageSticker}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} resizeMode="contain" style={styles.posterPhoto} />
                    ) : (
                      <View style={styles.noPhotoCard}>
                        <Text style={styles.noPhotoCup}>☕︎</Text>
                        <Text style={styles.noPhotoTitle}>这一杯没有照片</Text>
                        <Text style={styles.noPhotoNote}>但今天的小甜，已经好好记下啦</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              <Text style={styles.posterSmile}>☺</Text>
              <Text style={styles.posterCherry}>●</Text>
              {legacyPosterStickers.slice(0, collectionMode ? 3 : undefined).map(sticker => {
                const owner = collectionMode
                  ? dayRecords.find(item => item.assets.some(candidate => candidate.id === (sticker.cutoutAssetId ?? sticker.sourceAssetId))) ?? latest
                  : latest;
                const stickerAsset = journalStickerAssetFor(owner, sticker);
                return stickerAsset ? (
                  <View key={sticker.id} style={[styles.posterLifeSticker, posterLifePosition(sticker), sticker.cutoutStatus === 'source-only' && styles.posterLifeFramed]}>
                    {sticker.cutoutStatus === 'ready' ? (
                      <PaperCutoutSticker uri={assetStore.resolveUri(stickerAsset)} style={styles.posterLifeImage} />
                    ) : (
                      <Image source={{ uri: assetStore.resolveUri(stickerAsset) }} resizeMode="cover" style={styles.posterLifeImage} />
                    )}
                    <Text numberOfLines={1} style={styles.posterLifeLabel}>{sticker.label}</Text>
                  </View>
                ) : null;
              })}
              <View pointerEvents="none" style={styles.posterHeadingCard}>
                <View style={styles.posterHeadingMascot}>
                  <Text style={styles.posterHeadingFace}>•ᴗ•</Text>
                  <View style={styles.posterHeadingHandle} />
                </View>
                <View style={styles.posterHeadingCopy}>
                  <Text style={styles.posterHeadingEyebrow}>今天这杯 · 甜甜登场</Text>
                  {collectionMode ? (
                    <Text numberOfLines={2} style={styles.posterTitle}>
                      今天喝了 <Text style={styles.posterTitleAccent}>{dayRecords.length} 杯</Text>，快乐加倍
                    </Text>
                  ) : sweetPhraseIndex >= 0 ? (
                    <Text numberOfLines={2} style={styles.posterTitle}>
                      {posterTitle.slice(0, sweetPhraseIndex)}
                      <Text style={styles.posterTitleAccent}>{sweetPhrase}</Text>
                      {posterTitle.slice(sweetPhraseIndex + sweetPhrase.length)}
                    </Text>
                  ) : (
                    <Text numberOfLines={2} style={styles.posterTitle}>{posterTitle}</Text>
                  )}
                </View>
                <Text style={styles.posterHeadingFlower}>✿</Text>
              </View>
              <Text style={styles.posterDate}>{new Date(latest.record.occurredAt).toLocaleDateString('zh-CN').replaceAll('/', '.')} {collectionMode ? `· ${dayRecords.length} CUPS` : ''}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭海报预览"
              hitSlop={12}
              onPress={() => navigation.navigate('Create')}
              style={styles.posterCloseButton}
            >
              <Text style={styles.posterClose}>×</Text>
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <View style={styles.formHeadingIcon}><Text style={styles.formHeadingFace}>•ᴗ•</Text></View>
              <View style={styles.formHeadingCopy}>
                <Text style={styles.formTitle}>给文案撒一点糖</Text>
                <Text style={styles.formNote}>标题、正文、标签会一起带去发布</Text>
              </View>
              <Text style={styles.formFlower}>✿</Text>
            </View>
            <View style={styles.formRow}>
              <Text style={styles.rowIcon}>▣</Text>
              <Text style={styles.rowLabel}>标题</Text>
              <TextInput
                accessibilityLabel="海报标题"
                value={draft.title}
                onChangeText={title => patchDraft({ title })}
                onBlur={() => persistDraft().catch(() => undefined)}
                style={styles.input}
                placeholder="写一句标题"
                placeholderTextColor={colors.inkMuted}
              />
            </View>
            <View style={[styles.formRow, styles.formBorder, styles.bodyRow]}>
              <Text style={styles.rowIcon}>▤</Text>
              <Text style={styles.rowLabel}>正文</Text>
              <TextInput
                accessibilityLabel="分享正文"
                value={draft.body}
                multiline
                onChangeText={body => patchDraft({ body })}
                onBlur={() => persistDraft().catch(() => undefined)}
                style={[styles.input, styles.bodyInput]}
                placeholder="写下这一杯的心情"
                placeholderTextColor={colors.inkMuted}
              />
            </View>
            <View style={[styles.formRow, styles.formBorder]}>
              <Text style={styles.rowIcon}>◇</Text>
              <Text style={styles.rowLabel}>标签</Text>
              <View style={styles.tagEditor}>
                <Text style={styles.brandTag}>#吨吨记</Text>
                <TextInput
                  accessibilityLabel="分享标签"
                  value={editableTagsText}
                  onChangeText={value => patchDraft({ tags: parseShareTags(value) })}
                  onBlur={() => persistDraft().catch(() => undefined)}
                  style={[styles.input, styles.tagInput]}
                  placeholder="#每日一杯"
                  placeholderTextColor={colors.inkMuted}
                />
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            <View style={styles.secondaryActionRow}>
              <Pressable disabled={busy} onPress={() => savePoster().catch(() => undefined)} style={({ pressed }) => [styles.actionButton, styles.saveButton, (pressed || busy) && styles.actionPressed]}>
                <Text style={styles.actionIcon}>⇩</Text>
                <View><Text style={styles.actionText}>收进相册</Text><Text style={styles.actionHint}>保存高清海报</Text></View>
              </Pressable>
              <Pressable onPress={() => copyText().catch(() => undefined)} style={({ pressed }) => [styles.actionButton, styles.copyButton, pressed && styles.actionPressed]}>
                <Text style={styles.actionIcon}>▣</Text>
                <View><Text style={styles.actionText}>复制文案</Text><Text style={styles.actionHint}>标题正文和标签</Text></View>
              </Pressable>
            </View>
            <Pressable disabled={busy} onPress={() => publishToSelectedApp().catch(() => undefined)} style={({ pressed }) => [styles.shareButton, (pressed || busy) && styles.actionPressed]}>
              <View style={styles.shareButtonMascot}><Text style={styles.shareButtonFace}>•ᴗ•</Text></View>
              <View style={styles.shareButtonCopy}>
                <Text style={styles.shareButtonTitle}>{busy ? '正在装好甜甜包裹…' : channel === 'redbook' ? '带着文案去小红书' : '带着文案去朋友圈'}</Text>
                <Text style={styles.shareButtonNote}>海报 + 标题 + 正文 + #吨吨记</Text>
              </View>
              <Text style={styles.shareArrow}>↗</Text>
            </Pressable>
            <Text style={styles.shareCapabilityNote}>不同 App 的接收规则可能不同；若文字没有自动带入，完整文案也已经同步复制到剪贴板。</Text>
          </View>
          <View style={styles.privacyPill}><Text style={styles.privacyHeart}>♡</Text><Text style={styles.privacy}>记录默认私密 · 只有你主动分享时才会离开本机</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const posterLayoutStyle = (layoutId?: string) => {
  const layout = journalLayouts.find(item => item.id === layoutId);
  return layout ? { backgroundColor: layout.paper, borderColor: layout.accent } : undefined;
};
const posterCanvasElementTransform = (
  element: CreativeCanvasElement,
  posterSize: { width: number; height: number },
) => ({
  // Keep every editable canvas element beneath the protected title card.
  zIndex: Math.min(19, Math.max(2, element.zIndex + 3)),
  transform: [
    { translateX: element.positionX * posterSize.width },
    { translateY: element.positionY * posterSize.height },
    { rotate: `${element.rotationDegrees}deg` },
    { scale: element.scale },
  ],
});
const posterCropStyle = (aspect: CreativeProject['cropAspect']) => aspect === 'original'
  ? undefined
  : {
      flex: 0,
      height: '100%' as const,
      aspectRatio: aspect === '1:1' ? 1 : aspect === '4:5' ? 0.8 : 9 / 16,
      alignSelf: 'center' as const,
    };
const posterLifePosition = (sticker: JournalSticker) => ({
  left: `${8 + sticker.positionX * 58}%` as `${number}%`,
  top: `${11 + sticker.positionY * 53}%` as `${number}%`,
  transform: [{ rotate: `${sticker.rotationDegrees}deg` }, { scale: sticker.scale }],
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  screenMotion: { opacity: 0.8 },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 30, gap: 13 },
  topBar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, justifyContent: 'center', zIndex: 2 },
  backText: { color: colors.ink, fontSize: 34, lineHeight: 38 },
  topSpacer: { width: 44 },
  channelTabs: { width: 206, height: 39, padding: 4, flexDirection: 'row', borderRadius: 21, backgroundColor: colors.paperDeep, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  channelTab: { flex: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  channelActive: { backgroundColor: colors.card, shadowColor: colors.cocoa, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  channelText: { color: colors.inkMuted, fontSize: 11, fontWeight: '600' },
  channelTextActive: { color: '#A14E45', fontWeight: '900' },
  shareHero: { minHeight: 88, paddingVertical: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDD5BF', backgroundColor: '#FFF5E7', shadowColor: colors.cocoa, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  shareMascot: { width: 53, height: 53, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 2, borderColor: colors.white, backgroundColor: colors.blushSoft, transform: [{ rotate: '-4deg' }], shadowColor: colors.cocoa, shadowOpacity: 0.11, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  shareMascotFace: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  shareMascotHandle: { position: 'absolute', right: -8, top: 17, width: 13, height: 20, borderWidth: 3, borderLeftWidth: 0, borderColor: colors.blush, borderTopRightRadius: 9, borderBottomRightRadius: 9 },
  shareHeroCopy: { flex: 1, marginLeft: 13 },
  shareEyebrow: { color: colors.creamDeep, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  shareHeading: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 19, lineHeight: 24, fontWeight: '900' },
  shareSubheading: { marginTop: 3, color: colors.inkMuted, fontSize: 9.5, lineHeight: 14 },
  shareHeroStar: { position: 'absolute', right: 15, top: 10 },
  shareHeroCharm: { position: 'absolute', right: 11, bottom: 8 },
  // Match the creative canvas' aspect ratio and 25px content inset so every
  // persisted normalized transform lands at the same visual position here.
  posterShell: { position: 'relative', width: '100%' },
  poster: { width: '100%', aspectRatio: 1.04, padding: 25, overflow: 'hidden', borderRadius: 30, backgroundColor: '#F7E7CC', borderWidth: 1, borderColor: colors.line, shadowColor: colors.cocoa, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  posterPlain: { backgroundColor: colors.card },
  posterChecker: { borderWidth: 7, borderColor: colors.blushSoft },
  redTape: { position: 'absolute', top: 4, left: 28, width: 69, height: 20, backgroundColor: colors.blush, opacity: 0.62, transform: [{ rotate: '7deg' }] },
  posterCloseButton: { position: 'absolute', right: 6, top: 5, zIndex: 10001, elevation: 31, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: 'rgba(255,252,246,0.86)' },
  posterClose: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  posterHeadingCard: { position: 'absolute', left: 14, right: 45, top: 23, zIndex: 10000, minHeight: 88, paddingVertical: 10, paddingLeft: 11, paddingRight: 17, flexDirection: 'row', alignItems: 'center', borderRadius: 23, borderWidth: 1, borderColor: 'rgba(232,218,200,0.92)', backgroundColor: 'rgba(255,252,246,0.98)', shadowColor: colors.cocoa, shadowOpacity: 0.13, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 30 },
  posterHeadingMascot: { width: 43, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.butterSoft, borderWidth: 2, borderColor: colors.white, transform: [{ rotate: '-5deg' }] },
  posterHeadingFace: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  posterHeadingHandle: { position: 'absolute', right: -7, top: 15, width: 11, height: 17, borderWidth: 2.5, borderLeftWidth: 0, borderColor: colors.creamDeep, borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  posterHeadingCopy: { flex: 1, marginLeft: 10 },
  posterHeadingEyebrow: { color: colors.creamDeep, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  posterHeadingFlower: { position: 'absolute', right: 7, top: 5, color: colors.blush, fontSize: 13, transform: [{ rotate: '12deg' }] },
  posterTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 19, lineHeight: 23, fontWeight: '900', letterSpacing: 0.2 },
  posterTitleAccent: { color: '#E55F5B' },
  sunShape: { position: 'absolute', left: '16%', right: '16%', top: '34%', bottom: '7%', borderRadius: 110, backgroundColor: colors.butter },
  posterPhotoTouchLayer: { position: 'absolute', left: 25, right: 25, top: 25, bottom: 25, zIndex: 2 },
  posterImageSticker: { flex: 1, padding: 6, borderRadius: 28, backgroundColor: colors.white, transform: [{ rotate: '-1deg' }], shadowColor: colors.cocoa, shadowOpacity: 0.13, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  posterEmptyPhotoSticker: { transform: [{ rotate: '-1deg' }] },
  posterPolaroid: { paddingBottom: 28, borderRadius: 4 },
  posterTorn: { borderRadius: 7, transform: [{ rotate: '-1.6deg' }] },
  posterPhoto: { flex: 1, borderRadius: 20, resizeMode: 'contain' },
  posterCatalogSticker: { position: 'absolute', right: 11, top: 21, zIndex: 8, minWidth: 58, minHeight: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  posterCatalogStickerPaper: { minWidth: 55, minHeight: 55, padding: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,253,247,0.78)', shadowColor: colors.cocoa, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  posterCatalogStickerText: { color: colors.blush, fontSize: 42, textShadowColor: colors.white, textShadowRadius: 3 },
  collectionGrid: { position: 'absolute', left: '18%', right: '18%', top: '37%', bottom: '10%', zIndex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center', alignContent: 'center' },
  collectionPhotoWrap: { width: '46%', height: '46%', padding: 3, borderRadius: 13, backgroundColor: colors.white, shadowColor: colors.cocoa, shadowOpacity: 0.13, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  collectionPhoto: { width: '100%', height: '100%', borderRadius: 10 },
  collectionNoPhoto: { flex: 1, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.butterSoft },
  collectionNoPhotoCup: { color: colors.creamDeep, fontSize: 18, lineHeight: 22 },
  collectionNoPhotoText: { marginTop: 2, color: colors.ink, fontSize: 7.5, lineHeight: 10, fontWeight: '800', textAlign: 'center' },
  collectionTiltLeft: { transform: [{ rotate: '-2.5deg' }] },
  collectionTiltRight: { transform: [{ rotate: '2.5deg' }] },
  collectionIndex: { position: 'absolute', left: 5, top: 5, width: 18, height: 18, lineHeight: 18, borderRadius: 9, overflow: 'hidden', color: colors.white, backgroundColor: colors.blush, fontSize: 8, fontWeight: '900', textAlign: 'center' },
  collectionMore: { position: 'absolute', right: -12, bottom: 1, minWidth: 30, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 13, overflow: 'hidden', color: colors.white, backgroundColor: colors.creamDeep, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  noPhotoCard: { flex: 1, width: '100%', minHeight: 96, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: '#FFF8DF' },
  noPhotoCup: { color: colors.creamDeep, fontSize: 27, lineHeight: 33 },
  noPhotoTitle: { marginTop: 2, color: colors.ink, fontSize: 11, lineHeight: 15, fontWeight: '900', textAlign: 'center' },
  noPhotoNote: { marginTop: 3, color: colors.inkMuted, fontSize: 7.5, lineHeight: 11, textAlign: 'center' },
  posterBubble: { position: 'absolute', zIndex: 3, left: 12, top: '49%', paddingVertical: 7, paddingHorizontal: 9, overflow: 'hidden', borderRadius: 16, color: colors.ink, backgroundColor: colors.skySoft, fontSize: 9, fontWeight: '900', transform: [{ rotate: '-8deg' }] },
  posterSmile: { position: 'absolute', left: 31, bottom: 22, color: colors.ink, fontSize: 28 },
  posterCherry: { position: 'absolute', left: 88, bottom: 13, color: colors.blush, fontSize: 28 },
  posterDate: { position: 'absolute', right: 14, bottom: 12, zIndex: 3, paddingVertical: 5, paddingHorizontal: 8, overflow: 'hidden', color: colors.ink, backgroundColor: colors.card, fontSize: 9, fontWeight: '700', transform: [{ rotate: '-2deg' }] },
  posterLifeSticker: { position: 'absolute', zIndex: 4, width: 94, height: 116, padding: 4, borderRadius: 12 },
  posterLifeAnchor: { left: '8%', top: '11%' },
  posterLifeFramed: { backgroundColor: colors.white },
  posterLifeImage: { flex: 1, width: '100%' },
  posterLifeLabel: { color: colors.ink, fontSize: 7, fontWeight: '900', textAlign: 'center', textShadowColor: colors.white, textShadowRadius: 2 },
  formCard: { paddingHorizontal: 14, paddingBottom: 3, overflow: 'hidden', borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.card, shadowColor: colors.cocoa, shadowOpacity: 0.07, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  formHeading: { minHeight: 67, marginHorizontal: -14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3DF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  formHeadingIcon: { width: 37, height: 37, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.blushSoft, transform: [{ rotate: '-3deg' }] },
  formHeadingFace: { color: colors.ink, fontSize: 9, fontWeight: '900' },
  formHeadingCopy: { flex: 1, marginLeft: 10 },
  formTitle: { color: colors.ink, fontFamily: typography.title, fontSize: 14, fontWeight: '900' },
  formNote: { marginTop: 2, color: colors.inkMuted, fontSize: 8.5 },
  formFlower: { color: colors.blush, fontSize: 17 },
  formRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center' },
  bodyRow: { minHeight: 72, alignItems: 'flex-start', paddingTop: 15 },
  formBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  rowIcon: { width: 26, color: colors.cocoa, fontSize: 15 },
  rowLabel: { width: 42, color: colors.ink, fontSize: 11, fontWeight: '800' },
  input: { flex: 1, paddingVertical: 8, color: colors.ink, fontSize: 11 },
  bodyInput: { minHeight: 53, paddingTop: 0, textAlignVertical: 'top' },
  tagEditor: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandTag: { paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden', borderRadius: 11, color: colors.danger, backgroundColor: colors.blushSoft, fontSize: 9, fontWeight: '900' },
  tagInput: { minWidth: 74 },
  actionRow: { gap: 9 },
  secondaryActionRow: { flexDirection: 'row', gap: 9 },
  actionButton: { flex: 1, minHeight: 67, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  saveButton: { backgroundColor: colors.butterSoft },
  copyButton: { backgroundColor: colors.mintSoft },
  actionIcon: { width: 29, color: colors.ink, fontSize: 20, fontWeight: '800' },
  actionText: { color: colors.ink, fontSize: 10.5, fontWeight: '900' },
  actionHint: { marginTop: 2, color: colors.inkMuted, fontSize: 7.5 },
  actionPressed: { opacity: 0.62, transform: [{ scale: 0.985 }] },
  shareButton: { minHeight: 78, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: '#EFBEBC', backgroundColor: colors.blushSoft, shadowColor: colors.blush, shadowOpacity: 0.15, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  shareButtonMascot: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 2, borderColor: colors.white, backgroundColor: colors.card, transform: [{ rotate: '-4deg' }] },
  shareButtonFace: { color: colors.danger, fontSize: 10, fontWeight: '900' },
  shareButtonCopy: { flex: 1, marginLeft: 12 },
  shareButtonTitle: { color: colors.ink, fontFamily: typography.title, fontSize: 13, fontWeight: '900' },
  shareButtonNote: { marginTop: 4, color: colors.danger, fontSize: 8.5, fontWeight: '700' },
  shareArrow: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  shareCapabilityNote: { paddingHorizontal: 8, color: colors.inkMuted, fontSize: 8, lineHeight: 12, textAlign: 'center' },
  privacyPill: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 15, backgroundColor: 'rgba(255,252,246,0.75)' },
  privacyHeart: { marginRight: 5, color: colors.blush, fontSize: 13, fontWeight: '900' },
  privacy: { color: colors.inkMuted, fontSize: 8.5, textAlign: 'center' },
  emptyPage: { flex: 1, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  emptyStar: { color: colors.butter, fontSize: 45 },
  emptyTitle: { marginTop: 16, color: colors.ink, fontSize: 19, fontWeight: '900' },
  emptyNote: { marginTop: 8, color: colors.inkMuted, fontSize: 12, textAlign: 'center' },
  emptyButton: { marginTop: 23, minWidth: 170, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  emptyButtonText: { color: colors.card, fontSize: 12, fontWeight: '800' },
});
