export interface JournalLayout {
  id: string;
  name: string;
  icon: string;
  paper: string;
  accent: string;
}

export const journalLayouts: JournalLayout[] = [
  { id: 'plain', name: '奶油留白', icon: '□', paper: '#FFFCF6', accent: '#E8DAC8' },
  { id: 'polaroid', name: '拍立得', icon: '▣', paper: '#FFFDF9', accent: '#E6D2BD' },
  { id: 'torn', name: '手撕贴页', icon: '▱', paper: '#F6E9D5', accent: '#F09A98' },
  { id: 'checker', name: '糖果棋盘', icon: '▦', paper: '#FFF5E8', accent: '#F09A98' },
  { id: 'memo', name: '便签日记', icon: '⌑', paper: '#FFF6D9', accent: '#E8B36F' },
  { id: 'postcard', name: '旅行明信片', icon: '▭', paper: '#F4E7D6', accent: '#9CBED7' },
  { id: 'film', name: '胶片小格', icon: '▤', paper: '#EEE2D3', accent: '#79513E' },
  { id: 'flower-frame', name: '花花边框', icon: '✿', paper: '#FFF5F1', accent: '#F09A98' },
  { id: 'blue-scrapbook', name: '雾蓝剪贴', icon: '⌁', paper: '#ECF2F4', accent: '#9CBED7' },
  { id: 'candy-grid', name: '糖果拼贴', icon: '▥', paper: '#FFF1EC', accent: '#F7D36C' },
  { id: 'coffee-zine', name: '咖啡小志', icon: '☕', paper: '#EEDFCB', accent: '#79513E' },
  { id: 'soft-cloud', name: '云朵手账', icon: '☁', paper: '#F5F8FA', accent: '#9CBED7' },
];

