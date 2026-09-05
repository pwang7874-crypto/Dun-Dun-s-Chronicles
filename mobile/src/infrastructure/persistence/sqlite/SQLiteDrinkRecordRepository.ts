import {
  open,
  type DB,
  type Scalar,
  type Transaction,
} from '@op-engineering/op-sqlite';

import { AppError } from '../../../domain/errors';
import type {
  AiGenerationJob,
  CreativeProject,
  DrinkRecordV1,
  EditRecipeV1,
  JournalSticker,
  LocalProfile,
  PhotoAssetV1,
  RecordAggregate,
  ShareDraft,
} from '../../../domain/models';
import type { CreativeRepository, DrinkRecordRepository } from '../../../domain/ports';
import { parseCreativeCanvasElements } from '../../../domain/creativeCanvas';
import {
  drinkRecordSchema,
  editRecipeSchema,
  journalStickerSchema,
  photoAssetSchema,
} from '../../../domain/schemas';
import { localDateKey } from '../../../shared/dates';
import { migrateDatabase } from './migrations';

type SqlRow = Record<string, Scalar>;

const requiredString = (row: SqlRow, key: string): string => {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new Error(`Expected string column ${key}`);
  }
  return value;
};

const requiredNumber = (row: SqlRow, key: string): number => {
  const value = row[key];
  if (typeof value !== 'number') {
    throw new Error(`Expected number column ${key}`);
  }
  return value;
};

const optionalString = (row: SqlRow, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' ? value : undefined;
};

const recordFromRow = (row: SqlRow): DrinkRecordV1 =>
  drinkRecordSchema.parse({
    id: requiredString(row, 'id'),
    schemaVersion: requiredNumber(row, 'schema_version'),
    lifecycle: requiredString(row, 'lifecycle'),
    occurredAt: requiredString(row, 'occurred_at'),
    beverageName: optionalString(row, 'beverage_name'),
    category: optionalString(row, 'category'),
    shopName: optionalString(row, 'shop_name'),
    sugarLevel: optionalString(row, 'sugar_level'),
    temperature: optionalString(row, 'temperature'),
    city: optionalString(row, 'city'),
    mood: optionalString(row, 'mood'),
    note: optionalString(row, 'note'),
    originalAssetId: optionalString(row, 'original_asset_id'),
    displayAssetId: optionalString(row, 'display_asset_id'),
    thumbnailAssetId: optionalString(row, 'thumbnail_asset_id'),
    editRecipeId: optionalString(row, 'edit_recipe_id'),
    createdAt: requiredString(row, 'created_at'),
    updatedAt: requiredString(row, 'updated_at'),
  });

const assetFromRow = (row: SqlRow): PhotoAssetV1 =>
  photoAssetSchema.parse({
    id: requiredString(row, 'id'),
    schemaVersion: requiredNumber(row, 'schema_version'),
    recordId: requiredString(row, 'record_id'),
    kind: requiredString(row, 'kind'),
    sourceAssetId: optionalString(row, 'source_asset_id'),
    relativePath: requiredString(row, 'relative_path'),
    contentType: requiredString(row, 'content_type'),
    pixelWidth: requiredNumber(row, 'pixel_width'),
    pixelHeight: requiredNumber(row, 'pixel_height'),
    byteCount: requiredNumber(row, 'byte_count'),
    sha256: requiredString(row, 'sha256'),
    createdAt: requiredString(row, 'created_at'),
  });

