import Slider from '@react-native-community/slider';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MainTabParamList, RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { PaperCutoutSticker } from '../../design-system/components/PaperCutoutSticker';
import { CuteMotionLayer } from '../../design-system/components/CuteMotionBits';
import { CreamPromptModal } from '../../design-system/components/CreamPromptModal';
import { colors, typography } from '../../design-system/theme';
import {
  createCatalogCanvasElement,
  hydrateCreativeCanvasElements,
  patchCanvasElement,
  removeCanvasElement,
  restorePhotoCanvasElement,
} from '../../domain/creativeCanvas';
import type { CreativeProject, JournalSticker, RecordAggregate, StudioTool } from '../../domain/models';
import { filterCatalog } from '../../infrastructure/rendering/filters';
import { AiArtError } from '../../infrastructure/network/HttpAiArtService';
import { newId } from '../../shared/id';
import { saveRecord } from '../record-editor/saveRecord';
import { archiveEnd, archiveStart, displayAssetFor, journalStickerAssetFor } from '../shared/recordAssets';
import { aiStyleCategories, aiStyles, type AiStyleFilter } from './aiStyleCatalog';
import { StudioImagePreview } from './StudioImagePreview';
import { cuteStickers, stickerSymbol } from './stickerCatalog';
import { journalLayouts } from './layoutCatalog';
import {
  normalizedPositionFromTouchTransform,
  normalizeTouchRotation,
  TouchTransformView,
  type TouchTransform,
  touchTransformFromNormalizedPosition,
} from './TouchTransformView';
import { LayoutDecorations } from './LayoutDecorations';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Create'>,
  NativeStackScreenProps<RootStackParamList>
>;

const tools: { id: StudioTool; icon: string; label: string }[] = [
  { id: 'filter', icon: '◉', label: '滤镜' },
  { id: 'adjust', icon: '☷', label: '调整' },
  { id: 'crop', icon: '⌗', label: '裁切' },
  { id: 'sticker', icon: '☺', label: '贴纸' },
  { id: 'layout', icon: '▥', label: '排版' },
];

// Journal-sticker positions are persisted as 0...1 values. On this canvas the
// usable travel is deliberately inset so a normal-sized sticker stays visible.
// Converting both ways through the same spans prevents a sticker from jumping
// backwards after a gesture is committed and reloaded from SQLite.
const LIFE_STICKER_X_SPAN = 0.58;
const LIFE_STICKER_Y_SPAN = 0.53;

export const lifeStickerTouchTransform = (sticker: JournalSticker): TouchTransform => ({
  ...touchTransformFromNormalizedPosition(
    sticker.positionX,
    sticker.positionY,
    sticker.scale,
    sticker.rotationDegrees,
    LIFE_STICKER_X_SPAN,
    LIFE_STICKER_Y_SPAN,
  ),
});

export const lifeStickerPatchFromTouch = (next: TouchTransform): Partial<JournalSticker> => {
  const normalized = normalizedPositionFromTouchTransform(
    next,
    LIFE_STICKER_X_SPAN,
    LIFE_STICKER_Y_SPAN,
  );
  return {
    positionX: normalized.positionX,
    positionY: normalized.positionY,
    scale: normalized.scale,
    rotationDegrees: normalized.rotation,
  };
};

const defaultProject = (recordId: string, now: Date): CreativeProject => ({
  recordId,
  selectedTool: 'filter',
  filterPresetId: 'cream-morning',
  filterIntensity: 0.75,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  cropAspect: 'original',
  rotationDegrees: 0,
  straightenDegrees: 0,
  flipHorizontal: false,
  flipVertical: false,
  stickerId: 'star',
  layoutId: 'torn',
  photoPositionX: 0,
  photoPositionY: 0,
  photoScale: 1,
  photoRotationDegrees: 0,
  stickerPositionX: 0,
  stickerPositionY: 0,
  stickerScale: 1,
  stickerRotationDegrees: 0,
  updatedAt: now.toISOString(),
});

const latestEdited = (records: RecordAggregate[]) => [...records].sort((a, b) =>
  a.record.updatedAt.localeCompare(b.record.updatedAt),
).at(-1) ?? null;

const syncProjectFromRecord = (
  aggregate: RecordAggregate,
  stored: CreativeProject | null,
  currentTime: Date,
): CreativeProject => {
  const base = stored ?? defaultProject(aggregate.record.id, currentTime);
  if (!aggregate.recipe || stored && stored.updatedAt > aggregate.record.updatedAt) return base;
  return {
    ...base,
    filterPresetId: aggregate.recipe.presetId,
    filterIntensity: aggregate.recipe.intensity,
    brightness: aggregate.recipe.brightness,
    contrast: aggregate.recipe.contrast,
    saturation: aggregate.recipe.saturation,
    warmth: aggregate.recipe.warmth,
    cropAspect: aggregate.recipe.cropAspect,
    rotationDegrees: aggregate.recipe.rotationDegrees,
    straightenDegrees: aggregate.recipe.straightenDegrees,
    flipHorizontal: aggregate.recipe.flipHorizontal,
    flipVertical: aggregate.recipe.flipVertical,
    updatedAt: aggregate.record.updatedAt,
  };
};

