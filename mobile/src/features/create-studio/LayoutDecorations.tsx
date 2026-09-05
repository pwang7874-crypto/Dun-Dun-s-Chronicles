import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../design-system/theme';

export const LayoutDecorations = ({ layoutId }: { layoutId?: string }) => {
  if (layoutId === 'memo') {
    return <View pointerEvents="none" style={styles.fill}>{[0, 1, 2, 3, 4].map(index => <View key={index} style={[styles.memoLine, { top: `${18 + index * 16}%` }]} />)}</View>;
  }
  if (layoutId === 'postcard') {
    return <View pointerEvents="none" style={styles.fill}><View style={styles.postcardLine} /><View style={styles.postcardStamp}><Text style={styles.postcardStar}>★</Text></View></View>;
  }
  if (layoutId === 'film') {
    return <View pointerEvents="none" style={styles.fill}><View style={styles.filmLeft}><FilmDots /></View><View style={styles.filmRight}><FilmDots /></View></View>;
  }
  if (layoutId === 'flower-frame') {
    return <View pointerEvents="none" style={styles.fill}><Text style={[styles.cornerFlower, styles.topLeft]}>✿</Text><Text style={[styles.cornerFlower, styles.topRight]}>✿</Text><Text style={[styles.cornerFlower, styles.bottomLeft]}>✿</Text><Text style={[styles.cornerFlower, styles.bottomRight]}>✿</Text></View>;
  }
  if (layoutId === 'blue-scrapbook') {
    return <View pointerEvents="none" style={styles.fill}><View style={styles.blueTape} /><Text style={styles.blueScribble}>〜 ✦</Text></View>;
  }
  if (layoutId === 'candy-grid') {
    return <View pointerEvents="none" style={styles.candyRow}>{['#F9DCD8', '#FFF0B4', '#DDEAF4', '#DCE9D8'].map(tone => <View key={tone} style={[styles.candy, { backgroundColor: tone }]} />)}</View>;
  }
  if (layoutId === 'coffee-zine') {
    return <View pointerEvents="none" style={styles.fill}><Text style={styles.zineType}>DAILY{`\n`}BREW</Text><View style={styles.zineRule} /></View>;
  }
  if (layoutId === 'soft-cloud') {
    return <View pointerEvents="none" style={styles.fill}><Text style={styles.cloudOne}>☁</Text><Text style={styles.cloudTwo}>☁</Text><Text style={styles.cloudStar}>✦</Text></View>;
  }
  return null;
};

const FilmDots = () => <>{Array.from({ length: 7 }, (_, index) => <View key={index} style={styles.filmDot} />)}</>;

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  memoLine: { position: 'absolute', left: 10, right: 10, height: StyleSheet.hairlineWidth, backgroundColor: '#D9C9A9', opacity: 0.55 },
  postcardLine: { position: 'absolute', top: 18, bottom: 18, left: '52%', width: 1, backgroundColor: colors.sky, opacity: 0.48 },
  postcardStamp: { position: 'absolute', right: 13, top: 13, width: 38, height: 45, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  postcardStar: { color: colors.creamDeep, fontSize: 17 },
  filmLeft: { position: 'absolute', left: 5, top: 7, bottom: 7, justifyContent: 'space-around' },
  filmRight: { position: 'absolute', right: 5, top: 7, bottom: 7, justifyContent: 'space-around' },
  filmDot: { width: 7, height: 10, borderRadius: 2, backgroundColor: colors.cocoa, opacity: 0.56 },
  cornerFlower: { position: 'absolute', color: colors.blush, fontSize: 25, opacity: 0.72 },
  topLeft: { left: 7, top: 4, transform: [{ rotate: '-18deg' }] },
  topRight: { right: 7, top: 4, transform: [{ rotate: '18deg' }] },
  bottomLeft: { left: 7, bottom: 4, transform: [{ rotate: '18deg' }] },
  bottomRight: { right: 7, bottom: 4, transform: [{ rotate: '-18deg' }] },
  blueTape: { position: 'absolute', left: 25, top: 3, width: 80, height: 22, backgroundColor: colors.sky, opacity: 0.45, transform: [{ rotate: '-8deg' }] },
  blueScribble: { position: 'absolute', right: 15, bottom: 10, color: colors.sky, fontSize: 22, fontWeight: '900', transform: [{ rotate: '-8deg' }] },
  candyRow: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', transform: [{ rotate: '4deg' }] },
  candy: { width: 17, height: 17 },
  zineType: { position: 'absolute', left: 8, top: 10, color: colors.cocoa, fontSize: 12, lineHeight: 12, fontWeight: '900', letterSpacing: 1.2, opacity: 0.65 },
  zineRule: { position: 'absolute', left: 8, bottom: 9, width: 70, height: 4, backgroundColor: colors.cocoa, opacity: 0.44 },
  cloudOne: { position: 'absolute', left: 8, top: 8, color: colors.sky, fontSize: 27, opacity: 0.55 },
  cloudTwo: { position: 'absolute', right: 9, bottom: 7, color: colors.sky, fontSize: 32, opacity: 0.45 },
  cloudStar: { position: 'absolute', right: 13, top: 13, color: colors.butter, fontSize: 18 },
});