const recipeFromRow = (row: SqlRow): EditRecipeV1 =>
  editRecipeSchema.parse({
    id: requiredString(row, 'id'),
    recordId: requiredString(row, 'record_id'),
    schemaVersion: requiredNumber(row, 'schema_version'),
    presetId: requiredString(row, 'preset_id'),
    presetVersion: requiredString(row, 'preset_version'),
    intensity: requiredNumber(row, 'intensity'),
    brightness: requiredNumber(row, 'brightness'),
    contrast: requiredNumber(row, 'contrast'),
    saturation: requiredNumber(row, 'saturation'),
    warmth: requiredNumber(row, 'warmth'),
    cropAspect: requiredString(row, 'crop_aspect'),
    rotationDegrees: requiredNumber(row, 'rotation_degrees'),
    straightenDegrees: requiredNumber(row, 'straighten_degrees'),
    flipHorizontal: requiredNumber(row, 'flip_horizontal') === 1,
    flipVertical: requiredNumber(row, 'flip_vertical') === 1,
    renderer: requiredString(row, 'renderer'),
    rendererVersion: requiredNumber(row, 'renderer_version'),
    sourceAssetId: requiredString(row, 'source_asset_id'),
    outputColorSpace: requiredString(row, 'output_color_space'),
    outputFormat: requiredString(row, 'output_format'),
    createdAt: requiredString(row, 'created_at'),
  });

const journalStickerFromRow = (row: SqlRow): JournalSticker =>
  journalStickerSchema.parse({
    id: requiredString(row, 'id'),
    recordId: requiredString(row, 'record_id'),
    category: requiredString(row, 'category'),
    label: requiredString(row, 'label'),
    sourceAssetId: requiredString(row, 'source_asset_id'),
    cutoutAssetId: optionalString(row, 'cutout_asset_id'),
    cutoutStatus: requiredString(row, 'cutout_status'),
    associationScope: requiredString(row, 'association_scope'),
    associationDateKey: optionalString(row, 'association_date_key'),
    positionX: requiredNumber(row, 'position_x'),
    positionY: requiredNumber(row, 'position_y'),
    scale: requiredNumber(row, 'scale'),
    rotationDegrees: requiredNumber(row, 'rotation_degrees'),
    createdAt: requiredString(row, 'created_at'),
    updatedAt: requiredString(row, 'updated_at'),
  });

const recordParams = (record: DrinkRecordV1): Scalar[] => [
  record.id,
  record.schemaVersion,
  record.lifecycle,
  record.occurredAt,
  record.beverageName ?? null,
  record.category ?? null,
  record.shopName ?? null,
  record.sugarLevel ?? null,
  record.temperature ?? null,
  record.city ?? null,
  record.mood ?? null,
  record.note ?? null,
  record.originalAssetId ?? null,
  record.displayAssetId ?? null,
  record.thumbnailAssetId ?? null,
  record.editRecipeId ?? null,
  record.createdAt,
  record.updatedAt,
];

const upsertRecord = async (
  executor: Pick<Transaction, 'execute'>,
  rawRecord: DrinkRecordV1,
): Promise<void> => {
  const record = drinkRecordSchema.parse(rawRecord);
  await executor.execute(
    `INSERT INTO drink_records (
      id, schema_version, lifecycle, occurred_at, beverage_name, category,
      shop_name, sugar_level, temperature, city, mood, note, original_asset_id, display_asset_id,
      thumbnail_asset_id, edit_recipe_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      schema_version=excluded.schema_version,
      lifecycle=excluded.lifecycle,
      occurred_at=excluded.occurred_at,
      beverage_name=excluded.beverage_name,
      category=excluded.category,
      shop_name=excluded.shop_name,
      sugar_level=excluded.sugar_level,
      temperature=excluded.temperature,
      city=excluded.city,
      mood=excluded.mood,
      note=excluded.note,
      original_asset_id=excluded.original_asset_id,
      display_asset_id=excluded.display_asset_id,
      thumbnail_asset_id=excluded.thumbnail_asset_id,
      edit_recipe_id=excluded.edit_recipe_id,
      updated_at=excluded.updated_at`,
    recordParams(record),
  );
};

