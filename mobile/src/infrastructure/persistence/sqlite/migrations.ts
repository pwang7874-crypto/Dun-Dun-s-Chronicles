import type { DB, Transaction } from '@op-engineering/op-sqlite';

import { AppError } from '../../../domain/errors';

const SCHEMA_VERSION = 11;

const createV1 = async (tx: Transaction): Promise<void> => {
  await tx.execute(`
    CREATE TABLE IF NOT EXISTS drink_records (
      id TEXT PRIMARY KEY NOT NULL,
      schema_version INTEGER NOT NULL,
      lifecycle TEXT NOT NULL CHECK (lifecycle IN ('draft', 'saved')),
      occurred_at TEXT NOT NULL,
      beverage_name TEXT,
      category TEXT,
      shop_name TEXT,
      city TEXT,
      mood TEXT,
      note TEXT,
      original_asset_id TEXT NOT NULL,
      display_asset_id TEXT,
      thumbnail_asset_id TEXT,
      edit_recipe_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await tx.execute(`
    CREATE TABLE IF NOT EXISTS photo_assets (
      id TEXT PRIMARY KEY NOT NULL,
      schema_version INTEGER NOT NULL,
      record_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('original', 'filtered', 'thumbnail')),
      source_asset_id TEXT,
      relative_path TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      pixel_width INTEGER NOT NULL,
      pixel_height INTEGER NOT NULL,
      byte_count INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES drink_records(id) ON DELETE RESTRICT
    )
  `);

  await tx.execute(`
    CREATE TABLE IF NOT EXISTS edit_recipes (
      id TEXT PRIMARY KEY NOT NULL,
      record_id TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      preset_id TEXT NOT NULL,
      preset_version TEXT NOT NULL,
      intensity REAL NOT NULL CHECK (intensity >= 0 AND intensity <= 1),
      renderer TEXT NOT NULL,
      renderer_version INTEGER NOT NULL,
      source_asset_id TEXT NOT NULL,
      output_color_space TEXT NOT NULL,
      output_format TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES drink_records(id) ON DELETE RESTRICT
    )
  `);

  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_records_lifecycle_occurred ON drink_records(lifecycle, occurred_at)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_assets_record_kind ON photo_assets(record_id, kind)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_recipes_record ON edit_recipes(record_id)',
  );
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [1, new Date().toISOString()],
  );
};

const createV2 = async (tx: Transaction): Promise<void> => {
  await tx.execute('ALTER TABLE drink_records ADD COLUMN sugar_level TEXT');
  await tx.execute('ALTER TABLE drink_records ADD COLUMN temperature TEXT');
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [2, new Date().toISOString()],
  );
};

const createV3 = async (tx: Transaction): Promise<void> => {
  await tx.execute(`
    CREATE TABLE IF NOT EXISTS creative_projects (
      record_id TEXT PRIMARY KEY NOT NULL,
      selected_tool TEXT NOT NULL,
      filter_preset_id TEXT NOT NULL,
      filter_intensity REAL NOT NULL,
      crop_aspect TEXT NOT NULL,
      sticker_id TEXT NOT NULL,
      layout_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES drink_records(id) ON DELETE CASCADE
    )
  `);
  await tx.execute(`
    CREATE TABLE IF NOT EXISTS share_drafts (
      record_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(record_id, channel),
      FOREIGN KEY(record_id) REFERENCES drink_records(id) ON DELETE CASCADE
    )
  `);
  await tx.execute(`
    CREATE TABLE IF NOT EXISTS ai_generation_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      record_id TEXT NOT NULL,
      style_id TEXT NOT NULL,
      status TEXT NOT NULL,
      output_asset_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES drink_records(id) ON DELETE CASCADE
    )
  `);
  await tx.execute(`
    CREATE TABLE IF NOT EXISTS local_profile (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      display_name TEXT NOT NULL,
      membership_tier TEXT NOT NULL,
      ai_credits INTEGER NOT NULL,
      points INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await tx.execute(`
    CREATE TABLE IF NOT EXISTS favorite_records (
      record_id TEXT PRIMARY KEY NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES drink_records(id) ON DELETE CASCADE
    )
  `);
  await tx.execute(
    `INSERT OR IGNORE INTO local_profile (
      id, display_name, membership_tier, ai_credits, points, updated_at
    ) VALUES (1, '饮品收藏家', 'free', 1, 0, ?)`,
    [new Date().toISOString()],
  );
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [3, new Date().toISOString()],
  );
};

