import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { useGentleLoop } from './CuteMotionBits';
import { useMotionEnabled } from './useMotionEnabled';

type Mood = 'calendar' | 'create' | 'publish' | 'profile' | 'photo';
const notes: Record<Mood, readonly string[]> = {
  calendar: ['今天的小快乐，我帮你收好', '碰杯！普通一天也闪闪发光', '奶茶可以少糖，生活不能少甜'],
  create: ['小纸片，也有大大的想象力', '捏一捏、转一转，贴成你的样子', '这一页不用完美，你喜欢就好'],
  publish: ['打包一份甜，寄给喜欢的人', '叮！你的快乐已装进信封', '今天也有值得分享的小事'],
  profile: ['你的每一杯，我都有认真收藏', '再普通的日子，也有可爱的证据', '今天的小酱油也在陪你呀'],
  photo: ['把喜欢的瞬间，做成小纸贴', '原图好好留着，回忆慢慢贴', '穿搭、美食，都有自己的位置'],
};

/** A tiny tactile desktop companion, kept outside artwork/export and all editing gestures. */
export const PocketCompanion = ({ mood, active = true }: { mood: Mood; active?: boolean }) => {
  const [message, setMessage] = useState(0);
  const [happy, setHappy] = useState(false);
  const enabled = useMotionEnabled(active);
  const idle = useGentleLoop(0, 5600, active);
  const bounce = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!enabled) { bounce.stopAnimation(); sparkle.stopAnimation(); bounce.setValue(0); sparkle.setValue(0); }
    return () => {
      if (timer.current) clearTimeout(timer.current);
      bounce.stopAnimation(); sparkle.stopAnimation();
    };
  }, [bounce, sparkle, enabled]);

  const greet = () => {
    setMessage(value => (value + 1) % notes[mood].length);
    setHappy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHappy(false), 1800);
    if (!enabled) return;
    bounce.stopAnimation(); sparkle.stopAnimation();
    bounce.setValue(1); sparkle.setValue(0);
    Animated.parallel([
      Animated.spring(bounce, { toValue: 0, damping: 7, stiffness: 180, mass: 0.7, useNativeDriver: true, isInteraction: false }),
      Animated.timing(sparkle, { toValue: 1, duration: 1100, useNativeDriver: true, isInteraction: false }),
    ]).start();
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="摸摸小酱油" accessibilityHint="轻点小摆件，收到一句新的贴心话" onPress={greet} style={({ pressed }) => [styles.shelf, pressed && styles.pressed]}>
      <View pointerEvents="none" style={styles.figureSpace}>
        <View style={styles.shadow} />
        <Animated.View style={[styles.figure, { transform: [
          { translateY: idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] }) },
          { rotate: idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-3deg', '3deg', '-3deg'] }) },
          { scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) },
        ] }]}>
          <Image source={require('../../assets/images/diary-girl-mascot.png')} style={styles.mascot} resizeMode="contain" accessible={false} />
        </Animated.View>
        <Animated.Text style={[styles.heart, { opacity: sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ translateY: sparkle.interpolate({ inputRange: [0, 1], outputRange: [4, -18] }) }] }]}>♡</Animated.Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.kicker}>小酱油的陪伴时间</Text>
        <Text accessibilityLiveRegion="polite" style={styles.message}>{notes[mood][message]}</Text>
        <Text style={styles.hint}>{happy ? '收到啦，给你一个软乎乎的拥抱 ♡' : '轻轻点一下，和我打个招呼'}</Text>
      </View>
      <Animated.View pointerEvents="none" style={[styles.charm, { transform: [{ rotate: idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['8deg', '-8deg', '8deg'] }) }] }]}>
        <View style={styles.string} />
        <View style={styles.blossom}>
          {[0, 72, 144, 216, 288].map(angle => <View key={angle} style={[styles.petal, { transform: [{ rotate: `${angle}deg` }, { translateY: -6 }] }]} />)}
          <View style={styles.pollen} />
        </View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shelf: { flexDirection: 'row', alignItems: 'center', minHeight: 88, marginBottom: 18, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: '#EBDDC9', backgroundColor: '#FFF9EC' },
  pressed: { backgroundColor: '#FFF1D9' },
  figureSpace: { width: 64, height: 62, alignItems: 'center', justifyContent: 'center' },
  figure: { width: 57, height: 57, borderRadius: 21, borderWidth: 3, borderColor: colors.white, backgroundColor: colors.butterSoft, overflow: 'hidden' },
  mascot: { width: '100%', height: '100%' },
  shadow: { position: 'absolute', bottom: -1, width: 39, height: 7, borderRadius: 20, backgroundColor: '#E9D8BD', opacity: 0.55 },
  heart: { position: 'absolute', right: 0, top: 0, fontSize: 23, color: '#CF827E' },
  copy: { flex: 1, paddingLeft: 9, paddingRight: 6, gap: 4 },
  kicker: { fontSize: 10, color: colors.creamDeep, letterSpacing: 1.2 },
  message: { fontSize: 14, color: colors.ink, fontWeight: '700', lineHeight: 21 },
  hint: { fontSize: 10, color: colors.inkMuted, lineHeight: 15 },
  charm: { width: 30, height: 58, alignItems: 'center', alignSelf: 'flex-start' },
  string: { height: 12, width: 1, backgroundColor: '#D6BFA1' },
  blossom: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  petal: { position: 'absolute', width: 10, height: 14, borderRadius: 7, backgroundColor: '#F2C8C5', borderWidth: 0.5, borderColor: '#E9B9B6' },
  pollen: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#E4BC78' },
});