const insertAsset = async (
  executor: Pick<Transaction, 'execute'>,
  rawAsset: PhotoAssetV1,
): Promise<void> => {
  const asset = photoAssetSchema.parse(rawAsset);
  await executor.execute(
    `INSERT OR REPLACE INTO photo_assets (
      id, schema_version, record_id, kind, source_asset_id, relative_path,
      content_type, pixel_width, pixel_height, byte_count, sha256, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      asset.id,
      asset.schemaVersion,
      asset.recordId,
      asset.kind,
      asset.sourceAssetId ?? null,
      asset.relativePath,
      asset.contentType,
      asset.pixelWidth,
      asset.pixelHeight,
      asset.byteCount,
      asset.sha256,
      asset.createdAt,
    ],
  );
};

const insertRecipe = async (
  executor: Pick<Transaction, 'execute'>,
  rawRecipe: EditRecipeV1,
): Promise<void> => {
  const recipe = editRecipeSchema.parse(rawRecipe);
  await executor.execute(
    `INSERT OR REPLACE INTO edit_recipes (
      id, record_id, schema_version, preset_id, preset_version, intensity,
      brightness, contrast, saturation, warmth, crop_aspect, rotation_degrees, straighten_degrees,
      flip_horizontal, flip_vertical,
      renderer, renderer_version, source_asset_id, output_color_space,
      output_format, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recipe.id,
      recipe.recordId,
      recipe.schemaVersion,
      recipe.presetId,
      recipe.presetVersion,
      recipe.intensity,
      recipe.brightness,
      recipe.contrast,
      recipe.saturation,
      recipe.warmth,
      recipe.cropAspect,
      recipe.rotationDegrees,
      recipe.straightenDegrees,
      recipe.flipHorizontal ? 1 : 0,
      recipe.flipVertical ? 1 : 0,
      recipe.renderer,
      recipe.rendererVersion,
      recipe.sourceAssetId,
      recipe.outputColorSpace,
      recipe.outputFormat,
      recipe.createdAt,
    ],
  );
};

export class SQLiteDrinkRecordRepository implements DrinkRecordRepository, CreativeRepository {
  constructor(private readonly database: DB) {}

  async initialize(): Promise<void> {
    await migrateDatabase(this.database);
  }

  async createDraft(
    rawRecord: DrinkRecordV1,
    original?: PhotoAssetV1,
  ): Promise<void> {
    try {
      await this.database.transaction(async tx => {
        await upsertRecord(tx, rawRecord);
        if (original) {
          await insertAsset(tx, original);
        }
      });
    } catch (error) {
      throw new AppError('PERSISTENCE_FAILED', '这杯还没有存好，请再试一次。', {
        cause: error,
      });
    }
  }

  async save(
    rawRecord: DrinkRecordV1,
    rawRecipe: EditRecipeV1 | undefined,
    newAssets: PhotoAssetV1[],
  ): Promise<void> {
    try {
      await this.database.transaction(async tx => {
        if (rawRecipe) {
          await insertRecipe(tx, rawRecipe);
        }
        for (const asset of newAssets) {
          await insertAsset(tx, asset);
        }
        await upsertRecord(tx, rawRecord);
      });
    } catch (error) {
      throw new AppError(
        'PERSISTENCE_FAILED',
        '记录没有保存成功，你的照片和编辑还在。',
        { cause: error },
      );
    }
  }

  async findById(id: string): Promise<RecordAggregate | null> {
    try {
      const recordResult = await this.database.execute(
        'SELECT * FROM drink_records WHERE id = ? LIMIT 1',
        [id],
      );
      const row = recordResult.rows[0];
      if (!row) {
        return null;
      }
      return this.loadAggregate(recordFromRow(row));
    } catch (error) {
      throw new AppError(
        'PERSISTENCE_FAILED',
        '暂时无法读取这杯记录，请稍后再试。',
        { cause: error },
      );
    }
  }

