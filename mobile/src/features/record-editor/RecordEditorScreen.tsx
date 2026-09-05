import Slider from '@react-native-community/slider';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../app/navigation';
import { useServices } from '../../app/ServicesContext';
import { AppError } from '../../domain/errors';
import {
  beverageCategories,
  drinkTemperatures,
  sugarLevels,
  type BeverageCategory,
  type DrinkTemperature,
  type FilterPresetId,
  type CreativeProject,
  type JournalSticker,
  type JournalStickerCategory,
  type PhotoAssetV1,
  type RecordAggregate,
  type SugarLevel,
} from '../../domain/models';
import { PrimaryButton } from '../../design-system/components/Buttons';
import { CreamPromptModal } from '../../design-system/components/CreamPromptModal';
import { ErrorNotice } from '../../design-system/components/ErrorNotice';
import { LoadingView } from '../../design-system/components/LoadingView';
import { PaperTexture } from '../../design-system/components/StickerBits';
import { PaperCutoutSticker } from '../../design-system/components/PaperCutoutSticker';
import { colors, radii, spacing } from '../../design-system/theme';
import { newId } from '../../shared/id';
import { localDateKey } from '../../shared/dates';
import { optionalText } from '../../shared/strings';
import {
  filterCatalog,
  getFilterPreset,
} from '../../infrastructure/rendering/filters';
import { CreamMorningPreview } from './CreamMorningPreview';
import { DateField } from './DateField';
import {
  coffeeClassics,
  familiarShops,
  milkTeaClassics,
  type ClassicDrinkOption,
} from './drinkOptions';
import { saveRecord } from './saveRecord';
import { addJournalStickerFromLibrary } from './addJournalSticker';
import { journalStickerAssetFor } from '../shared/recordAssets';

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

interface EditorFields {
  beverageName: string;
  category?: BeverageCategory;
  shopName: string;
  sugarLevel?: SugarLevel;
  temperature?: DrinkTemperature;
  city: string;
  mood: string;
  note: string;
}

type EditorStep = 'drink' | 'life' | 'finish';

const editorSteps: Array<{ id: EditorStep; index: string; label: string }> = [
  { id: 'drink', index: '01', label: '这一杯' },
  { id: 'life', index: '02', label: '今日贴页' },
  { id: 'finish', index: '03', label: '心情与滤镜' },
];

const emptyFields: EditorFields = {
  beverageName: '',
  shopName: '',
  city: '',
  mood: '',
  note: '',
};

const moods = ['松弛', '明亮', '安静', '治愈', '微醺', '普通一天'];

const filterSwatches: Record<FilterPresetId, string> = {
  'cream-morning': '#E8C59A',
  'film-afternoon': '#B89B68',
  'rainy-cafe': '#8999A0',
  'cocoa-brown': '#765443',
  'night-neon': '#565077',
  'mono-notes': '#77736E',
};

const originalFor = (aggregate: RecordAggregate): PhotoAssetV1 | undefined =>
  aggregate.assets.find(asset => asset.id === aggregate.record.originalAssetId);

const projectForSavedRecord = (
  recordId: string,
  updatedAt: string,
  stored: CreativeProject | null,
  presetId: FilterPresetId,
  intensity: number,
): CreativeProject => ({
  recordId,
  selectedTool: stored?.selectedTool ?? 'filter',
  filterPresetId: presetId,
  filterIntensity: intensity,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  cropAspect: 'original',
  rotationDegrees: 0,
  straightenDegrees: 0,
  flipHorizontal: false,
  flipVertical: false,
  stickerId: stored?.stickerId ?? 'star',
  layoutId: stored?.layoutId ?? 'torn',
  photoPositionX: stored?.photoPositionX ?? 0,
  photoPositionY: stored?.photoPositionY ?? 0,
  photoScale: stored?.photoScale ?? 1,
  photoRotationDegrees: stored?.photoRotationDegrees ?? 0,
  stickerPositionX: stored?.stickerPositionX ?? 0,
  stickerPositionY: stored?.stickerPositionY ?? 0,
  stickerScale: stored?.stickerScale ?? 1,
  stickerRotationDegrees: stored?.stickerRotationDegrees ?? 0,
  canvasElements: stored?.canvasElements,
  updatedAt,
});

