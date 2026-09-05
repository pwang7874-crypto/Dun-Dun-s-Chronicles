import type { RecordAggregate } from '../../domain/models';

export interface DrinkStamp {
  id: string;
  kind: 'shop' | 'milestone';
  title: string;
  subtitle: string;
  monogram: string;
  serial: string;
  issueDate: string;
  count: number;
  paletteIndex: number;
  unlocked: boolean;
}

const hashText = (value: string): number => {
  let hash = 17;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }
  return hash;
};

const stampSerial = (key: string): string =>
  String(hashText(key) % 10000).padStart(4, '0');

export const buildShopStamps = (
  records: RecordAggregate[],
): DrinkStamp[] => {
  const groups = new Map<string, RecordAggregate[]>();

  for (const aggregate of records) {
    const shop = aggregate.record.shopName?.trim();
    if (!shop) {
      continue;
    }
    const key = shop.toLocaleLowerCase('zh-CN');
    groups.set(key, [...(groups.get(key) ?? []), aggregate]);
  }

  return [...groups.entries()]
    .map(([key, visits]) => {
      const sorted = [...visits].sort((left, right) =>
        left.record.occurredAt.localeCompare(right.record.occurredAt),
      );
      const first = sorted[0]!;
      const title = first.record.shopName!.trim();
      const city = sorted.find(item => item.record.city)?.record.city;
      const category = sorted.find(item => item.record.category)?.record.category;
      const hash = hashText(key);

      return {
        id: `shop:${key}`,
        kind: 'shop' as const,
        title,
        subtitle: [city, category].filter(Boolean).join(' · ') || '一家记得住的店',
        monogram: title.slice(0, 1).toLocaleUpperCase('zh-CN'),
        serial: `S-${stampSerial(key)}`,
        issueDate: first.record.occurredAt,
        count: visits.length,
        paletteIndex: hash % 6,
        unlocked: true,
      };
    })
    .sort((left, right) => left.issueDate.localeCompare(right.issueDate));
};

export const buildMilestoneStamps = (
  records: RecordAggregate[],
  shopCount: number,
): DrinkStamp[] => {
  const cities = new Set(
    records.map(item => item.record.city?.trim()).filter(Boolean),
  ).size;
  const firstDate = records[0]?.record.occurredAt ?? new Date(0).toISOString();
  const milestones = [
    {
      id: 'milestone:first-cup',
      title: '第一杯',
      subtitle: '日常正式入册',
      monogram: '01',
      serial: 'M-0001',
      target: 1,
      progress: records.length,
      paletteIndex: 1,
    },
    {
      id: 'milestone:three-shops',
      title: '三店漫游',
      subtitle: `${Math.min(shopCount, 3)} / 3 家店`,
      monogram: '03',
      serial: 'M-0003',
      target: 3,
      progress: shopCount,
      paletteIndex: 2,
    },
    {
      id: 'milestone:ten-cups',
      title: '十杯成册',
      subtitle: `${Math.min(records.length, 10)} / 10 杯`,
      monogram: '10',
      serial: 'M-0010',
      target: 10,
      progress: records.length,
      paletteIndex: 4,
    },
    {
      id: 'milestone:three-cities',
      title: '三城慢游',
      subtitle: `${Math.min(cities, 3)} / 3 座城市`,
      monogram: 'CN',
      serial: 'M-0300',
      target: 3,
      progress: cities,
      paletteIndex: 5,
    },
  ];

  return milestones.map(item => ({
    id: item.id,
    kind: 'milestone',
    title: item.title,
    subtitle: item.subtitle,
    monogram: item.monogram,
    serial: item.serial,
    issueDate: firstDate,
    count: item.progress,
    paletteIndex: item.paletteIndex,
    unlocked: item.progress >= item.target,
  }));
};