  async findSavedInRange(
    startISO: string,
    endISO: string,
  ): Promise<RecordAggregate[]> {
    try {
      const result = await this.database.execute(
        `SELECT * FROM drink_records
         WHERE lifecycle = 'saved' AND occurred_at >= ? AND occurred_at < ?
         ORDER BY occurred_at ASC, created_at ASC`,
        [startISO, endISO],
      );
      return Promise.all(
        result.rows.map(row => this.loadAggregate(recordFromRow(row))),
      );
    } catch (error) {
      throw new AppError(
        'PERSISTENCE_FAILED',
        '这个月的记录暂时没有打开，请稍后再试。',
        { cause: error },
      );
    }
  }

  async findLatestDraft(): Promise<RecordAggregate | null> {
    try {
      const result = await this.database.execute(
        `SELECT * FROM drink_records
         WHERE lifecycle = 'draft'
         ORDER BY updated_at DESC LIMIT 1`,
      );
      const row = result.rows[0];
      return row ? this.loadAggregate(recordFromRow(row)) : null;
    } catch (error) {
      throw new AppError('PERSISTENCE_FAILED', '未完成的记录暂时无法恢复。', {
        cause: error,
      });
    }
  }

  async getProject(recordId: string): Promise<CreativeProject | null> {
    const result = await this.database.execute(
      'SELECT * FROM creative_projects WHERE record_id = ? LIMIT 1',
      [recordId],
    );
    const row = result.rows[0];
    return row
      ? {
          recordId: requiredString(row, 'record_id'),
          selectedTool: requiredString(row, 'selected_tool') as CreativeProject['selectedTool'],
          filterPresetId: requiredString(row, 'filter_preset_id') as CreativeProject['filterPresetId'],
          filterIntensity: requiredNumber(row, 'filter_intensity'),
          brightness: requiredNumber(row, 'brightness'),
          contrast: requiredNumber(row, 'contrast'),
          saturation: requiredNumber(row, 'saturation'),
          warmth: requiredNumber(row, 'warmth'),
          cropAspect: requiredString(row, 'crop_aspect') as CreativeProject['cropAspect'],
          rotationDegrees: requiredNumber(row, 'rotation_degrees') as CreativeProject['rotationDegrees'],
          straightenDegrees: requiredNumber(row, 'straighten_degrees'),
          flipHorizontal: requiredNumber(row, 'flip_horizontal') === 1,
          flipVertical: requiredNumber(row, 'flip_vertical') === 1,
          stickerId: requiredString(row, 'sticker_id'),
          layoutId: requiredString(row, 'layout_id'),
          photoPositionX: requiredNumber(row, 'photo_position_x'),
          photoPositionY: requiredNumber(row, 'photo_position_y'),
          photoScale: requiredNumber(row, 'photo_scale'),
          photoRotationDegrees: requiredNumber(row, 'photo_rotation_degrees'),
          stickerPositionX: requiredNumber(row, 'sticker_position_x'),
          stickerPositionY: requiredNumber(row, 'sticker_position_y'),
          stickerScale: requiredNumber(row, 'sticker_scale'),
          stickerRotationDegrees: requiredNumber(row, 'sticker_rotation_degrees'),
          canvasElements: parseCreativeCanvasElements(optionalString(row, 'canvas_elements_json')),
          updatedAt: requiredString(row, 'updated_at'),
        }
      : null;
  }

