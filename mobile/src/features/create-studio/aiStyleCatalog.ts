import { colors } from '../../design-system/theme';
import type { ImageSourcePropType } from 'react-native';

export type AiStyleCategory = '手帐' | '插画' | '影像';

export type AiStyleCard = {
  id: string;
  name: string;
  note: string;
  category: AiStyleCategory;
  tone: string;
};

export const aiStylePreviews: Record<string, ImageSourcePropType> = {
  'cream-poster': require('../../assets/ai-styles/cream-poster.jpg'),
  'jelly-collage': require('../../assets/ai-styles/jelly-collage.jpg'),
  'rain-notebook': require('../../assets/ai-styles/rain-notebook.jpg'),
  'riso-candy': require('../../assets/ai-styles/riso-candy.jpg'),
  'ticket-zine': require('../../assets/ai-styles/ticket-zine.jpg'),
  'polaroid-note': require('../../assets/ai-styles/polaroid-note.jpg'),
  'crayon-doodle': require('../../assets/ai-styles/crayon-doodle.jpg'),
  'watercolor-cafe': require('../../assets/ai-styles/watercolor-cafe.jpg'),
  'ccd-flash': require('../../assets/ai-styles/ccd-flash.jpg'),
  'editorial-grid': require('../../assets/ai-styles/editorial-grid.jpg'),
  'picture-book': require('../../assets/ai-styles/picture-book.jpg'),
  'paper-diorama': require('../../assets/ai-styles/paper-diorama.jpg'),
};

// 客户端只提交 style id。真正的提示词保存在服务端白名单里，避免把可篡改的
// prompt 或模型参数暴露在 App 中。风格名称均为本产品原创命名。
export const aiStyles: readonly AiStyleCard[] = [
  { id: 'cream-poster', name: '奶油海报', note: '软糯留白与手写贴纸', category: '手帐', tone: colors.blushSoft },
  { id: 'jelly-collage', name: '果冻拼贴', note: '透明糖纸与水果色块', category: '手帐', tone: colors.butterSoft },
  { id: 'rain-notebook', name: '雨天手帐', note: '低饱和蓝灰纸页', category: '手帐', tone: colors.skySoft },
  { id: 'riso-candy', name: '糖纸丝印', note: '双色错版印刷颗粒', category: '插画', tone: '#F2DDD0' },
  { id: 'ticket-zine', name: '票根小志', note: '撕纸票据与独立杂志感', category: '手帐', tone: '#E9E0CF' },
  { id: 'polaroid-note', name: '拍立得小记', note: '柔焦相纸与日期手写', category: '影像', tone: '#EFE7D9' },
  { id: 'crayon-doodle', name: '蜡笔涂鸦', note: '童趣线条与粗粝纸感', category: '插画', tone: '#F4D9D0' },
  { id: 'watercolor-cafe', name: '水彩咖啡馆', note: '透明水色与安静木桌', category: '插画', tone: '#DCE6DF' },
  { id: 'ccd-flash', name: 'CCD 闪光夜', note: '克制闪光与日期颗粒', category: '影像', tone: '#D9D3D1' },
  { id: 'editorial-grid', name: '编辑部拼版', note: '杂志网格与醒目留白', category: '影像', tone: '#E7DDD2' },
  { id: 'picture-book', name: '软糖绘本', note: '温柔勾线与轻透色块', category: '插画', tone: '#E8E0EF' },
  { id: 'paper-diorama', name: '纸艺小剧场', note: '分层纸雕与微缩光影', category: '手帐', tone: '#E8D6BE' },
] as const;

export const aiStyleCategories = ['全部', '手帐', '插画', '影像'] as const;
export type AiStyleFilter = typeof aiStyleCategories[number];
