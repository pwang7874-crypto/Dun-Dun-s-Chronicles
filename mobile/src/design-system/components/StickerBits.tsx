import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

const paperFibres = [
  { left: '5%', top: '8%', width: 54, rotate: '-8deg' },
  { left: '69%', top: '5%', width: 39, rotate: '13deg' },
  { left: '21%', top: '24%', width: 31, rotate: '6deg' },
  { left: '77%', top: '35%', width: 61, rotate: '-11deg' },
  { left: '9%', top: '49%', width: 42, rotate: '12deg' },
  { left: '57%', top: '62%', width: 34, rotate: '-4deg' },
  { left: '17%', top: '78%', width: 67, rotate: '8deg' },
  { left: '72%', top: '89%', width: 46, rotate: '-9deg' },
] as const;

export const PaperTexture = () => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {paperFibres.map((fibre, index) => (
      <View
        key={`${fibre.left}-${fibre.top}`}
        style={[
          styles.fibre,
          index % 2 === 0 ? styles.fibreStrong : styles.fibreSoft,
          {
            left: fibre.left,
            top: fibre.top,
            width: fibre.width,
            transform: [{ rotate: fibre.rotate }],
          },
        ]}
      />
    ))}
    <View style={[styles.speck, styles.speckOne]} />
    <View style={[styles.speck, styles.speckTwo]} />
    <View style={[styles.speck, styles.speckThree]} />
    <Text style={[styles.cuteMark, styles.cuteHeart]}>♡</Text>
    <Text style={[styles.cuteMark, styles.cuteStar]}>✦</Text>
    <Text style={[styles.cuteMark, styles.cuteFlower]}>✿</Text>
    <View style={styles.cuteWave}><View style={styles.cuteWaveLine} /></View>
  </View>
);

export const Tape = ({ tone = 'blue' }: { tone?: 'blue' | 'pink' | 'green' }) => (
  <View
    pointerEvents="none"
    style={[
      styles.tape,
      tone === 'pink' && styles.pink,
      tone === 'green' && styles.green,
    ]}
  />
);

export const DoodleStar = ({ color = colors.butter }: { color?: string }) => (
  <View pointerEvents="none" style={[styles.star, { borderColor: color }]}>
    <Text style={[styles.starText, { color }]}>★</Text>
  </View>
);

const styles = StyleSheet.create({
  fibre: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cocoa,
  },
  fibreStrong: { opacity: 0.18 },
  fibreSoft: { opacity: 0.11 },
  speck: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.cocoa,
    opacity: 0.12,
  },
  speckOne: { left: '32%', top: '14%' },
  speckTwo: { right: '12%', top: '54%' },
  speckThree: { left: '11%', bottom: '9%' },
  cuteMark: { position: 'absolute', opacity: 0.34, fontWeight: '900' },
  cuteHeart: { left: 10, top: '36%', color: colors.blush, fontSize: 20, transform: [{ rotate: '-11deg' }] },
  cuteStar: { right: 13, top: '19%', color: colors.butter, fontSize: 17, transform: [{ rotate: '9deg' }] },
  cuteFlower: { right: 9, bottom: '18%', color: colors.sky, fontSize: 16, transform: [{ rotate: '-7deg' }] },
  cuteWave: { position: 'absolute', left: 5, bottom: '27%', width: 17, height: 10, transform: [{ rotate: '-18deg' }] },
  cuteWaveLine: { width: 17, height: 8, borderTopWidth: 2, borderRadius: 9, borderColor: colors.blush, opacity: 0.28 },
  tape: {
    width: 72,
    height: 22,
    backgroundColor: 'rgba(157,190,215,0.58)',
    transform: [{ rotate: '7deg' }],
  },
  pink: { backgroundColor: 'rgba(240,164,159,0.55)' },
  green: { backgroundColor: 'rgba(159,190,167,0.50)' },
  star: {
    width: 33,
    height: 33,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    transform: [{ rotate: '7deg' }],
  },
  starText: { fontSize: 18 },
});