  async saveProject(project: CreativeProject): Promise<void> {
    await this.database.execute(
      `INSERT INTO creative_projects (
        record_id, selected_tool, filter_preset_id, filter_intensity,
        brightness, contrast, saturation, warmth, crop_aspect, rotation_degrees, straighten_degrees,
        flip_horizontal, flip_vertical, sticker_id, layout_id,
        photo_position_x, photo_position_y, photo_scale, photo_rotation_degrees,
        sticker_position_x, sticker_position_y, sticker_scale, sticker_rotation_degrees,
        canvas_elements_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_id) DO UPDATE SET
        selected_tool=excluded.selected_tool,
        filter_preset_id=excluded.filter_preset_id,
        filter_intensity=excluded.filter_intensity,
        brightness=excluded.brightness,
        contrast=excluded.contrast,
        saturation=excluded.saturation,
        warmth=excluded.warmth,
        crop_aspect=excluded.crop_aspect,
        rotation_degrees=excluded.rotation_degrees,
        straighten_degrees=excluded.straighten_degrees,
        flip_horizontal=excluded.flip_horizontal,
        flip_vertical=excluded.flip_vertical,
        sticker_id=excluded.sticker_id,
        layout_id=excluded.layout_id,
        photo_position_x=excluded.photo_position_x,
        photo_position_y=excluded.photo_position_y,
        photo_scale=excluded.photo_scale,
        photo_rotation_degrees=excluded.photo_rotation_degrees,
        sticker_position_x=excluded.sticker_position_x,
        sticker_position_y=excluded.sticker_position_y,
        sticker_scale=excluded.sticker_scale,
        sticker_rotation_degrees=excluded.sticker_rotation_degrees,
        canvas_elements_json=excluded.canvas_elements_json,
        updated_at=excluded.updated_at`,
      [
        project.recordId,
        project.selectedTool,
        project.filterPresetId,
        project.filterIntensity,
        project.brightness,
        project.contrast,
        project.saturation,
        project.warmth,
        project.cropAspect,
        project.rotationDegrees,
        project.straightenDegrees,
        project.flipHorizontal ? 1 : 0,
        project.flipVertical ? 1 : 0,
        project.stickerId,
        project.layoutId,
        project.photoPositionX,
        project.photoPositionY,
        project.photoScale,
        project.photoRotationDegrees,
        project.stickerPositionX,
        project.stickerPositionY,
        project.stickerScale,
        project.stickerRotationDegrees,
        project.canvasElements === undefined ? null : JSON.stringify(project.canvasElements),
        project.updatedAt,
      ],
    );
  }

