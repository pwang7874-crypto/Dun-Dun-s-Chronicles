import type { DB, QueryResult, Transaction } from '@op-engineering/op-sqlite';

import { migrateDatabase } from '../src/infrastructure/persistence/sqlite/migrations';

const emptyResult = (): QueryResult => ({ rowsAffected: 0, rows: [] });

describe('SQLite migrations', () => {
  it('creates V1 tables and indexes inside one transaction', async () => {
    const executed: string[] = [];
    const transactionExecuted: string[] = [];
    const transactionParams: unknown[][] = [];
    const tx: Transaction = {
      execute: jest.fn(async (query, params = []) => {
        transactionExecuted.push(query);
        transactionParams.push(params);
        return emptyResult();
      }),
      commit: jest.fn(async () => emptyResult()),
      rollback: jest.fn(() => emptyResult()),
    };
    const database = {
      execute: jest.fn(async (query: string) => {
        executed.push(query);
        return query.includes('COALESCE')
          ? { rowsAffected: 0, rows: [{ version: 0 }] }
          : emptyResult();
      }),
      transaction: jest.fn(
        async (callback: (value: Transaction) => Promise<void>) => callback(tx),
      ),
    } as unknown as DB;

    await migrateDatabase(database);

    expect(executed.some(query => query.includes('foreign_keys = ON'))).toBe(
      true,
    );
    expect(
      transactionExecuted.some(query => query.includes('drink_records')),
    ).toBe(true);
    expect(
      transactionExecuted.some(query => query.includes('photo_assets')),
    ).toBe(true);
    expect(
      transactionExecuted.some(query => query.includes('edit_recipes')),
    ).toBe(true);
    expect(
      transactionExecuted.some(query => query.includes('sugar_level')),
    ).toBe(true);
    expect(
      transactionExecuted.some(query => query.includes('creative_projects')),
    ).toBe(true);
    expect(
      transactionExecuted.some(query => query.includes('share_drafts')),
    ).toBe(true);
    expect(
      transactionExecuted.some(query => query.includes('favorite_records')),
    ).toBe(true);
    expect(transactionExecuted.at(-1)).toContain('schema_migrations');
    expect(transactionParams).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([1]),
        expect.arrayContaining([2]),
        expect.arrayContaining([3]),
        expect.arrayContaining([4]),
        expect.arrayContaining([5]),
        expect.arrayContaining([6]),
        expect.arrayContaining([7]),
        expect.arrayContaining([8]),
        expect.arrayContaining([9]),
        expect.arrayContaining([10]),
        expect.arrayContaining([11]),
      ]),
    );
  });

  it('adds drink preference columns when upgrading an existing V1 database', async () => {
    const transactionExecuted: string[] = [];
    const tx = {
      execute: jest.fn(async (query: string) => {
        transactionExecuted.push(query);
        return emptyResult();
      }),
      commit: jest.fn(async () => emptyResult()),
      rollback: jest.fn(() => emptyResult()),
    } as unknown as Transaction;
    const database = {
      execute: jest.fn(async (query: string) =>
        query.includes('COALESCE')
          ? { rowsAffected: 0, rows: [{ version: 1 }] }
          : emptyResult(),
      ),
      transaction: jest.fn(
        async (callback: (value: Transaction) => Promise<void>) => callback(tx),
      ),
    } as unknown as DB;

    await migrateDatabase(database);

    expect(database.transaction).toHaveBeenCalledTimes(10);
    expect(transactionExecuted).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ADD COLUMN sugar_level'),
        expect.stringContaining('ADD COLUMN temperature'),
        expect.stringContaining('creative_projects'),
        expect.stringContaining('rotation_degrees'),
        expect.stringContaining('onboarding_completed_at'),
        expect.stringContaining('canvas_elements_json'),
      ]),
    );
  });

  it('rebuilds the record table with a nullable photo id and restores foreign keys', async () => {
    const executed: string[] = [];
    const transactionExecuted: string[] = [];
    const tx = {
      execute: jest.fn(async (query: string) => {
        transactionExecuted.push(query);
        return emptyResult();
      }),
      commit: jest.fn(async () => emptyResult()),
      rollback: jest.fn(() => emptyResult()),
    } as unknown as Transaction;
    const database = {
      execute: jest.fn(async (query: string) => {
        executed.push(query);
        return query.includes('COALESCE')
          ? { rowsAffected: 0, rows: [{ version: 10 }] }
          : emptyResult();
      }),
      transaction: jest.fn(
        async (callback: (value: Transaction) => Promise<void>) => callback(tx),
      ),
    } as unknown as DB;

    await migrateDatabase(database);

    expect(executed).toEqual(expect.arrayContaining([
      'PRAGMA foreign_keys = OFF',
      'PRAGMA foreign_keys = ON',
    ]));
    const create = transactionExecuted.find(query =>
      query.includes('CREATE TABLE drink_records_v11'),
    );
    expect(create).toContain('original_asset_id TEXT,');
    expect(create).not.toContain('original_asset_id TEXT NOT NULL');
    expect(transactionExecuted).toEqual(expect.arrayContaining([
      'DROP TABLE drink_records',
      'ALTER TABLE drink_records_v11 RENAME TO drink_records',
      'PRAGMA foreign_key_check',
    ]));
  });

  it('fails safely when a newer unknown schema is present', async () => {
    const database = {
      execute: jest.fn(async (query: string) =>
        query.includes('COALESCE')
          ? { rowsAffected: 0, rows: [{ version: 99 }] }
          : emptyResult(),
      ),
      transaction: jest.fn(),
    } as unknown as DB;

    await expect(migrateDatabase(database)).rejects.toMatchObject({
      code: 'DATABASE_CORRUPTED',
    });
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
