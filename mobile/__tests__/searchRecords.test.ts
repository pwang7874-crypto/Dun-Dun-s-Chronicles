import type { RecordAggregate } from '../src/domain/models';
import { searchRecords } from '../src/features/search/searchRecords';

const item = (id: string, values: Partial<RecordAggregate['record']>): RecordAggregate => ({
  record: {
    id,
    schemaVersion: 1,
    lifecycle: 'saved',
    occurredAt: '2026-09-03T10:00:00.000Z',
    originalAssetId: `${id}-asset`,
    createdAt: '2026-09-03T10:00:00.000Z',
    updatedAt: '2026-09-03T10:00:00.000Z',
    ...values,
  },
  assets: [],
});

describe('searchRecords', () => {
  const records = [
    item('latte', { beverageName: '拿铁', shopName: '山茶咖啡', city: '上海', mood: '雨天' }),
    item('tea', { beverageName: '茉莉奶绿', shopName: '小茶店', city: '厦门', sugarLevel: '五分糖' }),
  ];

  it('matches natural phrases containing known fields', () => {
    expect(searchRecords(records, '我想找上海的拿铁').map(value => value.record.id)).toEqual(['latte']);
  });

  it('matches sugar and drink words and returns empty for unknown clues', () => {
    expect(searchRecords(records, '五分糖奶茶').map(value => value.record.id)).toEqual(['tea']);
    expect(searchRecords(records, '北京抹茶').map(value => value.record.id)).toEqual([]);
  });
});