const createV4 = async (tx: Transaction): Promise<void> => {
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN brightness REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN contrast REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN saturation REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN warmth REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN rotation_degrees INTEGER NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN flip_horizontal INTEGER NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN flip_vertical INTEGER NOT NULL DEFAULT 0');

  await tx.execute('ALTER TABLE edit_recipes ADD COLUMN brightness REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE edit_recipes ADD COLUMN contrast REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE edit_recipes ADD COLUMN saturation REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE edit_recipes ADD COLUMN warmth REAL NOT NULL DEFAULT 0');
  await tx.execute("ALTER TABLE edit_recipes ADD COLUMN crop_aspect TEXT NOT NULL DEFAULT 'original'");
  await tx.execute('ALTER TABLE edit_recipes ADD COLUMN rotation_degrees INTEGER NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE edit_recipes ADD COLUMN flip_horizontal INTEGER NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE edit_recipes ADD COLUMN flip_vertical INTEGER NOT NULL DEFAULT 0');
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [4, new Date().toISOString()],
  );
};

const createV5 = async (tx: Transaction): Promise<void> => {
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN straighten_degrees REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE edit_recipes ADD COLUMN straighten_degrees REAL NOT NULL DEFAULT 0');
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [5, new Date().toISOString()],
  );
};

const createV6 = async (tx: Transaction): Promise<void> => {
  await tx.execute(`
    CREATE TABLE IF NOT EXISTS journal_stickers (
      id TEXT PRIMARY KEY NOT NULL,
      record_id TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('outfit', 'food')),
      label TEXT NOT NULL,
      source_asset_id TEXT NOT NULL,
      cutout_asset_id TEXT,
      cutout_status TEXT NOT NULL CHECK (cutout_status IN ('ready', 'source-only')),
      position_x REAL NOT NULL CHECK (position_x >= 0 AND position_x <= 1),
      position_y REAL NOT NULL CHECK (position_y >= 0 AND position_y <= 1),
      scale REAL NOT NULL CHECK (scale >= 0.35 AND scale <= 2.5),
      rotation_degrees REAL NOT NULL CHECK (rotation_degrees >= -180 AND rotation_degrees <= 180),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES drink_records(id) ON DELETE CASCADE,
      FOREIGN KEY(source_asset_id) REFERENCES photo_assets(id) ON DELETE RESTRICT,
      FOREIGN KEY(cutout_asset_id) REFERENCES photo_assets(id) ON DELETE RESTRICT
    )
  `);
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_journal_stickers_record ON journal_stickers(record_id, created_at)',
  );
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [6, new Date().toISOString()],
  );
};

const createV7 = async (tx: Transaction): Promise<void> => {
  await tx.execute('ALTER TABLE local_profile ADD COLUMN onboarding_completed_at TEXT');
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [7, new Date().toISOString()],
  );
};

const createV8 = async (tx: Transaction): Promise<void> => {
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN photo_position_x REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN photo_position_y REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN photo_scale REAL NOT NULL DEFAULT 1');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN photo_rotation_degrees REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN sticker_position_x REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN sticker_position_y REAL NOT NULL DEFAULT 0');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN sticker_scale REAL NOT NULL DEFAULT 1');
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN sticker_rotation_degrees REAL NOT NULL DEFAULT 0');
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [8, new Date().toISOString()],
  );
};

const createV9 = async (tx: Transaction): Promise<void> => {
  await tx.execute("ALTER TABLE journal_stickers ADD COLUMN association_scope TEXT NOT NULL DEFAULT 'record' CHECK (association_scope IN ('record', 'day'))");
  await tx.execute('ALTER TABLE journal_stickers ADD COLUMN association_date_key TEXT');
  await tx.execute('CREATE INDEX IF NOT EXISTS idx_journal_stickers_day ON journal_stickers(association_scope, association_date_key, created_at)');
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [9, new Date().toISOString()],
  );
};

