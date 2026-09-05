import type { BeverageCategory } from '../../domain/models';

export interface ClassicDrinkOption {
  name: string;
  category: BeverageCategory;
}

export const milkTeaClassics: ClassicDrinkOption[] = [
  { name: '珍珠奶茶', category: '奶茶' },
  { name: '黑糖波波', category: '奶茶' },
  { name: '芋泥奶茶', category: '奶茶' },
  { name: '生椰奶茶', category: '奶茶' },
  { name: '奶盖茶', category: '茶' },
  { name: '水果茶', category: '果汁' },
  { name: '纯茶', category: '茶' },
  { name: '抹茶奶绿', category: '抹茶' },
];

export const coffeeClassics: ClassicDrinkOption[] = [
  { name: '拿铁', category: '咖啡' },
  { name: '美式', category: '咖啡' },
  { name: '澳白', category: '咖啡' },
  { name: '卡布奇诺', category: '咖啡' },
  { name: '摩卡', category: '咖啡' },
  { name: '冷萃', category: '咖啡' },
  { name: '手冲', category: '咖啡' },
  { name: 'Dirty', category: '咖啡' },
];

export const familiarShops = [
  '喜茶',
  '奈雪的茶',
  '霸王茶姬',
  '茶百道',
  '古茗',
  '蜜雪冰城',
  '瑞幸咖啡',
  '星巴克',
  'Manner',
  'Seesaw',
] as const;

