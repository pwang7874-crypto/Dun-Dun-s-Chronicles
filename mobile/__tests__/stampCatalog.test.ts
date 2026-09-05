import type { RecordAggregate } from '../src/domain/models';
import { buildMilestoneStamps, buildShopStamps } from '../src/features/stamps/stampCatalog';

const aggregate = (
  id: string,
  shopName: string,
  occurredAt: string,
  city = '厦门',
): RecordAggregate => ({
  record: {
    id,
    schemaVersion: 1,
    lifecycle: 'saved',
    occurredAt,
    beverageName: '拿铁',
    category: '咖啡',
    shopName,
    city,
    originalAssetId: '22222222-2222-4222-8222-222222222222',
    createdAt: occurredAt,
    updatedAt: occurredAt,
  },
  assets: [],
});

describe('stamp catalog', () => {
  it('creates one deterministic ticket per shop and counts repeat visits', () => {
    const records = [
      aggregate('11111111-1111-4111-8111-111111111111', '山边咖啡', '2026-09-01T08:00:00.000Z'),
      aggregate('33333333-3333-4333-8333-333333333333', '山边咖啡', '2026-09-02T08:00:00.000Z'),
      aggregate('44444444-4444-4444-8444-444444444444', '月光茶室', '2026-09-03T08:00:00.000Z'),
    ];

    const first = buildShopStamps(records);
    const second = buildShopStamps(records);

    expect(first).toHaveLength(2);
    expect(first).toEqual(second);
    expect(first.find(item => item.title === '山边咖啡')?.count).toBe(2);
    expect(first.every(item => item.serial.startsWith('S-'))).toBe(true);
  });

  it('keeps milestone stamps locked until their real progress is reached', () => {
    const records = [
      aggregate('11111111-1111-4111-8111-111111111111', '山边咖啡', '2026-09-01T08:00:00.000Z'),
    ];
    const milestones = buildMilestoneStamps(records, 1);

    expect(milestones.find(item => item.id === 'milestone:first-cup')?.unlocked).toBe(true);
    expect(milestones.find(item => item.id === 'milestone:ten-cups')?.unlocked).toBe(false);
  });
});