const createV10 = async (tx: Transaction): Promise<void> => {
  // Nullable is intentional: NULL identifies a legacy project that still needs
  // its single photo/sticker columns hydrated. "[]" represents a real, empty
  // user composition and must survive a reload.
  await tx.execute('ALTER TABLE creative_projects ADD COLUMN canvas_elements_json TEXT');
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [10, new Date().toISOString()],
  );
};

const createV11 = async (tx: Transaction): Promise<void> => {
  // SQLite cannot remove a NOT NULL constraint in place. Rebuilding only the
  // parent table preserves every record id and lets text-only diary entries
  // represent the absence of a photo with a real SQL NULL.
  await tx.execute(`
    CREATE TABLE drink_records_v11 (
      id TEXT PRIMARY KEY NOT NULL,
      schema_version INTEGER NOT NULL,
      lifecycle TEXT NOT NULL CHECK (lifecycle IN ('draft', 'saved')),
      occurred_at TEXT NOT NULL,
      beverage_name TEXT,
      category TEXT,
      shop_name TEXT,
      city TEXT,
      mood TEXT,
      note TEXT,
      original_asset_id TEXT,
      display_asset_id TEXT,
      thumbnail_asset_id TEXT,
      edit_recipe_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sugar_level TEXT,
      temperature TEXT
    )
  `);
  await tx.execute(`
    INSERT INTO drink_records_v11 (
      id, schema_version, lifecycle, occurred_at, beverage_name, category,
      shop_name, city, mood, note, original_asset_id, display_asset_id,
      thumbnail_asset_id, edit_recipe_id, created_at, updated_at,
      sugar_level, temperature
    ) SELECT
      id, schema_version, lifecycle, occurred_at, beverage_name, category,
      shop_name, city, mood, note, original_asset_id, display_asset_id,
      thumbnail_asset_id, edit_recipe_id, created_at, updated_at,
      sugar_level, temperature
    FROM drink_records
  `);
  await tx.execute('DROP TABLE drink_records');
  await tx.execute('ALTER TABLE drink_records_v11 RENAME TO drink_records');
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_records_lifecycle_occurred ON drink_records(lifecycle, occurred_at)',
  );
  const violations = await tx.execute('PRAGMA foreign_key_check');
  if (violations.rows.length > 0) {
    throw new Error('Foreign-key validation failed after text-only migration');
  }
  await tx.execute(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
    [11, new Date().toISOString()],
  );
};

const migrateV11 = async (database: DB): Promise<void> => {
  // Foreign keys must be disabled outside the transaction while the referenced
  // parent table is swapped. The transaction and in-transaction integrity
  // check keep the operation atomic.
  await database.execute('PRAGMA foreign_keys = OFF');
  try {
    await database.transaction(createV11);
  } finally {
    await database.execute('PRAGMA foreign_keys = ON');
  }
};

export const migrateDatabase = async (database: DB): Promise<void> => {
  try {
    await database.execute('PRAGMA foreign_keys = ON');
    await database.execute('PRAGMA journal_mode = WAL');
    await database.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const result = await database.execute(
      'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations',
    );
    const rawVersion = result.rows[0]?.version;
    const currentVersion = typeof rawVersion === 'number' ? rawVersion : 0;

    if (currentVersion > SCHEMA_VERSION) {
      throw new Error(`Unsupported database schema ${currentVersion}`);
    }

    if (currentVersion < 1) {
      await database.transaction(createV1);
    }
    if (currentVersion < 2) {
      await database.transaction(createV2);
    }
    if (currentVersion < 3) {
      await database.transaction(createV3);
    }
    if (currentVersion < 4) {
      await database.transaction(createV4);
    }
    if (currentVersion < 5) {
      await database.transaction(createV5);
    }
    if (currentVersion < 6) {
      await database.transaction(createV6);
    }
    if (currentVersion < 7) {
      await database.transaction(createV7);
    }
    if (currentVersion < 8) {
      await database.transaction(createV8);
    }
    if (currentVersion < 9) {
      await database.transaction(createV9);
    }
    if (currentVersion < 10) {
      await database.transaction(createV10);
    }
    if (currentVersion < 11) {
      await migrateV11(database);
    }
  } catch (error) {
    throw new AppError(
      'DATABASE_CORRUPTED',
      '本地记录暂时无法打开。照片仍保留在设备中，请稍后再试。',
      { cause: error },
    );
  }
};