export const RecordEditorScreen = ({ route, navigation }: Props) => {
  const {
    repository,
    creativeRepository,
    assetStore,
    photoImporter,
    imageRenderer,
    subjectCutoutService,
    now,
  } = useServices();
  const [aggregate, setAggregate] = useState<RecordAggregate>();
  const [fields, setFields] = useState<EditorFields>(emptyFields);
  const [occurredAt, setOccurredAt] = useState(() => now());
  const [intensity, setIntensity] = useState(0.7);
  const [presetId, setPresetId] = useState<FilterPresetId>('cream-morning');
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [allowLeave, setAllowLeave] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [addingSticker, setAddingSticker] = useState<JournalStickerCategory>();
  const [uploadNotice, setUploadNotice] = useState<string>();
  const [stickerScope, setStickerScope] = useState<JournalSticker['associationScope']>('record');
  const [activeStep, setActiveStep] = useState<EditorStep>('drink');

  useEffect(() => {
    let mounted = true;
    repository
      .findById(route.params.recordId)
      .then(result => {
        if (!mounted) {
          return;
        }
        if (!result) {
          setError('这杯记录没有找到，请返回日历重试。');
          return;
        }
        setAggregate(result);
        setFields({
          beverageName: result.record.beverageName ?? '',
          category: result.record.category,
          shopName: result.record.shopName ?? '',
          sugarLevel: result.record.sugarLevel,
          temperature: result.record.temperature,
          city: result.record.city ?? '',
          mood: result.record.mood ?? '',
          note: result.record.note ?? '',
        });
        setOccurredAt(new Date(result.record.occurredAt));
        setIntensity(result.recipe?.intensity ?? 0.7);
        setPresetId(result.recipe?.presetId ?? 'cream-morning');
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
  }, [repository, route.params.recordId]);

  usePreventRemove(Boolean(aggregate) && !allowLeave && !saving, event => {
    setPendingLeave(() => () => navigation.dispatch(event.data.action));
  });

  const confirmLeave = () => {
    const leave = pendingLeave;
    setPendingLeave(null);
    setAllowLeave(true);
    if (leave) {
      setTimeout(leave, 0);
    }
  };

  const original = useMemo(
    () => (aggregate ? originalFor(aggregate) : undefined),
    [aggregate],
  );

  const updateField = <K extends keyof EditorFields>(
    key: K,
    value: EditorFields[K],
  ) => setFields(current => ({ ...current, [key]: value }));

  const save = async () => {
    if (!aggregate || saving) {
      return;
    }
    setSaving(true);
    setError(undefined);
    setFieldError(undefined);
    try {
      const record = await saveRecord(
        {
          aggregate,
          intensity,
          presetId,
          form: {
            occurredAt: occurredAt.toISOString(),
            beverageName: optionalText(fields.beverageName),
            category: fields.category,
            shopName: optionalText(fields.shopName),
            sugarLevel: fields.sugarLevel,
            temperature: fields.temperature,
            city: optionalText(fields.city),
            mood: optionalText(fields.mood),
            note: optionalText(fields.note),
          },
        },
        { repository, assetStore, imageRenderer, now, createId: newId },
      );
      await Promise.all((aggregate.journalStickers ?? [])
        .filter(sticker => sticker.recordId === aggregate.record.id && sticker.associationScope === 'day')
        .map(sticker => creativeRepository.updateJournalSticker({
          ...sticker,
          associationDateKey: localDateKey(occurredAt),
          updatedAt: now().toISOString(),
        })));
      const storedProject = await creativeRepository.getProject(record.id);
      await creativeRepository.saveProject(projectForSavedRecord(
        record.id,
        record.updatedAt,
        storedProject,
        presetId,
        intensity,
      ));
      setAllowLeave(true);
      setTimeout(
        () =>
          navigation.reset({
            index: 1,
            routes: [
              { name: 'MainTabs' },
              { name: 'Detail', params: { recordId: record.id } },
            ],
          }),
        0,
      );
    } catch (saveError) {
      setError(
        saveError instanceof AppError
          ? saveError.userMessage
          : '记录没有保存成功，你的原图和填写内容仍然保留。',
      );
    } finally {
      setSaving(false);
    }
  };

  if (!aggregate && !error) {
    return <LoadingView label="正在找回这一杯…" />;
  }

  if (!aggregate) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.centered}>
        <PaperTexture />
        <ErrorNotice message={error ?? '这杯记录暂时没有找到。'} />
      </SafeAreaView>
    );
  }

  const originalUri = original ? assetStore.resolveUri(original) : undefined;
  const newestStickers = [...(aggregate.journalStickers ?? [])].reverse();
  const outfitSticker = newestStickers.find(item => item.category === 'outfit');
  const foodSticker = newestStickers.find(item => item.category === 'food');
  const outfitAsset = outfitSticker
    ? journalStickerAssetFor(aggregate, outfitSticker)
    : undefined;
  const foodAsset = foodSticker
    ? journalStickerAssetFor(aggregate, foodSticker)
    : undefined;

  const chooseClassic = (option: ClassicDrinkOption) => {
    updateField('beverageName', option.name);
    updateField('category', option.category);
    setFieldError(undefined);
  };

  const completionCount = [
    Boolean(fields.shopName.trim()),
    Boolean(fields.beverageName.trim() && fields.category),
    Boolean(fields.sugarLevel),
    Boolean(fields.temperature),
  ].filter(Boolean).length;

  const addLifeSticker = async (category: JournalStickerCategory) => {
    if (addingSticker) {
      return;
    }
    setAddingSticker(category);
    setError(undefined);
    setUploadNotice(undefined);
    try {
      const result = await addJournalStickerFromLibrary(aggregate.record.id, category, {
        photoImporter,
        assetStore,
        subjectCutoutService,
        creativeRepository,
        now,
        createId: newId,
        associationScope: stickerScope,
        associationDateKey: localDateKey(occurredAt),
      });
      if (!result) {
        return;
      }
      const refreshed = await repository.findById(aggregate.record.id);
      if (refreshed) {
        setAggregate(refreshed);
      }
      setUploadNotice(
        result.autoCutout
          ? '✨ 已在手机上抠出主体，再裹上白色纸边、凹凸高光和柔软落影，变成奶油纸贴啦。'
          : '🎀 照片已加入奶油相框。这次未能识别主体，所以没有把方形原图伪装成透明贴纸。',
      );
    } catch (stickerError) {
      setError(
        stickerError instanceof AppError
          ? stickerError.userMessage
          : '这张生活贴图没有加入成功，请再试一次。',
      );
    } finally {
      setAddingSticker(undefined);
    }
  };

  const updateLifeSticker = async (sticker: JournalSticker, label: string) => {
    const cleaned = label.trim() || (sticker.category === 'outfit' ? '今日穿搭' : '今日美食');
    const updated = { ...sticker, label: cleaned, updatedAt: now().toISOString() };
    await creativeRepository.updateJournalSticker(updated);
    setAggregate(current => current ? {
      ...current,
      journalStickers: current.journalStickers?.map(item => item.id === updated.id ? updated : item),
    } : current);
  };

  const removeLifeSticker = async (sticker: JournalSticker) => {
    try {
      const removedAssets = await creativeRepository.deleteJournalSticker(sticker.id);
      await Promise.allSettled(removedAssets.map(item => assetStore.remove(item)));
      setAggregate(current => current ? {
        ...current,
        assets: current.assets.filter(item => !removedAssets.some(removed => removed.id === item.id)),
        journalStickers: current.journalStickers?.filter(item => item.id !== sticker.id),
      } : current);
    } catch {
      setError('这张贴图暂时没有移除，请稍后再试。');
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <PaperTexture />
      <CreamPromptModal
        visible={Boolean(pendingLeave)}
        title="这一杯，先让吨吨收好？"
        body={original
          ? '现在离开也不会丢掉原图，下次可以从日历继续写。'
          : '现在离开会保留这张空白草稿；想收下刚填的内容，请先点“保存这一杯”。'}
        cancelLabel="再写一会儿"
        confirmLabel="暂时离开"
        onCancel={() => setPendingLeave(null)}
        onConfirm={confirmLeave}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.editorIntro}>
          <Text style={styles.editorKicker}>TODAY'S LITTLE CUP</Text>
          <Text style={styles.editorTitle}>把这一杯，贴进今天</Text>
          <Text style={styles.editorProgress}>三小步就写完，不用一直往下滑</Text>
        </View>
        {original && originalUri ? (
          <CreamMorningPreview
            uri={originalUri}
            pixelWidth={original.pixelWidth}
            pixelHeight={original.pixelHeight}
            intensity={comparing ? 0 : intensity}
            presetId={presetId}
            maxHeight={248}
          />
        ) : (
          <NoPhotoCard />
        )}

        <View accessibilityRole="tablist" style={styles.stepTabs}>
          {editorSteps.map(step => (
            <Pressable
              key={step.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeStep === step.id }}
              onPress={() => setActiveStep(step.id)}
              style={[styles.stepTab, activeStep === step.id && styles.stepTabActive]}
            >
              <Text style={[styles.stepTabIndex, activeStep === step.id && styles.stepTabIndexActive]}>{step.index}</Text>
              <Text style={[styles.stepTabLabel, activeStep === step.id && styles.stepTabLabelActive]}>{step.label}</Text>
            </Pressable>
          ))}
        </View>

        {activeStep === 'drink' ? <View style={styles.formCard}>
          <View style={styles.formHeading}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>01</Text>
            </View>
            <View style={styles.formHeadingCopy}>
              <Text style={styles.formTitle}>先认识这一杯</Text>
              <Text style={styles.formHint}>想写多少就写多少，每一项都可以留白</Text>
            </View>
            <Text style={styles.completion}>已写 {completionCount} 项</Text>
          </View>

          <Text style={styles.fieldLabel}>哪一家 <Text style={styles.optionalMark}>选填</Text></Text>
          <TextInput
            accessibilityLabel="店铺名称，选填"
            placeholder="输入品牌或店铺名"
            placeholderTextColor={colors.inkMuted}
            value={fields.shopName}
            maxLength={120}
            onChangeText={value => {
              updateField('shopName', value);
              setFieldError(undefined);
            }}
            style={styles.input}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {familiarShops.map(shop => (
              <ChoiceChip
                key={shop}
                label={shop}
                selected={fields.shopName === shop}
                onPress={() => {
                  updateField('shopName', shop);
                  setFieldError(undefined);
                }}
              />
            ))}
          </ScrollView>
          <Text style={styles.suggestionNote}>常见选项仅用于快速填写，不代表品牌合作</Text>

          <Text style={styles.fieldLabel}>喝的什么 <Text style={styles.optionalMark}>选填</Text></Text>
          <TextInput
            accessibilityLabel="饮品名称，选填"
            placeholder="选经典款，或输入具体饮品名"
            placeholderTextColor={colors.inkMuted}
            value={fields.beverageName}
            maxLength={80}
            onChangeText={value => {
              updateField('beverageName', value);
              setFieldError(undefined);
            }}
            style={styles.input}
          />
          <Text style={styles.optionGroupTitle}>奶茶与茶饮经典</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {milkTeaClassics.map(option => (
              <ChoiceChip
                key={option.name}
                label={option.name}
                selected={fields.beverageName === option.name}
                onPress={() => chooseClassic(option)}
              />
            ))}
          </ScrollView>
          <Text style={styles.optionGroupTitle}>咖啡经典</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {coffeeClassics.map(option => (
              <ChoiceChip
                key={option.name}
                label={option.name}
                selected={fields.beverageName === option.name}
                onPress={() => chooseClassic(option)}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {beverageCategories.map(category => (
              <ChoiceChip
                key={category}
                label={category}
                selected={fields.category === category}
                onPress={() => {
                  updateField('category', category);
                  setFieldError(undefined);
                }}
              />
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>几分糖 <Text style={styles.optionalMark}>选填</Text></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {sugarLevels.map(level => (
              <ChoiceChip
                key={level}
                label={level}
                selected={fields.sugarLevel === level}
                onPress={() => {
                  updateField('sugarLevel', level);
                  setFieldError(undefined);
                }}
              />
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>热的还是冰的 <Text style={styles.optionalMark}>选填</Text></Text>
          <View style={styles.wrapChips}>
            {drinkTemperatures.map(temperature => (
              <ChoiceChip
                key={temperature}
                label={temperature}
                selected={fields.temperature === temperature}
                onPress={() => {
                  updateField('temperature', temperature);
                  setFieldError(undefined);
                }}
              />
            ))}
          </View>
          {fieldError ? (
            <Text accessibilityRole="alert" style={styles.fieldError}>
              {fieldError}
            </Text>
          ) : null}
        </View> : null}

        {activeStep === 'life' ? <View style={styles.lifeCard}>
          <View style={styles.miniSectionHeading}>
            <View style={[styles.stepBadge, styles.stepBadgeSky]}>
              <Text style={styles.stepBadgeText}>02</Text>
            </View>
            <View style={styles.formHeadingCopy}>
              <Text style={styles.formTitle}>把今天一起贴下来</Text>
              <Text style={styles.formHint}>穿搭和美食可选；支持时会在本机抠出主体并做成奶油纸贴</Text>
            </View>
          </View>
          <View style={styles.lifeActions}>
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(addingSticker)}
              onPress={() => addLifeSticker('outfit').catch(() => undefined)}
              style={[styles.lifeAddButton, styles.outfitButton]}
            >
              <Text style={styles.lifeAddIcon}>♧</Text>
              <View>
                <Text style={styles.lifeAddTitle}>{addingSticker === 'outfit' ? '正在做纸贴…' : '添加穿搭'}</Text>
                <Text style={styles.lifeAddHint}>全身 / 半身 / 今日造型</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(addingSticker)}
              onPress={() => addLifeSticker('food').catch(() => undefined)}
              style={[styles.lifeAddButton, styles.foodButton]}
            >
              <Text style={styles.lifeAddIcon}>♨</Text>
              <View>
                <Text style={styles.lifeAddTitle}>{addingSticker === 'food' ? '正在做纸贴…' : '添加美食'}</Text>
                <Text style={styles.lifeAddHint}>甜点 / 正餐 / 咖啡搭子</Text>
              </View>
            </Pressable>
          </View>
          {uploadNotice ? (
            <View accessibilityRole="alert" style={styles.uploadNotice}>
              <Text style={styles.uploadNoticeText}>{uploadNotice}</Text>
            </View>
          ) : null}
          <View style={styles.scopeChooser}>
            <Text style={styles.scopeLabel}>这张贴图用于</Text>
            <Pressable onPress={() => setStickerScope('record')} style={[styles.scopeChip, stickerScope === 'record' && styles.scopeChipActive]}>
              <Text style={[styles.scopeChipText, stickerScope === 'record' && styles.scopeChipTextActive]}>只跟这一杯</Text>
            </Pressable>
            <Pressable onPress={() => setStickerScope('day')} style={[styles.scopeChip, stickerScope === 'day' && styles.scopeChipActive]}>
              <Text style={[styles.scopeChipText, stickerScope === 'day' && styles.scopeChipTextActive]}>当天每一杯</Text>
            </Pressable>
          </View>
          <View style={styles.momentSheet}>
            <View style={styles.momentHeader}>
              <View>
                <Text style={styles.momentBrand}>Dundun Journal</Text>
                <Text style={styles.momentSubtitle}>把这一刻贴进今天</Text>
              </View>
              <Text style={styles.momentDay}>{new Date(occurredAt).getDate()}</Text>
            </View>
            <View style={styles.momentTopRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={outfitAsset ? '再上传一张我的美照' : '上传我的美照'}
                disabled={Boolean(addingSticker)}
                onPress={() => addLifeSticker('outfit').catch(() => undefined)}
                style={({ pressed }) => [
                  styles.momentItem,
                  styles.momentTiltLeft,
                  pressed && styles.momentItemPressed,
                ]}
              >
                {outfitAsset ? (
                  outfitSticker?.cutoutStatus === 'ready' ? (
                    <PaperCutoutSticker uri={assetStore.resolveUri(outfitAsset)} style={styles.momentImage} />
                  ) : (
                    <Image source={{ uri: assetStore.resolveUri(outfitAsset) }} resizeMode="cover" style={styles.momentImage} />
                  )
                ) : (
                  <View style={styles.momentPlaceholder}>
                    <Text style={styles.momentPlaceholderPlus}>
                      {addingSticker === 'outfit' ? '…' : '＋'}
                    </Text>
                    <Text style={styles.momentPlaceholderHint}>点这里上传</Text>
                  </View>
                )}
                <Text style={styles.momentItemTitle}>{outfitSticker?.label ?? '我的美照'}</Text>
                <Text style={[styles.momentTag, styles.outfitTag]}>♧ 穿搭</Text>
              </Pressable>
              <View style={[styles.momentItem, styles.momentTiltRight]}>
                {originalUri ? (
                  <Image source={{ uri: originalUri }} resizeMode="contain" style={styles.momentImage} />
                ) : (
                  <View style={[styles.momentImage, styles.noDrinkPhoto]}>
                    <Text style={styles.noDrinkPhotoIcon}>☕</Text>
                    <Text style={styles.noDrinkPhotoText}>没拍照{`\n`}也值得记住 ♡</Text>
                  </View>
                )}
                <Text numberOfLines={1} style={styles.momentItemTitle}>{fields.beverageName || '今天这一杯'}</Text>
                <Text style={[styles.momentTag, styles.drinkTag]}>♨ 饮品</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={foodAsset ? '再上传一张今天的美食' : '上传今天的美食'}
              disabled={Boolean(addingSticker)}
              onPress={() => addLifeSticker('food').catch(() => undefined)}
              style={({ pressed }) => [
                styles.momentItem,
                styles.momentFood,
                pressed && styles.momentItemPressed,
              ]}
            >
              {foodAsset ? (
                foodSticker?.cutoutStatus === 'ready' ? (
                  <PaperCutoutSticker uri={assetStore.resolveUri(foodAsset)} style={styles.momentImage} />
                ) : (
                  <Image source={{ uri: assetStore.resolveUri(foodAsset) }} resizeMode="cover" style={styles.momentImage} />
                )
              ) : (
                <View style={styles.momentPlaceholder}>
                  <Text style={styles.momentPlaceholderPlus}>
                    {addingSticker === 'food' ? '…' : '＋'}
                  </Text>
                  <Text style={styles.momentPlaceholderHint}>点这里上传</Text>
                </View>
              )}
              <Text style={styles.momentItemTitle}>{foodSticker?.label ?? '今天的美食'}</Text>
              <Text style={[styles.momentTag, styles.foodTag]}>♨ 美食</Text>
            </Pressable>
          </View>
          {aggregate.journalStickers?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lifeStickerRail}>
              {aggregate.journalStickers.map(sticker => {
                const shown = journalStickerAssetFor(aggregate, sticker);
                return (
                  <View key={sticker.id} style={styles.lifeStickerCard}>
                    {shown ? (
                      <View style={[styles.lifeStickerImageFrame, sticker.cutoutStatus === 'ready' && styles.cutoutFrame]}>
                        {sticker.cutoutStatus === 'ready' ? (
                          <PaperCutoutSticker uri={assetStore.resolveUri(shown)} style={styles.lifeStickerImage} />
                        ) : (
                          <Image source={{ uri: assetStore.resolveUri(shown) }} resizeMode="cover" style={styles.lifeStickerImage} />
                        )}
                      </View>
                    ) : null}
                    <TextInput
                      accessibilityLabel={sticker.category === 'outfit' ? '穿搭贴图名称' : '美食贴图名称'}
                      defaultValue={sticker.label}
                      maxLength={40}
                      onEndEditing={event => updateLifeSticker(sticker, event.nativeEvent.text).catch(() => undefined)}
                      style={styles.lifeStickerLabel}
                    />
                    <View style={styles.lifeStickerMetaRow}>
                      <Text style={styles.lifeStickerStatus}>
                        {sticker.cutoutStatus === 'ready' ? '奶油纸贴' : '奶油照片卡'} · {sticker.associationScope === 'day' ? '当天共享' : '仅这一杯'}
                      </Text>
                      <Pressable accessibilityRole="button" onPress={() => removeLifeSticker(sticker).catch(() => undefined)}>
                        <Text style={styles.removeSticker}>移除</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.lifeEmpty}>不添加也可以，饮品仍然是这篇日记的主角。</Text>
          )}
          <Text style={styles.lifePrivacy}>主体抠取与奶油纸贴效果免费在设备端完成；如果未识别到主体，会如实保留为奶油照片卡。</Text>
        </View> : null}

        {activeStep === 'finish' ? <View style={styles.finishStack}>
        <View style={styles.filterCard}>
          <View style={styles.miniSectionHeading}>
            <View style={[styles.stepBadge, styles.stepBadgeWarm]}>
              <Text style={styles.stepBadgeText}>03</Text>
            </View>
            <View style={styles.formHeadingCopy}>
              <Text style={styles.formTitle}>{original ? '给照片选一层心情' : '今天让文字当主角'}</Text>
              <Text style={styles.formHint}>{original ? '六款免费滤镜，都在手机本地处理' : '没有照片不需要选滤镜，照样可以完整保存'}</Text>
            </View>
          </View>
          {original ? (
            <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRail}
          >
            {filterCatalog.map(filter => (
              <Pressable
                key={filter.id}
                accessibilityRole="button"
                accessibilityState={{ selected: presetId === filter.id }}
                onPress={() => setPresetId(filter.id)}
                style={[
                  styles.filterChoice,
                  presetId === filter.id && styles.filterChoiceSelected,
                ]}
              >
                <View
                  style={[
                    styles.filterSwatch,
                    { backgroundColor: filterSwatches[filter.id] },
                  ]}
                />
                <Text
                  style={[
                    styles.filterChoiceText,
                    presetId === filter.id && styles.filterChoiceTextSelected,
                  ]}
                >
                  {filter.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.filterHeader}>
            <View>
              <Text style={styles.filterName}>
                {getFilterPreset(presetId).name}
              </Text>
              <Text style={styles.filterCaption}>
                {getFilterPreset(presetId).description}
              </Text>
            </View>
            <Text style={styles.intensity}>{Math.round(intensity * 100)}</Text>
          </View>
          <Slider
            accessibilityLabel="奶油晨光滤镜强度"
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={intensity}
            minimumTrackTintColor={colors.creamDeep}
            maximumTrackTintColor={colors.line}
            thumbTintColor={colors.creamDeep}
            onValueChange={setIntensity}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="按住查看原图"
            onPressIn={() => setComparing(true)}
            onPressOut={() => setComparing(false)}
            style={({ pressed }) => [
              styles.compare,
              pressed && styles.comparePressed,
            ]}
          >
            <Text style={styles.compareText}>
              {comparing ? '正在看原图' : '按住看原图'}
            </Text>
          </Pressable>
            </>
          ) : (
            <View style={styles.noFilterCard}>
              <Text style={styles.noFilterDoodle}>〜 ☕ 〜</Text>
              <Text style={styles.noFilterText}>今天先收下这几句话，{`\n`}空白的画面也很有呼吸感。</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>这一杯，发生在哪天</Text>
          <DateField value={occurredAt} onChange={setOccurredAt} />
          <TextInput
            accessibilityLabel="城市"
            placeholder="城市（手动填写，选填）"
            placeholderTextColor={colors.inkMuted}
            value={fields.city}
            maxLength={80}
            onChangeText={value => updateField('city', value)}
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>当时是什么心情</Text>
          <View style={styles.moods}>
            {moods.map(mood => (
              <Pressable
                key={mood}
                accessibilityRole="button"
                accessibilityState={{ selected: fields.mood === mood }}
                onPress={() =>
                  updateField('mood', fields.mood === mood ? '' : mood)
                }
                style={[
                  styles.chip,
                  fields.mood === mood && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    fields.mood === mood && styles.chipTextSelected,
                  ]}
                >
                  {mood}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="一句话记录"
            placeholder="写下一句话，也可以留白"
            placeholderTextColor={colors.inkMuted}
            value={fields.note}
            maxLength={500}
            multiline
            textAlignVertical="top"
            onChangeText={value => updateField('note', value)}
            style={[styles.input, styles.note]}
          />
        </View>
        </View> : null}

        <ErrorNotice message={error} />
        <View style={styles.stepFooter}>
          {activeStep !== 'drink' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveStep(activeStep === 'finish' ? 'life' : 'drink')}
              style={styles.previousButton}
            >
              <Text style={styles.previousButtonText}>上一步</Text>
            </Pressable>
          ) : null}
          <View style={styles.nextButtonWrap}>
            <PrimaryButton
              label={activeStep === 'finish'
                ? '保存这一杯'
                : activeStep === 'drink'
                  ? '下一步 · 贴上今天'
                  : '下一步 · 选心情'}
              busy={saving}
              onPress={() => activeStep === 'finish'
                ? save().catch(() => undefined)
                : setActiveStep(activeStep === 'drink' ? 'life' : 'finish')}
            />
          </View>
        </View>
        <Text style={styles.localOnly}>
          {original
            ? '原图始终保留。再次编辑会生成新的版本，不会覆盖第一次拍下的照片。'
            : '没有照片也可以成为一页完整的日记，你写下的每一个字都会被收好。'}
        </Text>
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
  noPhotoHero: {
    minHeight: 218,
    padding: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cream,
    backgroundColor: colors.butterSoft,
  },
  noPhotoBlob: { position: 'absolute', left: -45, bottom: -68, width: 170, height: 170, borderRadius: 85, backgroundColor: colors.blushSoft, opacity: 0.73 },
  noPhotoWave: { position: 'absolute', right: 23, top: 25, color: colors.blush, fontSize: 28, fontWeight: '900', transform: [{ rotate: '-8deg' }] },
  noPhotoMascotFrame: { width: 88, height: 88, borderRadius: 35, borderWidth: 4, borderColor: colors.white, backgroundColor: colors.card, transform: [{ rotate: '-2deg' }], shadowColor: colors.cocoa, shadowOpacity: 0.12, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  noPhotoMascot: { width: '100%', height: '100%' },
  noPhotoTitle: { marginTop: 12, color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  noPhotoHint: { marginTop: 5, color: colors.cocoa, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  editorIntro: { paddingHorizontal: 3 },
  editorKicker: { color: colors.creamDeep, fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  editorTitle: { marginTop: 5, color: colors.ink, fontSize: 23, fontWeight: '900' },
  editorProgress: { marginTop: 4, color: colors.inkMuted, fontSize: 10 },
  stepTabs: {
    height: 62,
    padding: 4,
    flexDirection: 'row',
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  stepTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16 },
  stepTabActive: { backgroundColor: colors.butterSoft },
  stepTabIndex: { color: colors.inkMuted, fontSize: 9, fontWeight: '800' },
  stepTabIndexActive: { color: colors.creamDeep },
  stepTabLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '700' },
  stepTabLabelActive: { color: colors.ink, fontWeight: '900' },
  formCard: {
    padding: spacing.md,
    gap: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    shadowColor: colors.cocoa,
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  formHeading: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniSectionHeading: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBadge: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blushSoft,
    transform: [{ rotate: '-3deg' }],
  },
  stepBadgeWarm: { backgroundColor: colors.butterSoft },
  stepBadgeSky: { backgroundColor: colors.skySoft },
  stepBadgeText: { color: colors.cocoa, fontSize: 12, fontWeight: '800' },
  formHeadingCopy: { flex: 1, marginLeft: 11 },
  formTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  formHint: { marginTop: 3, color: colors.inkMuted, fontSize: 10 },
  completion: { color: colors.creamDeep, fontSize: 13, fontWeight: '800' },
  fieldLabel: {
    marginTop: spacing.sm,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  optionalMark: { color: colors.inkMuted, fontSize: 10, fontWeight: '500' },
  optionGroupTitle: {
    marginTop: 2,
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionNote: { color: colors.inkMuted, fontSize: 9, lineHeight: 14 },
  fieldError: {
    marginTop: spacing.sm,
    padding: 12,
    borderRadius: radii.sm,
    color: colors.danger,
    backgroundColor: '#FCE7E2',
    fontSize: 12,
    lineHeight: 18,
  },
  lifeCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  lifeActions: { flexDirection: 'row', gap: spacing.sm },
  lifeAddButton: {
    flex: 1,
    minHeight: 82,
    padding: 12,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  outfitButton: { backgroundColor: colors.skySoft },
  foodButton: { backgroundColor: colors.blushSoft },
  lifeAddIcon: { color: colors.cocoa, fontSize: 24, fontWeight: '800' },
  lifeAddTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  lifeAddHint: { marginTop: 3, maxWidth: 105, color: colors.inkMuted, fontSize: 8 },
  uploadNotice: { marginTop: 10, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, backgroundColor: '#FFF5D5', borderWidth: 1, borderColor: '#F0D99D' },
  uploadNoticeText: { color: colors.cocoa, fontSize: 10, lineHeight: 16, fontWeight: '600' },
  scopeChooser: { marginTop: 10, padding: 4, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, backgroundColor: colors.paperDeep },
  scopeLabel: { marginLeft: 5, marginRight: 2, color: colors.inkMuted, fontSize: 9, fontWeight: '700' },
  scopeChip: { flex: 1, minHeight: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  scopeChipActive: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream },
  scopeChipText: { color: colors.inkMuted, fontSize: 9, fontWeight: '700' },
  scopeChipTextActive: { color: colors.cocoa, fontWeight: '900' },
  lifeStickerRail: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: 4 },
  lifeStickerCard: {
    width: 142,
    padding: 9,
    borderRadius: radii.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  lifeStickerImageFrame: {
    height: 118,
    padding: 5,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  cutoutFrame: { overflow: 'visible', backgroundColor: 'transparent' },
  lifeStickerImage: { width: '100%', height: '100%' },
  lifeStickerLabel: {
    marginTop: 6,
    minHeight: 32,
    paddingHorizontal: 4,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  lifeStickerMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lifeStickerStatus: { color: colors.creamDeep, fontSize: 9, fontWeight: '700' },
  removeSticker: { color: colors.danger, fontSize: 9, fontWeight: '700' },
  lifeEmpty: { paddingTop: spacing.md, color: colors.inkMuted, fontSize: 11, textAlign: 'center' },
  lifePrivacy: { marginTop: spacing.sm, color: colors.inkMuted, fontSize: 9, lineHeight: 14 },
  momentSheet: {
    minHeight: 420,
    marginTop: spacing.md,
    padding: 14,
    borderRadius: 19,
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: colors.line,
  },
  momentHeader: { height: 54, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  momentBrand: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  momentSubtitle: { marginTop: 2, color: colors.inkMuted, fontSize: 10 },
  momentDay: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  momentTopRow: { height: 190, flexDirection: 'row', justifyContent: 'space-around' },
  momentItem: { width: '44%', height: 184, alignItems: 'center' },
  momentItemPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  momentTiltLeft: { transform: [{ rotate: '-2deg' }] },
  momentTiltRight: { transform: [{ rotate: '2deg' }] },
  momentFood: { marginTop: 5, marginLeft: 10, transform: [{ rotate: '-1deg' }] },
  momentImage: {
    width: '100%',
    height: 128,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 5,
    borderColor: colors.white,
  },
  momentPlaceholder: {
    width: '100%',
    height: 128,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperDeep,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cream,
  },
  momentPlaceholderPlus: { color: colors.creamDeep, fontSize: 30, lineHeight: 35, fontWeight: '700' },
  momentPlaceholderHint: { marginTop: 3, color: colors.inkMuted, fontSize: 8, fontWeight: '700' },
  noDrinkPhoto: { alignItems: 'center', justifyContent: 'center', borderColor: colors.white, backgroundColor: colors.butterSoft },
  noDrinkPhotoIcon: { color: colors.cocoa, fontSize: 25 },
  noDrinkPhotoText: { marginTop: 5, color: colors.cocoa, fontSize: 9, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  momentItemTitle: { marginTop: 6, maxWidth: '100%', color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  momentTag: { marginTop: 4, fontSize: 9, fontWeight: '800' },
  outfitTag: { color: '#7474AD' },
  drinkTag: { color: colors.cocoa },
  foodTag: { color: colors.blush },
  finishStack: { gap: spacing.md },
  filterCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  noFilterCard: { minHeight: 130, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.cream, backgroundColor: '#FFF8E9' },
  noFilterDoodle: { color: colors.blush, fontSize: 19, fontWeight: '800' },
  noFilterText: { marginTop: 9, color: colors.cocoa, fontSize: 12, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  filterRail: { gap: spacing.sm, paddingBottom: spacing.md },
  filterChoice: {
    width: 76,
    alignItems: 'center',
    gap: 6,
    opacity: 0.65,
  },
  filterChoiceSelected: { opacity: 1 },
  filterSwatch: {
    width: 58,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChoiceText: { color: colors.inkMuted, fontSize: 11 },
  filterChoiceTextSelected: { color: colors.ink, fontWeight: '700' },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterName: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  filterCaption: { marginTop: 3, color: colors.inkMuted, fontSize: 12 },
  intensity: { color: colors.creamDeep, fontSize: 18, fontWeight: '700' },
  compare: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  comparePressed: { backgroundColor: colors.paperDeep },
  compareText: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' },
  section: { gap: spacing.sm },
  sectionTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    color: colors.ink,
    backgroundColor: colors.card,
    fontSize: 15,
  },
  note: { minHeight: 112 },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chipSelected: { borderColor: colors.creamDeep, backgroundColor: '#F1E0CF' },
  chipText: { color: colors.inkMuted, fontSize: 13 },
  chipTextSelected: { color: colors.creamDeep, fontWeight: '700' },
  stepFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previousButton: {
    width: 86,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  previousButtonText: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
  nextButtonWrap: { flex: 1 },
  localOnly: {
    paddingHorizontal: spacing.md,
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
});

const NoPhotoCard = () => (
  <View
    accessibilityLabel="这杯暂时没有照片，文字也会被好好收藏"
    style={styles.noPhotoHero}
  >
    <View style={styles.noPhotoBlob} />
    <Text style={styles.noPhotoWave}>〜♡</Text>
    <View style={styles.noPhotoMascotFrame}>
      <Image
        source={require('../../assets/images/diary-girl-mascot.png')}
        resizeMode="contain"
        style={styles.noPhotoMascot}
      />
    </View>
    <Text style={styles.noPhotoTitle}>今天没拍照，也没关系</Text>
    <Text style={styles.noPhotoHint}>吨吨会把你写下的小事，{`\n`}收进一张暖暖的奶油纸卡。</Text>
  </View>
);

interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const ChoiceChip = ({ label, selected, onPress }: ChoiceChipProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    style={[styles.chip, selected && styles.chipSelected]}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
  </Pressable>
);
