export interface CuteSticker {
  id: string;
  label: string;
  symbol: string;
  tone: string;
}

export const cuteStickers: CuteSticker[] = [
  { id: 'none', label: '不添加', symbol: '无', tone: '#F3ECE1' },
  { id: 'star', label: '小星星', symbol: '★', tone: '#FFF0B4' },
  { id: 'heart', label: '心动', symbol: '♥', tone: '#F9DCD8' },
  { id: 'smile', label: '开心脸', symbol: '☺', tone: '#FFF0B4' },
  { id: 'cherry', label: '小樱桃', symbol: '🍒', tone: '#F9DCD8' },
  { id: 'flower', label: '小雏菊', symbol: '✿', tone: '#FFF2C8' },
  { id: 'bow', label: '蝴蝶结', symbol: '🎀', tone: '#F7D5DD' },
  { id: 'sparkle', label: '闪闪', symbol: '✦', tone: '#FFF0B4' },
  { id: 'cloud', label: '软云朵', symbol: '☁', tone: '#DDEAF4' },
  { id: 'rainbow', label: '小彩虹', symbol: '🌈', tone: '#E8E1F2' },
  { id: 'strawberry', label: '草莓', symbol: '🍓', tone: '#F9DCD8' },
  { id: 'bear', label: '小熊', symbol: '🧸', tone: '#EED8BD' },
  { id: 'bunny', label: '兔兔', symbol: '🐰', tone: '#F5E4E6' },
  { id: 'coffee', label: '咖啡杯', symbol: '☕', tone: '#E6D2BD' },
  { id: 'music', label: '好心情', symbol: '♫', tone: '#DDEAF4' },
  { id: 'leaf', label: '小叶子', symbol: '❧', tone: '#DCE9D8' },
  { id: 'sun', label: '小太阳', symbol: '☀', tone: '#FFF0B4' },
  { id: 'love-note', label: '爱心信', symbol: '💌', tone: '#F9DCD8' },
];

export const stickerSymbol = (id?: string) =>
  cuteStickers.find(item => item.id === id)?.symbol ?? '';