  async getShareDraft(
    recordId: string,
    channel: ShareDraft['channel'],
  ): Promise<ShareDraft | null> {
    const result = await this.database.execute(
      'SELECT * FROM share_drafts WHERE record_id = ? AND channel = ? LIMIT 1',
      [recordId, channel],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const rawTags = JSON.parse(requiredString(row, 'tags_json')) as unknown;
    return {
      recordId: requiredString(row, 'record_id'),
      channel: requiredString(row, 'channel') as ShareDraft['channel'],
      title: requiredString(row, 'title'),
      body: requiredString(row, 'body'),
      tags: Array.isArray(rawTags)
        ? rawTags.filter((tag): tag is string => typeof tag === 'string')
        : [],
      updatedAt: requiredString(row, 'updated_at'),
    };
  }

  async saveShareDraft(draft: ShareDraft): Promise<void> {
    await this.database.execute(
      `INSERT INTO share_drafts (
        record_id, channel, title, body, tags_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_id, channel) DO UPDATE SET
        title=excluded.title,
        body=excluded.body,
        tags_json=excluded.tags_json,
        updated_at=excluded.updated_at`,
      [
        draft.recordId,
        draft.channel,
        draft.title,
        draft.body,
        JSON.stringify(draft.tags),
        draft.updatedAt,
      ],
    );
  }

  async createAiJob(job: AiGenerationJob): Promise<void> {
    await this.updateAiJob(job);
  }

  async updateAiJob(job: AiGenerationJob): Promise<void> {
    await this.database.execute(
      `INSERT OR REPLACE INTO ai_generation_jobs (
        id, record_id, style_id, status, output_asset_id, error_message,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.recordId,
        job.styleId,
        job.status,
        job.outputAssetId ?? null,
        job.errorMessage ?? null,
        job.createdAt,
        job.updatedAt,
      ],
    );
  }

  async listAiJobs(recordId: string): Promise<AiGenerationJob[]> {
    const result = await this.database.execute(
      'SELECT * FROM ai_generation_jobs WHERE record_id = ? ORDER BY created_at DESC',
      [recordId],
    );
    return result.rows.map(row => ({
      id: requiredString(row, 'id'),
      recordId: requiredString(row, 'record_id'),
      styleId: requiredString(row, 'style_id'),
      status: requiredString(row, 'status') as AiGenerationJob['status'],
      outputAssetId: optionalString(row, 'output_asset_id'),
      errorMessage: optionalString(row, 'error_message'),
      createdAt: requiredString(row, 'created_at'),
      updatedAt: requiredString(row, 'updated_at'),
    }));
  }

  async getProfile(): Promise<LocalProfile> {
    const result = await this.database.execute(
      'SELECT * FROM local_profile WHERE id = 1 LIMIT 1',
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Local profile is missing');
    }
    return {
      displayName: requiredString(row, 'display_name'),
      membershipTier: requiredString(row, 'membership_tier') as LocalProfile['membershipTier'],
      aiCredits: requiredNumber(row, 'ai_credits'),
      points: requiredNumber(row, 'points'),
      onboardingCompletedAt: optionalString(row, 'onboarding_completed_at'),
      updatedAt: requiredString(row, 'updated_at'),
    };
  }

  async saveProfile(profile: LocalProfile): Promise<void> {
    await this.database.execute(
      `UPDATE local_profile SET display_name = ?, membership_tier = ?,
        ai_credits = ?, points = ?, onboarding_completed_at = ?,
        updated_at = ? WHERE id = 1`,
      [
        profile.displayName,
        profile.membershipTier,
        profile.aiCredits,
        profile.points,
        profile.onboardingCompletedAt ?? null,
        profile.updatedAt,
      ],
    );
  }

  async listFavoriteIds(): Promise<string[]> {
    const result = await this.database.execute(
      'SELECT record_id FROM favorite_records ORDER BY updated_at DESC',
    );
    return result.rows.map(row => requiredString(row, 'record_id'));
  }

  async setFavorite(
    recordId: string,
    favorite: boolean,
    updatedAt: string,
  ): Promise<void> {
    if (favorite) {
      await this.database.execute(
        'INSERT OR REPLACE INTO favorite_records(record_id, updated_at) VALUES (?, ?)',
        [recordId, updatedAt],
      );
      return;
    }
    await this.database.execute(
      'DELETE FROM favorite_records WHERE record_id = ?',
      [recordId],
    );
  }

  async addJournalSticker(
    rawSticker: JournalSticker,
    rawAssets: PhotoAssetV1[],
  ): Promise<void> {
    const sticker = journalStickerSchema.parse(rawSticker);
    try {
      await this.database.transaction(async tx => {
        for (const asset of rawAssets) {
          await insertAsset(tx, asset);
        }
        await tx.execute(
          `INSERT INTO journal_stickers (
            id, record_id, category, label, source_asset_id, cutout_asset_id,
            cutout_status, association_scope, association_date_key,
            position_x, position_y, scale, rotation_degrees, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sticker.id,
            sticker.recordId,
            sticker.category,
            sticker.label,
            sticker.sourceAssetId,
            sticker.cutoutAssetId ?? null,
            sticker.cutoutStatus,
            sticker.associationScope,
            sticker.associationDateKey ?? null,
            sticker.positionX,
            sticker.positionY,
            sticker.scale,
            sticker.rotationDegrees,
            sticker.createdAt,
            sticker.updatedAt,
          ],
        );
      });
    } catch (error) {
      throw new AppError('PERSISTENCE_FAILED', '生活贴图没有保存成功，请再试一次。', {
        cause: error,
      });
    }
  }

  async updateJournalSticker(rawSticker: JournalSticker): Promise<void> {
    const sticker = journalStickerSchema.parse(rawSticker);
    await this.database.execute(
      `UPDATE journal_stickers SET label = ?, association_scope = ?, association_date_key = ?,
        position_x = ?, position_y = ?, scale = ?, rotation_degrees = ?, updated_at = ? WHERE id = ?`,
      [
        sticker.label,
        sticker.associationScope,
        sticker.associationDateKey ?? null,
        sticker.positionX,
        sticker.positionY,
        sticker.scale,
        sticker.rotationDegrees,
        sticker.updatedAt,
        sticker.id,
      ],
    );
  }

  async deleteJournalSticker(stickerId: string): Promise<PhotoAssetV1[]> {
    const result = await this.database.execute(
      `SELECT photo_assets.* FROM photo_assets
       INNER JOIN journal_stickers ON
         photo_assets.id = journal_stickers.source_asset_id OR
         photo_assets.id = journal_stickers.cutout_asset_id
       WHERE journal_stickers.id = ?`,
      [stickerId],
    );
    const assets = result.rows.map(assetFromRow);
    await this.database.transaction(async tx => {
      await tx.execute('DELETE FROM journal_stickers WHERE id = ?', [stickerId]);
      for (const asset of assets) {
        await tx.execute('DELETE FROM photo_assets WHERE id = ?', [asset.id]);
      }
    });
    return assets;
  }

  async deleteAllUserData(): Promise<PhotoAssetV1[]> {
    const result = await this.database.execute(
      'SELECT * FROM photo_assets ORDER BY created_at ASC',
    );
    const assets = result.rows.map(assetFromRow);
    await this.database.transaction(async tx => {
      await tx.execute('DELETE FROM favorite_records');
      await tx.execute('DELETE FROM ai_generation_jobs');
      await tx.execute('DELETE FROM share_drafts');
      await tx.execute('DELETE FROM creative_projects');
      await tx.execute('DELETE FROM edit_recipes');
      await tx.execute('DELETE FROM journal_stickers');
      await tx.execute('DELETE FROM photo_assets');
      await tx.execute('DELETE FROM drink_records');
      await tx.execute(
        `UPDATE local_profile SET display_name = '饮品收藏家',
          membership_tier = 'free', ai_credits = 1, points = 0,
          onboarding_completed_at = NULL, updated_at = ? WHERE id = 1`,
        [new Date().toISOString()],
      );
    });
    return assets;
  }

  private async loadAggregate(record: DrinkRecordV1): Promise<RecordAggregate> {
    const assetsResult = await this.database.execute(
      'SELECT * FROM photo_assets WHERE record_id = ? ORDER BY created_at ASC',
      [record.id],
    );
    const assets = assetsResult.rows.map(assetFromRow);
    const stickerResult = await this.database.execute(
      `SELECT * FROM journal_stickers
       WHERE record_id = ? OR (association_scope = 'day' AND association_date_key = ?)
       ORDER BY created_at ASC`,
      [record.id, localDateKey(new Date(record.occurredAt))],
    );
    const journalStickers = stickerResult.rows.map(journalStickerFromRow);
    const knownAssetIds = new Set(assets.map(item => item.id));
    const referencedIds = journalStickers.flatMap(sticker => [sticker.sourceAssetId, sticker.cutoutAssetId].filter(Boolean) as string[]);
    for (const assetId of referencedIds) {
      if (knownAssetIds.has(assetId)) continue;
      const sharedAssetResult = await this.database.execute(
        'SELECT * FROM photo_assets WHERE id = ? LIMIT 1',
        [assetId],
      );
      const row = sharedAssetResult.rows[0];
      if (row) {
        assets.push(assetFromRow(row));
        knownAssetIds.add(assetId);
      }
    }

    let recipe: EditRecipeV1 | undefined;
    if (record.editRecipeId) {
      const recipeResult = await this.database.execute(
        'SELECT * FROM edit_recipes WHERE id = ? LIMIT 1',
        [record.editRecipeId],
      );
      const recipeRow = recipeResult.rows[0];
      if (recipeRow) {
        recipe = recipeFromRow(recipeRow);
      }
    }
    return { record, assets, recipe, journalStickers };
  }
}

export const createSQLiteRepository = (): SQLiteDrinkRecordRepository =>
  new SQLiteDrinkRecordRepository(open({ name: 'drink-diary.sqlite' }));
