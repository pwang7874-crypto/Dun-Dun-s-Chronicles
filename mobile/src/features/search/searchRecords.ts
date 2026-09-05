import type { RecordAggregate } from '../../domain/models';

const searchableValues = (item: RecordAggregate): string[] => {
  const record = item.record;
  const date = new Date(record.occurredAt);
  return [
    record.beverageName,
    record.category,
    record.shopName,
    record.sugarLevel,
    record.temperature,
    record.city,
    record.mood,
    record.note,
    `${date.getFullYear()}年${date.getMonth() + 1}月`,
  ].filter((value): value is string => Boolean(value)).map(value => value.toLocaleLowerCase('zh-CN'));
};

const ignoredWords = /[我想要找看看喝过的是在和与的那一杯]/g;

export const searchRecords = (records: RecordAggregate[], rawQuery: string): RecordAggregate[] => {
  const query = rawQuery.trim().toLocaleLowerCase('zh-CN');
  if (!query) {
    return [...records].reverse();
  }
  const compactQuery = query.replace(/\s+/g, '').replace(ignoredWords, '');
  return [...records].reverse().filter(item => {
    const values = searchableValues(item);
    const joined = values.join('');
    if (joined.includes(compactQuery) || values.some(value => query.includes(value) || value.includes(query))) {
      return true;
    }
    const terms = query.split(/[\s，。,.、]+/).filter(Boolean);
    return terms.length > 1 && terms.every(term => joined.includes(term));
  });
};