export const CreateStudioScreen = ({ navigation, route }: Props) => {
  const { repository, creativeRepository, aiArtService, assetStore, imageRenderer, now } = useServices();
  const isFocused = useIsFocused();
  const [aggregate, setAggregate] = useState<RecordAggregate | null>(null);
  const [project, setProject] = useState<CreativeProject | null>(null);
  const [selectedAi, setSelectedAi] = useState('cream-poster');
  const [showAllAi, setShowAllAi] = useState(false);
  const [aiFilter, setAiFilter] = useState<AiStyleFilter>('全部');
  const [saving, setSaving] = useState(false);
  const [adjustment, setAdjustment] = useState<'filterIntensity' | 'brightness' | 'contrast' | 'saturation' | 'warmth'>('filterIntensity');
  const [undoStack, setUndoStack] = useState<CreativeProject[]>([]);
  const [redoStack, setRedoStack] = useState<CreativeProject[]>([]);
  const [expandedTool, setExpandedTool] = useState<StudioTool | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 360, height: 346 });
  const [selectedCanvasItem, setSelectedCanvasItem] = useState<string>('photo');
  const [finishNotice, setFinishNotice] = useState<'success' | 'error' | null>(null);
  const filterSnapshot = useRef<CreativeProject | null>(null);
  const projectSaveQueue = useRef<Promise<void>>(Promise.resolve());

  const queueProjectSave = useCallback((next: CreativeProject) => {
    const pending = projectSaveQueue.current
      .catch(() => undefined)
      .then(() => creativeRepository.saveProject(next));
    projectSaveQueue.current = pending;
    return pending;
  }, [creativeRepository]);

  const load = useCallback(async () => {
    // A tab can regain focus while the last gesture is still being persisted.
    // Read only after that queue settles so the screen cannot reload older coordinates.
    await projectSaveQueue.current.catch(() => undefined);
    const requested = route.params?.recordId
      ? await repository.findById(route.params.recordId)
      : null;
    const all = requested ? [] : await repository.findSavedInRange(archiveStart, archiveEnd);
    const latest = requested?.record.lifecycle === 'saved' ? requested : latestEdited(all);
    setAggregate(latest);
    setUndoStack([]);
    setRedoStack([]);
    if (latest) {
      const stored = await creativeRepository.getProject(latest.record.id);
      const synced = syncProjectFromRecord(latest, stored, now());
      const hydrated = {
        ...synced,
        canvasElements: hydrateCreativeCanvasElements(synced, latest.journalStickers),
      };
      setProject(hydrated);
      await queueProjectSave(hydrated);
      setSelectedCanvasItem(current =>
        hydrated.canvasElements.some(item => item.id === current && item.visible)
          ? current
          : hydrated.canvasElements.find(item => item.visible)?.id ?? 'photo',
      );
    } else {
      setProject(null);
    }
  }, [creativeRepository, now, queueProjectSave, repository, route.params?.recordId]);

  useFocusEffect(useCallback(() => {
    load().catch(() => undefined);
  }, [load]));

  // Always preview from the immutable original. Reopening the editor must not
  // apply rotations or flips a second time to an already rendered asset.
  const asset = aggregate
    ? aggregate.assets.find(item => item.id === aggregate.record.originalAssetId) ?? displayAssetFor(aggregate)
    : undefined;
  const imageUri = asset ? assetStore.resolveUri(asset) : undefined;
  const visibleAiStyles = useMemo(() => {
    const filtered = aiFilter === '全部'
      ? aiStyles
      : aiStyles.filter(item => item.category === aiFilter);
    return showAllAi ? filtered : filtered.slice(0, 2);
  }, [aiFilter, showAllAi]);
  const projectCanvasElements = project?.canvasElements ?? [];
  const selectedCanvasElement = projectCanvasElements.find(
    item => item.id === selectedCanvasItem && item.visible,
  );
  const selectedCanvasLabel = selectedCanvasElement?.kind === 'photo'
    ? '这一杯主图'
    : selectedCanvasElement?.kind === 'catalog-sticker'
      ? cuteStickers.find(item => item.id === selectedCanvasElement.stickerId)?.label ?? '趣味贴纸'
      : selectedCanvasElement?.kind === 'journal-sticker'
        ? aggregate?.journalStickers?.find(item => item.id === selectedCanvasElement.journalStickerId)?.label ?? '照片贴纸'
        : '先点选一个元素';

  const updateProject = useCallback((patch: Partial<CreativeProject>) => {
    if (!project) {
      return;
    }
    const next = { ...project, ...patch, updatedAt: now().toISOString() };
    setUndoStack(items => [...items, project].slice(-20));
    setRedoStack([]);
    setProject(next);
    queueProjectSave(next).catch(() => undefined);
  }, [now, project, queueProjectSave]);

  const commitCanvasElementTransform = useCallback((elementId: string, next: TouchTransform) => {
    if (!project?.canvasElements) return;
    const element = project.canvasElements.find(item => item.id === elementId);
    if (!element) return;
    const canvasElements = patchCanvasElement(project.canvasElements, elementId, {
      positionX: next.x,
      positionY: next.y,
      scale: next.scale,
      rotationDegrees: next.rotation,
    });
    const legacyPatch: Partial<CreativeProject> = element.kind === 'photo'
      ? {
          photoPositionX: next.x,
          photoPositionY: next.y,
          photoScale: next.scale,
          photoRotationDegrees: next.rotation,
        }
      : element.kind === 'catalog-sticker'
        ? {
            stickerId: element.stickerId,
            stickerPositionX: next.x,
            stickerPositionY: next.y,
            stickerScale: next.scale,
            stickerRotationDegrees: next.rotation,
          }
        : {};
    updateProject({ ...legacyPatch, canvasElements });
  }, [project, updateProject]);

  const addCatalogSticker = useCallback((stickerId: string) => {
    if (!project?.canvasElements || stickerId === 'none') return;
    const added = createCatalogCanvasElement(newId(), stickerId, project.canvasElements);
    updateProject({
      stickerId,
      canvasElements: [...project.canvasElements, added],
    });
    setSelectedCanvasItem(added.id);
  }, [project, updateProject]);

  const deleteCanvasElement = useCallback((elementId: string) => {
    if (!project?.canvasElements) return;
    const canvasElements = removeCanvasElement(project.canvasElements, elementId);
    updateProject({ canvasElements });
    setSelectedCanvasItem(
      canvasElements.filter(item => item.visible && item.id !== elementId).at(-1)?.id ?? '',
    );
  }, [project, updateProject]);

  const restorePhoto = useCallback(() => {
    if (!project?.canvasElements) return;
    const canvasElements = restorePhotoCanvasElement(project, project.canvasElements);
    const photo = canvasElements.find(item => item.kind === 'photo');
    updateProject({ canvasElements });
    if (photo) setSelectedCanvasItem(photo.id);
  }, [project, updateProject]);

  const nudgeSelectedCanvasElement = useCallback((patch: {
    scaleDelta?: number;
    rotationDelta?: number;
  }) => {
    if (!project?.canvasElements) return;
    const selected = project.canvasElements.find(item => item.id === selectedCanvasItem && item.visible);
    if (!selected) return;
    commitCanvasElementTransform(selected.id, {
      x: selected.positionX,
      y: selected.positionY,
      scale: Math.max(selected.kind === 'photo' ? 0.5 : 0.35, Math.min(4, selected.scale + (patch.scaleDelta ?? 0))),
      rotation: normalizeTouchRotation(selected.rotationDegrees + (patch.rotationDelta ?? 0)),
    });
  }, [commitCanvasElementTransform, project, selectedCanvasItem]);

  const cancelFilterSelection = useCallback(() => {
    if (filterSnapshot.current) {
      const restored = { ...filterSnapshot.current, updatedAt: now().toISOString() };
      setProject(restored);
      queueProjectSave(restored).catch(() => undefined);
    }
    filterSnapshot.current = null;
    setExpandedTool(null);
  }, [now, queueProjectSave]);

  const confirmFilterSelection = useCallback(() => {
    filterSnapshot.current = null;
    setExpandedTool(null);
  }, []);

  const previewAdjustment = useCallback((key: typeof adjustment, value: number) => {
    setProject(current => current ? {
      ...current,
      [key]: value,
      updatedAt: now().toISOString(),
    } : current);
  }, [now]);

  const persistAdjustment = useCallback((key: typeof adjustment, value: number) => {
    setProject(current => {
      if (!current) return current;
      const next = { ...current, [key]: value, updatedAt: now().toISOString() };
      queueProjectSave(next).catch(() => undefined);
      return next;
    });
  }, [now, queueProjectSave]);

  const restoreProject = useCallback((direction: 'undo' | 'redo') => {
    if (!project) {
      return;
    }
    const source = direction === 'undo' ? undoStack : redoStack;
    const restored = source.at(-1);
    if (!restored) {
      return;
    }
    const next = { ...restored, updatedAt: now().toISOString() };
    if (direction === 'undo') {
      setUndoStack(source.slice(0, -1));
      setRedoStack(items => [...items, project].slice(-20));
    } else {
      setRedoStack(source.slice(0, -1));
      setUndoStack(items => [...items, project].slice(-20));
    }
    setProject(next);
    queueProjectSave(next).catch(() => undefined);
  }, [now, project, queueProjectSave, redoStack, undoStack]);

  const finishFreeEdit = async () => {
    if (!aggregate || !project) {
      navigation.navigate('PhotoSource');
      return;
    }
    setSaving(true);
    try {
      await queueProjectSave({ ...project, updatedAt: now().toISOString() });
      await saveRecord({
        aggregate,
        intensity: project.filterIntensity,
        presetId: project.filterPresetId,
        edits: {
          brightness: project.brightness,
          contrast: project.contrast,
          saturation: project.saturation,
          warmth: project.warmth,
          cropAspect: project.cropAspect,
          rotationDegrees: project.rotationDegrees,
          straightenDegrees: project.straightenDegrees,
          flipHorizontal: project.flipHorizontal,
          flipVertical: project.flipVertical,
        },
        form: {
          occurredAt: aggregate.record.occurredAt,
          beverageName: aggregate.record.beverageName,
          category: aggregate.record.category,
          shopName: aggregate.record.shopName,
          sugarLevel: aggregate.record.sugarLevel,
          temperature: aggregate.record.temperature,
          city: aggregate.record.city,
          mood: aggregate.record.mood,
          note: aggregate.record.note,
        },
      }, { repository, assetStore, imageRenderer, now, createId: newId });
      // Recheck after rendering: while the save button disabled the canvas, an
      // already-active gesture could still have delivered its final release.
      await projectSaveQueue.current;
      await load();
      setFinishNotice('success');
    } catch {
      setFinishNotice('error');
    } finally {
      setSaving(false);
    }
  };

  const startAi = async () => {
    if (!aggregate || !imageUri) {
      navigation.navigate('PhotoSource');
      return;
    }
    if (!aiArtService.isConfigured) {
      Alert.alert(
        '还差 AI 服务端',
        '界面、风格参数、任务表和失败返还逻辑已经就位。请提供火山引擎服务端地址与模型信息后，即可真实生成；密钥不会放进手机端。',
      );
      return;
    }
    const createdAt = now().toISOString();
    const job = {
      id: newId(), recordId: aggregate.record.id, styleId: selectedAi,
      status: 'queued' as const, createdAt, updatedAt: createdAt,
    };
    await creativeRepository.createAiJob(job);
    try {
      await aiArtService.createGeneration({
        jobId: job.id, recordId: job.recordId, styleId: job.styleId, imageUri,
      });
      await creativeRepository.updateAiJob({ ...job, status: 'processing', updatedAt: now().toISOString() });
      Alert.alert('开始创作了', '可以离开这一页，完成后会出现在历史海报里。');
    } catch (error) {
      const code = error instanceof AiArtError ? error.code : 'AI_SERVICE_UNKNOWN';
      await creativeRepository.updateAiJob({
        ...job,
        status: 'failed',
        errorMessage: error instanceof AiArtError ? error.message : '服务暂时不可用',
        updatedAt: now().toISOString(),
      });
      if (code === 'AI_QUOTA_EXHAUSTED') {
        Alert.alert('需要邀请码', 'AI 创作需要邀请码次数。兑换邀请码后，就能开始创作。', [
          { text: '稍后再说', style: 'cancel' },
          { text: '去兑换', onPress: () => navigation.navigate('Membership') },
        ]);
      } else if (code === 'AI_AUTH_REQUIRED') {
        Alert.alert('请先登录', 'AI 创作需要登录账号。登录后本机记录仍会保留。', [
          { text: '稍后再说', style: 'cancel' },
          { text: '去登录', onPress: () => navigation.navigate('Account') },
        ]);
      } else {
        Alert.alert('这次没有生成', '没有扣除创作次数，请稍后再试。');
      }
    }
  };

  const toolOptions = useMemo(() => {
    if (!project) {
      return null;
    }
    if (project.selectedTool === 'filter') {
      return (
        <View style={styles.filterPanel}>
          <View style={styles.filterHeader}>
            <Pressable accessibilityLabel="取消滤镜选择" onPress={cancelFilterSelection} style={styles.filterCancel}><Text style={styles.filterCancelText}>取消</Text></Pressable>
            <Text style={styles.filterHint}>选择一款今天的光线</Text>
            <Pressable accessibilityLabel="应用滤镜" onPress={confirmFilterSelection} style={styles.filterApply}><Text style={styles.filterApplyText}>应用</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRail}>
            {filterCatalog.map((filter, index) => (
              <Pressable key={filter.id} onPress={() => updateProject({ filterPresetId: filter.id })} style={styles.filterOption}>
                <View style={[styles.filterSwatch, { backgroundColor: filterTones[index] }, project.filterPresetId === filter.id && styles.optionSelected]}>
                  {imageUri ? <Image source={{ uri: imageUri }} style={styles.swatchImage} /> : null}
                </View>
                <Text style={[styles.optionText, project.filterPresetId === filter.id && styles.optionTextSelected]}>{filter.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      );
    }
    if (project.selectedTool === 'adjust') {
      const values = [
        ['filterIntensity', '强度'],
        ['brightness', '亮度'],
        ['contrast', '对比'],
        ['saturation', '饱和'],
        ['warmth', '色温'],
      ] as const;
      const value = project[adjustment];
      return (
        <View style={styles.adjustPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adjustRail}>
            {values.map(([key, label]) => (
              <Pressable key={key} onPress={() => setAdjustment(key)} style={[styles.adjustChip, adjustment === key && styles.adjustChipSelected]}>
                <Text style={[styles.adjustChipText, adjustment === key && styles.adjustChipTextSelected]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.sliderPanel}>
            <Slider
              accessibilityLabel={values.find(([key]) => key === adjustment)?.[1]}
              style={styles.slider}
              minimumValue={adjustment === 'filterIntensity' ? 0 : -1}
              maximumValue={1}
              value={value}
              minimumTrackTintColor={colors.creamDeep}
              maximumTrackTintColor={colors.line}
              thumbTintColor={colors.card}
              onValueChange={nextValue => previewAdjustment(adjustment, nextValue)}
              onSlidingComplete={nextValue => persistAdjustment(adjustment, nextValue)}
            />
            <Text style={styles.sliderValue}>{Math.round(value * 100)}</Text>
          </View>
        </View>
      );
    }
    const entries = project.selectedTool === 'crop'
      ? [['original', '原图'], ['1:1', '1:1'], ['4:5', '4:5'], ['9:16', '9:16'], ['rotate', `旋转 ${project.rotationDegrees}°`], ['flipH', '水平翻转'], ['flipV', '垂直翻转']]
      : project.selectedTool === 'sticker'
        ? cuteStickers.filter(item => item.id !== 'none').map(item => [item.id, `＋ ${item.symbol} ${item.label}`])
        : journalLayouts.map(item => [item.id, `${item.icon} ${item.name}`]);
    const selected = project.selectedTool === 'crop' ? project.cropAspect : project.selectedTool === 'sticker' ? project.stickerId : project.layoutId;
    const rail = (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        {entries.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => project.selectedTool === 'crop'
              ? value === 'rotate'
                ? updateProject({ rotationDegrees: ((project.rotationDegrees + 90) % 360) as CreativeProject['rotationDegrees'] })
                : value === 'flipH'
                  ? updateProject({ flipHorizontal: !project.flipHorizontal })
                  : value === 'flipV'
                    ? updateProject({ flipVertical: !project.flipVertical })
                    : updateProject({ cropAspect: value as CreativeProject['cropAspect'] })
              : project.selectedTool === 'sticker'
                ? value && addCatalogSticker(value)
                : updateProject({ layoutId: value })}
            style={[
              styles.optionChip,
              (selected === value || value === 'flipH' && project.flipHorizontal || value === 'flipV' && project.flipVertical) && styles.optionChipSelected,
            ]}
          >
            <Text style={[
              styles.optionChipText,
              (selected === value || value === 'flipH' && project.flipHorizontal || value === 'flipV' && project.flipVertical) && styles.optionChipTextSelected,
            ]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
    if (project.selectedTool === 'crop') {
      return (
        <View style={styles.cropPanel}>
          {rail}
          <View style={styles.straightenRow}>
            <Text style={styles.straightenLabel}>拉直</Text>
            <Slider
              accessibilityLabel="拉直角度"
              style={styles.slider}
              minimumValue={-15}
              maximumValue={15}
              step={0.5}
              value={project.straightenDegrees}
              minimumTrackTintColor={colors.creamDeep}
              maximumTrackTintColor={colors.line}
              thumbTintColor={colors.card}
              onValueChange={straightenDegrees => setProject(current => current ? {
                ...current,
                straightenDegrees,
              } : current)}
              onSlidingComplete={straightenDegrees => updateProject({ straightenDegrees })}
            />
            <Text style={styles.sliderValue}>{project.straightenDegrees.toFixed(1)}°</Text>
          </View>
        </View>
      );
    }
    if (project.selectedTool === 'sticker') {
      const canvasElements = project.canvasElements ?? [];
      return (
        <View style={styles.lifeControlPanel}>
          <Text style={styles.stickerAddHint}>喜欢哪一张就点一下 · 同款也可以加很多张</Text>
          {rail}
          {canvasElements.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lifeControlRail}>
              <Text style={styles.lifeRailLabel}>作品图层 · 点选调整</Text>
              {canvasElements.map(element => {
                const journalSticker = element.kind === 'journal-sticker'
                  ? aggregate?.journalStickers?.find(item => item.id === element.journalStickerId)
                  : undefined;
                if (element.kind === 'journal-sticker' && !journalSticker) return null;
                const catalogNumber = element.kind === 'catalog-sticker'
                  ? canvasElements
                    .filter(item => item.kind === 'catalog-sticker')
                    .findIndex(item => item.id === element.id) + 1
                  : 0;
                const label = element.kind === 'photo'
                  ? '这一杯主图'
                  : element.kind === 'catalog-sticker'
                    ? `${stickerSymbol(element.stickerId)} ${cuteStickers.find(item => item.id === element.stickerId)?.label ?? '贴纸'} ${catalogNumber}`
                    : `${journalSticker?.category === 'outfit' ? '穿搭' : '美食'} · ${journalSticker?.label}`;
                const active = element.id === selectedCanvasItem && element.visible;
                return (
                  <Pressable key={element.id} onPress={() => {
                    if (!element.visible && project.canvasElements) {
                      updateProject({
                        canvasElements: patchCanvasElement(project.canvasElements, element.id, { visible: true }),
                      });
                    }
                    setSelectedCanvasItem(element.id);
                  }} style={[styles.lifeSelectChip, active && styles.lifeSelectChipActive]}>
                    <Text style={[styles.lifeSelectText, active && styles.lifeSelectTextActive]}>
                      {element.visible ? '✓' : '＋'} {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.lifeEmptyHint}>作品里还没有元素，先挑一张可爱贴纸吧</Text>
          )}
        </View>
      );
    }
    return rail;
  }, [addCatalogSticker, adjustment, aggregate, cancelFilterSelection, confirmFilterSelection, imageUri, persistAdjustment, previewAdjustment, project, selectedCanvasItem, updateProject]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <PaperTexture />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="回到日历" accessibilityHint="长按撤销" onLongPress={() => restoreProject('undo')} onPress={() => navigation.navigate('Diary')} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle} />
          <View style={styles.topActions}>
            <Pressable accessibilityHint="长按重做" onLongPress={() => restoreProject('redo')} disabled={saving} onPress={() => finishFreeEdit().catch(() => undefined)} style={styles.doneButton}>
              <Text style={styles.doneText}>{saving ? '保存中' : '完成'}</Text>
            </Pressable>
          </View>
        </View>

        <View
          onLayout={event => setCanvasSize(event.nativeEvent.layout)}
          style={[styles.canvas, layoutCanvasStyle(project?.layoutId)]}
        >
          <LayoutDecorations layoutId={project?.layoutId} />
          <CuteMotionLayer active={isFocused} variant="mixed" style={styles.canvasMotion} />
          {project?.layoutId !== 'plain' ? <View pointerEvents="none" style={styles.tape} /> : null}
          {!imageUri ? (
            <View style={styles.emptyCanvas}>
              <Text style={styles.emptyMascot}>🧋</Text>
              <Text style={styles.emptyTitle}>今天先写字，也很可爱</Text>
              <Text style={styles.emptySubtitle}>没有照片，就让文字和贴纸抱住这一杯</Text>
            </View>
          ) : !projectCanvasElements.some(item => item.kind === 'photo' && item.visible) && project ? (
            <Pressable onPress={restorePhoto} style={styles.emptyCanvas}>
              <Text style={styles.emptyIcon}>＋</Text>
              <Text style={styles.emptyTitle}>主图已从作品移开</Text>
              <Text style={styles.emptySubtitle}>点一下，把这一杯放回来</Text>
            </Pressable>
          ) : null}
          {project ? projectCanvasElements
            .filter(item => item.visible)
            .sort((first, second) => first.zIndex - second.zIndex)
            .map(element => {
              const selected = selectedCanvasItem === element.id;
              const commonProps = {
                active: isFocused && !saving,
                canvasWidth: canvasSize.width,
                canvasHeight: canvasSize.height,
                selected,
                onSelect: () => setSelectedCanvasItem(element.id),
                onDelete: () => deleteCanvasElement(element.id),
                onCommit: (next: TouchTransform) => commitCanvasElementTransform(element.id, next),
                syncToken: `${project.updatedAt}-${element.id}`,
                transform: {
                  x: element.positionX,
                  y: element.positionY,
                  scale: element.scale,
                  rotation: element.rotationDegrees,
                },
              };
              if (element.kind === 'photo') {
                if (!imageUri) return null;
                return (
                  <TouchTransformView
                    {...commonProps}
                    key={element.id}
                    minScale={0.5}
                    maxScale={3.5}
                    // The photo fills the whole canvas. Keeping it in its saved
                    // base layer lets the user still tap every sticker above it;
                    // promoting it on selection would make that full-size view
                    // swallow all later sticker touches.
                    style={[styles.photoTouchLayer, canvasElementZStyle(element.zIndex, false)]}
                  >
                    <View style={[
                      styles.imageSticker,
                      project.cropAspect && cropPreviewStyle(project.cropAspect),
                      project.layoutId === 'polaroid' && styles.polaroid,
                      project.layoutId === 'torn' && styles.tornFrame,
                    ]}>
                      <View style={[styles.heroImage, previewImageTransform(project)]}>
                        <StudioImagePreview uri={imageUri} project={project} />
                      </View>
                    </View>
                  </TouchTransformView>
                );
              }
              if (element.kind === 'catalog-sticker') {
                return (
                  <TouchTransformView
                    {...commonProps}
                    key={element.id}
                    minScale={0.35}
                    maxScale={4}
                    style={[
                      styles.heroStickerTouch,
                      canvasElementZStyle(element.zIndex, selected),
                    ]}
                  >
                    <View style={styles.catalogStickerPaper}>
                      <Text style={styles.heroSticker}>{stickerSymbol(element.stickerId)}</Text>
                    </View>
                  </TouchTransformView>
                );
              }
              const sticker = aggregate?.journalStickers?.find(
                item => item.id === element.journalStickerId,
              );
              const stickerAsset = sticker && aggregate
                ? journalStickerAssetFor(aggregate, sticker)
                : undefined;
              if (!sticker || !stickerAsset) return null;
              return (
                <TouchTransformView
                  {...commonProps}
                  key={element.id}
                  minX={0}
                  maxX={LIFE_STICKER_X_SPAN}
                  minY={0}
                  maxY={LIFE_STICKER_Y_SPAN}
                  minScale={0.35}
                  maxScale={2.5}
                  style={[
                    styles.lifeCanvasSticker,
                    styles.lifeCanvasStickerAnchor,
                    sticker.cutoutStatus === 'source-only' && styles.lifeCanvasStickerFramed,
                    canvasElementZStyle(element.zIndex, selected),
                  ]}
                >
                  {sticker.cutoutStatus === 'ready' ? (
                    <PaperCutoutSticker uri={assetStore.resolveUri(stickerAsset)} style={styles.lifeCanvasImage} />
                  ) : (
                    <Image source={{ uri: assetStore.resolveUri(stickerAsset) }} resizeMode="cover" style={styles.lifeCanvasImage} />
                  )}
                  <Text numberOfLines={1} style={styles.lifeCanvasLabel}>{sticker.label}</Text>
                </TouchTransformView>
              );
            }) : null}
          {project?.layoutId !== 'plain' ? <Text pointerEvents="none" style={styles.wave}>〜</Text> : null}
          {project?.layoutId === 'checker' || project?.layoutId === 'torn' ? (
            <View pointerEvents="none" style={styles.checker}>
              {Array.from({ length: 8 }, (_, index) => <View key={index} style={[styles.check, index % 2 === 0 && styles.checkFilled]} />)}
            </View>
          ) : null}
          {aggregate ? (
            <View pointerEvents="none" style={styles.dateLabel}>
              <Text style={styles.dateLabelText}>{new Date(aggregate.record.occurredAt).toLocaleDateString('zh-CN')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.canvasGuide}>✦ 主图与每张贴纸都能移动、缩放、旋转、删除（模板底纸固定）</Text>
        <View style={styles.elementControls}>
          <View style={styles.elementControlHeading}>
            <Text style={styles.elementControlEyebrow}>正在调整</Text>
            <Text numberOfLines={1} style={styles.elementControlName}>{selectedCanvasLabel}</Text>
          </View>
          <Pressable
            accessibilityLabel="缩小选中元素"
            disabled={!selectedCanvasElement}
            onPress={() => nudgeSelectedCanvasElement({ scaleDelta: -0.1 })}
            style={[styles.elementControlButton, !selectedCanvasElement && styles.elementControlDisabled]}
          ><Text style={styles.elementControlGlyph}>−</Text></Pressable>
          <Pressable
            accessibilityLabel="放大选中元素"
            disabled={!selectedCanvasElement}
            onPress={() => nudgeSelectedCanvasElement({ scaleDelta: 0.1 })}
            style={[styles.elementControlButton, !selectedCanvasElement && styles.elementControlDisabled]}
          ><Text style={styles.elementControlGlyph}>＋</Text></Pressable>
          <Pressable
            accessibilityLabel="向左旋转选中元素"
            disabled={!selectedCanvasElement}
            onPress={() => nudgeSelectedCanvasElement({ rotationDelta: -8 })}
            style={[styles.elementControlButton, !selectedCanvasElement && styles.elementControlDisabled]}
          ><Text style={styles.elementControlGlyph}>↶</Text></Pressable>
          <Pressable
            accessibilityLabel="向右旋转选中元素"
            disabled={!selectedCanvasElement}
            onPress={() => nudgeSelectedCanvasElement({ rotationDelta: 8 })}
            style={[styles.elementControlButton, !selectedCanvasElement && styles.elementControlDisabled]}
          ><Text style={styles.elementControlGlyph}>↷</Text></Pressable>
          <Pressable
            accessibilityLabel="从作品中删除选中元素"
            disabled={!selectedCanvasElement}
            onPress={() => selectedCanvasElement && deleteCanvasElement(selectedCanvasElement.id)}
            style={[styles.elementDeleteButton, !selectedCanvasElement && styles.elementControlDisabled]}
          ><Text style={styles.elementDeleteText}>删除</Text></Pressable>
        </View>

        <View style={styles.toolPanel}>
          <View style={styles.toolRow}>
            {tools.map(tool => (
              <Pressable key={tool.id} onPress={() => {
                if (tool.id === 'filter' && expandedTool !== 'filter' && project) filterSnapshot.current = project;
                updateProject({ selectedTool: tool.id });
                setExpandedTool(current => current === tool.id ? null : tool.id);
              }} style={styles.toolButton}>
                <Text style={[styles.toolIcon, project?.selectedTool === tool.id && styles.toolActive]}>{tool.icon}</Text>
                <Text style={[styles.toolLabel, project?.selectedTool === tool.id && styles.toolLabelActive]}>{tool.label}</Text>
              </Pressable>
            ))}
          </View>
          {expandedTool ? <View style={styles.toolOptions}>{toolOptions}</View> : null}
        </View>

        <View style={styles.aiHeading}>
          <View>
            <Text style={styles.aiTitle}>AI 风格选择 <Text style={styles.aiMember}>（邀请码内测）</Text></Text>
            <Text style={styles.aiSub}>为这张照片推荐 2 种 · 生成失败不扣次数</Text>
          </View>
          <Pressable onPress={() => setShowAllAi(value => !value)} style={styles.aiMore}>
            <Text style={styles.aiMoreText}>{showAllAi ? '收起' : '全部 12 种'}</Text>
          </Pressable>
        </View>
        {showAllAi ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiCategoryRail}>
            {aiStyleCategories.map(category => (
              <Pressable
                key={category}
                onPress={() => {
                  setAiFilter(category);
                  const first = category === '全部'
                    ? aiStyles[0]
                    : aiStyles.find(item => item.category === category);
                  if (first) setSelectedAi(first.id);
                }}
                style={[styles.aiCategory, aiFilter === category && styles.aiCategorySelected]}
              >
                <Text style={[styles.aiCategoryText, aiFilter === category && styles.aiCategoryTextSelected]}>{category}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiRail}>
          {visibleAiStyles.map((item, index) => (
            <Pressable key={item.id} onPress={() => setSelectedAi(item.id)} style={[styles.aiCard, { backgroundColor: item.tone }, selectedAi === item.id && styles.aiCardSelected]}>
              <View style={[styles.aiPreview, index % 2 === 0 ? styles.turnLeft : styles.turnRight]}>
                {imageUri ? <Image source={{ uri: imageUri }} style={styles.aiImage} /> : <Text style={styles.aiPlaceholder}>☕︎</Text>}
              </View>
              <Text style={styles.aiName}>{item.name}</Text>
              <Text style={styles.aiNote}>{item.note}</Text>
              {selectedAi === item.id ? <View style={styles.selectedDot} /> : null}
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.aiIntensityRow}>
          <Text style={styles.aiIntensityLabel}>风格强度</Text>
          <Text style={styles.aiIntensityStar}>★</Text>
          <Slider
            accessibilityLabel="AI 风格强度"
            style={styles.aiIntensitySlider}
            minimumValue={0}
            maximumValue={1}
            value={project?.filterIntensity ?? 0.75}
            minimumTrackTintColor={colors.creamDeep}
            maximumTrackTintColor={colors.line}
            thumbTintColor={colors.card}
            onValueChange={value => previewAdjustment('filterIntensity', value)}
            onSlidingComplete={value => persistAdjustment('filterIntensity', value)}
          />
          <Text style={styles.aiIntensityValue}>{Math.round((project?.filterIntensity ?? 0.75) * 100)}%</Text>
        </View>
        <Pressable onPress={() => startAi().catch(() => undefined)} style={styles.aiButton}>
          <Text style={styles.aiButtonText}>用「{aiStyles.find(item => item.id === selectedAi)?.name}」创作 · 1 次创作</Text>
        </Pressable>
      </ScrollView>
      <CreamPromptModal
        visible={finishNotice === 'success'}
        tone="celebrate"
        title="这一页，完成啦 ✦"
        body="主图、每一张贴纸的位置和小角度都收好了。现在去把今天的可爱分享出去吧。"
        note="✦ 今天这一页已经亮起来啦"
        confirmLabel="去发布"
        cancelLabel="继续看看"
        onCancel={() => setFinishNotice(null)}
        onConfirm={() => {
          setFinishNotice(null);
          if (aggregate) navigation.navigate('Publish', { recordId: aggregate.record.id });
          else navigation.navigate('Publish');
        }}
      />
      <CreamPromptModal
        visible={finishNotice === 'error'}
        title="差一点点就收好啦"
        body="这次保存没有完成，但原图和刚才摆好的元素都还在。吨吨陪你再试一次。"
        note="♡ 刚才的摆放还在，不用重新来"
        confirmLabel="再试一次"
        cancelLabel="先留在这里"
        onCancel={() => setFinishNotice(null)}
        onConfirm={() => {
          setFinishNotice(null);
          finishFreeEdit().catch(() => undefined);
        }}
      />
    </SafeAreaView>
  );
};

const filterTones = ['#E8C18E', '#BBA878', '#91A3AD', '#74513F', '#73688A', '#8C8880'];
const layoutCanvasStyle = (layoutId?: string) => {
  const layout = journalLayouts.find(item => item.id === layoutId);
  return layout ? { backgroundColor: layout.paper, borderColor: layout.accent } : undefined;
};
const cropPreviewStyle = (aspect: CreativeProject['cropAspect']) => aspect === 'original'
  ? undefined
  : { flex: 0, height: '100%' as const, aspectRatio: aspect === '1:1' ? 1 : aspect === '4:5' ? 0.8 : 9 / 16, alignSelf: 'center' as const };
const previewImageTransform = (project: CreativeProject) => ({
  transform: [
    { rotate: `${project.rotationDegrees + project.straightenDegrees}deg` },
    { scaleX: project.flipHorizontal ? -1 : 1 },
    { scaleY: project.flipVertical ? -1 : 1 },
    { scale: project.rotationDegrees === 90 || project.rotationDegrees === 270 ? 1.35 : 1 },
  ],
});
const canvasElementZStyle = (zIndex: number, selected: boolean) => ({
  // Keep the active small element reachable even after a user has added many
  // sticker instances. The full-canvas photo deliberately opts out above.
  zIndex: selected ? 10_000 : Math.min(9_999, Math.max(1, zIndex)),
});
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 30, gap: 10 },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { color: colors.ink, fontFamily: typography.title, fontSize: 15, fontWeight: '800' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  historyButton: { width: 30, height: 38, alignItems: 'center', justifyContent: 'center' },
  historyText: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  historyDisabled: { color: colors.line },
  backButton: { width: 42, height: 42, justifyContent: 'center' },
  backText: { color: colors.ink, fontSize: 34, lineHeight: 38 },
  doneButton: { minWidth: 58, height: 38, paddingHorizontal: 13, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.butterSoft },
  doneText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  canvas: { width: '100%', aspectRatio: 1.04, padding: 25, overflow: 'hidden', backgroundColor: '#F6E9D5', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E7D6C1', shadowColor: colors.cocoa, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  canvasMotion: { zIndex: 4, opacity: 0.78 },
  photoTouchLayer: { flex: 1, zIndex: 2 },
  tape: { position: 'absolute', zIndex: 3, top: -2, left: '41%', width: 80, height: 26, backgroundColor: 'rgba(159,190,167,0.56)', transform: [{ rotate: '7deg' }] },
  imageSticker: { flex: 1, padding: 6, borderRadius: 28, backgroundColor: colors.white, transform: [{ rotate: '-1deg' }], shadowColor: colors.cocoa, shadowOpacity: 0.13, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  polaroid: { paddingBottom: 28, borderRadius: 4 },
  tornFrame: { borderRadius: 7, transform: [{ rotate: '-1.6deg' }] },
  heroImage: { flex: 1, borderRadius: 20, backgroundColor: colors.paperDeep },
  emptyCanvas: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 22 },
  emptyIcon: { color: colors.creamDeep, fontSize: 36 },
  emptyMascot: { fontSize: 42, transform: [{ rotate: '-4deg' }] },
  emptyTitle: { marginTop: 8, color: colors.inkMuted, fontSize: 13, fontWeight: '700' },
  emptySubtitle: { marginTop: 5, color: colors.creamDeep, fontSize: 9, fontWeight: '700' },
  heroStickerTouch: { position: 'absolute', right: 11, top: 21, zIndex: 8, minWidth: 58, minHeight: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroStickerTouchSelected: { zIndex: 14 },
  catalogStickerPaper: { minWidth: 55, minHeight: 55, padding: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,253,247,0.78)', shadowColor: colors.cocoa, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  heroSticker: { color: colors.blush, fontSize: 42, textShadowColor: colors.white, textShadowRadius: 3 },
  wave: { position: 'absolute', left: 7, top: '52%', color: colors.sky, fontSize: 35, fontWeight: '900', transform: [{ rotate: '-25deg' }] },
  checker: { position: 'absolute', left: 12, bottom: 14, flexDirection: 'row', transform: [{ rotate: '3deg' }] },
  check: { width: 12, height: 12, backgroundColor: colors.card },
  checkFilled: { backgroundColor: colors.blush },
  dateLabel: { position: 'absolute', right: 16, bottom: 13, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.card, transform: [{ rotate: '-2deg' }] },
  dateLabelText: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  canvasGuide: { color: colors.inkMuted, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  elementControls: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, backgroundColor: '#FFF9EE', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  elementControlHeading: { flex: 1, minWidth: 70 },
  elementControlEyebrow: { color: colors.creamDeep, fontSize: 8, fontWeight: '800' },
  elementControlName: { marginTop: 2, color: colors.ink, fontSize: 10, fontWeight: '900' },
  elementControlButton: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.butterSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8CFA5' },
  elementControlGlyph: { color: colors.ink, fontSize: 16, lineHeight: 19, fontWeight: '900' },
  elementDeleteButton: { minWidth: 43, height: 31, paddingHorizontal: 8, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blushSoft },
  elementDeleteText: { color: '#9E493E', fontSize: 9, fontWeight: '900' },
  elementControlDisabled: { opacity: 0.35 },
  lifeCanvasSticker: { position: 'absolute', zIndex: 5, width: 94, height: 116, padding: 4, borderRadius: 12 },
  lifeCanvasStickerAnchor: { left: '8%', top: '11%' },
  lifeCanvasStickerSelected: { zIndex: 13 },
  lifeCanvasStickerFramed: { backgroundColor: colors.white, shadowColor: colors.cocoa, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  lifeCanvasImage: { flex: 1, width: '100%' },
  lifeCanvasLabel: { paddingTop: 2, color: colors.ink, fontSize: 8, fontWeight: '800', textAlign: 'center', textShadowColor: colors.white, textShadowRadius: 2 },
  toolPanel: { borderRadius: 20, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden' },
  filterPanel: { gap: 5 },
  filterHeader: { paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterCancel: { minWidth: 52, minHeight: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paperDeep },
  filterCancelText: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  filterHint: { color: colors.inkMuted, fontSize: 10 },
  filterApply: { minWidth: 52, minHeight: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.butterSoft },
  filterApplyText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  toolRow: { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  toolButton: { width: '20%', height: 60, alignItems: 'center', justifyContent: 'center' },
  toolIcon: { color: colors.ink, fontSize: 21 },
  toolActive: { color: colors.creamDeep },
  toolLabel: { marginTop: 5, color: colors.inkMuted, fontSize: 10, fontWeight: '600' },
  toolLabelActive: { color: colors.creamDeep, fontWeight: '800' },
  toolOptions: { minHeight: 84, justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  optionRail: { paddingHorizontal: 12, paddingVertical: 9, gap: 12 },
  filterOption: { width: 58, alignItems: 'center' },
  filterSwatch: { width: 51, height: 51, padding: 3, borderRadius: 15, overflow: 'hidden' },
  swatchImage: { flex: 1, borderRadius: 12, opacity: 0.72 },
  optionSelected: { borderWidth: 2, borderColor: colors.creamDeep },
  optionText: { marginTop: 5, color: colors.inkMuted, fontSize: 9 },
  optionTextSelected: { color: colors.creamDeep, fontWeight: '800' },
  adjustPanel: { minHeight: 96, paddingTop: 8 },
  adjustRail: { paddingHorizontal: 12, gap: 7 },
  adjustChip: { height: 27, minWidth: 48, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  adjustChipSelected: { backgroundColor: colors.ink },
  adjustChipText: { color: colors.inkMuted, fontSize: 9 },
  adjustChipTextSelected: { color: colors.card, fontWeight: '800' },
  sliderPanel: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  slider: { flex: 1, marginHorizontal: 8 },
  sliderValue: { width: 35, color: colors.inkMuted, fontSize: 10, textAlign: 'right' },
  chipRail: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  cropPanel: { minHeight: 96, paddingTop: 6 },
  straightenRow: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  straightenLabel: { width: 32, color: colors.ink, fontSize: 9, fontWeight: '700' },
  optionChip: { minWidth: 56, height: 38, paddingHorizontal: 13, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  optionChipSelected: { backgroundColor: colors.ink },
  optionChipText: { color: colors.inkMuted, fontSize: 11 },
  optionChipTextSelected: { color: colors.card, fontWeight: '800' },
  lifeControlPanel: { minHeight: 126, paddingVertical: 6 },
  stickerAddHint: { paddingHorizontal: 14, paddingBottom: 6, color: colors.creamDeep, fontSize: 9, fontWeight: '800' },
  lifeControlRail: { paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  lifeRailLabel: { alignSelf: 'center', color: colors.inkMuted, fontSize: 9, fontWeight: '700' },
  lifeEmptyHint: { paddingHorizontal: 14, paddingTop: 10, color: colors.inkMuted, fontSize: 9 },
  lifeSelectChip: { height: 31, maxWidth: 126, paddingHorizontal: 10, borderRadius: 16, justifyContent: 'center', backgroundColor: colors.skySoft },
  lifeSelectChipActive: { backgroundColor: colors.ink },
  lifeSelectText: { color: colors.ink, fontSize: 9 },
  lifeSelectTextActive: { color: colors.card, fontWeight: '800' },
  lifeTransformButton: { minWidth: 42, height: 31, paddingHorizontal: 9, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  lifeTransformText: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  aiHeading: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiTitle: { color: colors.ink, fontFamily: typography.title, fontSize: 15, fontWeight: '900' },
  aiMember: { color: colors.inkMuted, fontSize: 10, fontWeight: '600' },
  aiSub: { marginTop: 3, color: colors.inkMuted, fontSize: 9 },
  aiMore: { minWidth: 66, height: 28, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blushSoft },
  aiMoreText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  aiCategoryRail: { gap: 7, paddingVertical: 1 },
  aiCategory: { height: 28, paddingHorizontal: 13, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  aiCategorySelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  aiCategoryText: { color: colors.inkMuted, fontSize: 9, fontWeight: '700' },
  aiCategoryTextSelected: { color: colors.card },
  aiRail: { gap: 10, paddingVertical: 2 },
  aiCard: { width: 166, height: 126, padding: 9, overflow: 'hidden', borderRadius: 17, borderWidth: 1.5, borderColor: 'transparent' },
  aiCardSelected: { borderColor: colors.blush },
  aiPreview: { width: 68, height: 72, padding: 4, borderRadius: 14, backgroundColor: colors.white },
  aiImage: { flex: 1, borderRadius: 12 },
  aiPlaceholder: { flex: 1, textAlign: 'center', textAlignVertical: 'center', color: colors.cocoa, fontSize: 27 },
  aiName: { position: 'absolute', left: 88, top: 20, width: 68, color: colors.ink, fontSize: 13, fontWeight: '900' },
  aiNote: { position: 'absolute', left: 88, top: 56, width: 68, color: colors.inkMuted, fontSize: 8, lineHeight: 12 },
  selectedDot: { position: 'absolute', right: 9, bottom: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blush },
  turnLeft: { transform: [{ rotate: '-3deg' }] },
  turnRight: { transform: [{ rotate: '3deg' }] },
  aiIntensityRow: { height: 35, flexDirection: 'row', alignItems: 'center' },
  aiIntensityLabel: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  aiIntensityStar: { marginLeft: 8, color: colors.creamDeep, fontSize: 12 },
  aiIntensitySlider: { flex: 1, height: 34 },
  aiIntensityValue: { width: 34, color: colors.inkMuted, fontSize: 9, textAlign: 'right' },
  aiButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  aiButtonText: { color: colors.card, fontSize: 11, fontWeight: '800' },
});
