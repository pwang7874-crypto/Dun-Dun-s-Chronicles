import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { colors } from '../../design-system/theme';
import { useGentleLoop } from '../../design-system/components/CuteMotionBits';
import { useMotionEnabled } from '../../design-system/components/useMotionEnabled';
import type { AiCreationPhase } from './aiCreation';

const stages: { id: AiCreationPhase; label: string; title: string; note: string }[] = [
  { id: 'preparing', label: '准备照片', title: '先把照片轻轻铺好', note: '检查照片、准备清晰的创作底稿' },
  { id: 'painting', label: '正在绘制', title: '小酱油正在调一杯灵感', note: 'AI 正在绘制，通常需要一些时间' },
  { id: 'saving', label: '收好作品', title: '最后，贴上一点小快乐', note: '正在下载原尺寸作品，并放进主图' },
];
const whispers = ['灵感正在慢慢冒泡，你的原图好好留着呢', '这次不用多点几下，我已经接到任务啦', '给灵感一点时间，先和小酱油碰个杯'];

export const AiCreationProgress = ({ visible, phase, startedAt, styleName, preview, imageUri, onHide }: {
  visible: boolean; phase: AiCreationPhase; startedAt: number; styleName: string;
  preview: ImageSourcePropType; imageUri?: string; onHide: () => void;
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [whisper, setWhisper] = useState(0);
  const animated = useMotionEnabled(visible);
  const loop = useGentleLoop(0, 4200, visible);
  const second = useGentleLoop(600, 5100, visible);
  const active = stages.findIndex(item => item.id === phase);
  useEffect(() => {
    if (!visible) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [visible, startedAt]);
  // Stable native animation nodes: the elapsed-time label must not restart motion every second.
  const motion = useMemo(() => {
    const bob = loop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] });
    return { bob, styleBob: Animated.multiply(bob, -0.65), mascotBob: Animated.multiply(bob, 0.4),
      sway: second.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-5deg', '3deg', '-5deg'] }),
      sparkle: { opacity: animated ? loop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 1, 0.35] }) : 0.8 },
      activeLine: { opacity: animated ? loop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] }) : 1 },
    };
  }, [animated, loop, second]);
  const { bob, sway } = motion;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onHide} statusBarTranslucent>
    <ScrollView style={styles.overlay} contentContainerStyle={styles.backdrop} accessibilityViewIsModal bounces={false}>
      <View style={styles.card}>
        <View style={styles.tape} />
        <Text style={styles.eyebrow}>小酱油的创作小工坊</Text>
        <Text style={styles.styleTag}>{styleName} · {phase === 'saving' ? '作品收纳中' : phase === 'preparing' ? '底稿准备中' : '正在酝酿'}</Text>
        <View style={styles.workshop} pointerEvents="box-none">
          <View style={styles.warmCircle} />
          <Animated.View style={[styles.paper, styles.sourcePaper, { transform: [{ rotate: '-9deg' }, { translateY: bob }] }]}>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" /> : <View style={styles.photo} />}
            <Text style={styles.caption}>你的照片</Text>
          </Animated.View>
          <Animated.View style={[styles.paper, styles.stylePaper, { transform: [{ rotate: '8deg' }, { translateY: motion.styleBob }] }]}>
            <Image source={preview} style={styles.photo} resizeMode="cover" />
            <Text style={styles.caption}>风格灵感</Text>
          </Animated.View>
          <Animated.Text style={[styles.sparkle, motion.sparkle]}>✦</Animated.Text>
          <Animated.Text style={[styles.pencil, { transform: [{ rotate: sway }, { translateY: bob }] }]}>✎</Animated.Text>
          <Pressable accessibilityRole="button" accessibilityLabel="给小酱油加一点灵感" onPress={() => setWhisper(value => (value + 1) % whispers.length)} style={styles.mascotButton}>
            <Animated.Image source={require('../../assets/images/diary-girl-mascot.png')} resizeMode="contain" style={[styles.mascot, { transform: [{ translateY: motion.mascotBob }] }]} />
          </Pressable>
        </View>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{stages[active]?.title}</Text>
        <Text style={styles.note}>{stages[active]?.note}</Text>
        <View accessible accessibilityRole="progressbar" accessibilityLabel={`创作进度：${stages[active]?.label}`} accessibilityState={{ busy: true }} style={styles.steps}>
          {stages.map((stage, index) => <View key={stage.id} style={styles.step}>
            <View style={[styles.stepDot, index <= active && styles.stepDotActive]}>
              <Text style={[styles.stepNumber, index <= active && styles.stepNumberActive]}>{index < active ? '✓' : `0${index + 1}`}</Text>
            </View>
            <Text style={[styles.stepLabel, index === active && styles.stepLabelActive]}>{stage.label}</Text>
            <Animated.View style={[styles.stepLine, index <= active && styles.stepLineActive, index === active && motion.activeLine]} />
          </View>)}
        </View>
        <View style={styles.timePill}><Text style={styles.time}>已等待 {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</Text></View>
        <Text style={styles.whisper}>{elapsed > 60 && whisper === 0 ? phase === 'saving' ? '已经画好啦，正在把作品稳稳收进手机' : '这次比平时慢一点，仍在等待真实结果' : whispers[whisper]}</Text>
        <Pressable accessibilityRole="button" onPress={onHide} style={styles.hide}><Text style={styles.hideText}>先收起，稍后回来看看 ↓</Text></Pressable>
        <Text style={styles.footnote}>收起不会发起新任务 · 请勿卸载或清除 App 数据</Text>
      </View>
    </ScrollView>
  </Modal>;
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(58,43,32,0.40)' },
  backdrop: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  card: { width: '100%', maxWidth: 380, borderRadius: 34, padding: 22, paddingTop: 28, backgroundColor: '#FFFBF2', borderWidth: 1.5, borderColor: '#EDE0CD', shadowColor: '#5A3C27', shadowOpacity: 0.16, shadowRadius: 25, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  tape: { position: 'absolute', width: 70, height: 18, backgroundColor: '#EBCFABA8', top: -6, alignSelf: 'center', transform: [{ rotate: '-4deg' }] },
  eyebrow: { textAlign: 'center', color: colors.ink, fontWeight: '700', fontSize: 16 },
  styleTag: { textAlign: 'center', color: colors.creamDeep, fontSize: 11, marginTop: 8 },
  workshop: { height: 184, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  warmCircle: { position: 'absolute', width: 170, height: 142, borderRadius: 85, backgroundColor: '#FAECD4' },
  paper: { position: 'absolute', width: 98, height: 125, padding: 6, backgroundColor: '#FFFFFF', borderRadius: 10, shadowColor: colors.cocoa, shadowOpacity: 0.12, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  sourcePaper: { left: '9%', top: 18 },
  stylePaper: { right: '7%', top: 30 },
  photo: { width: '100%', height: 87, borderRadius: 6, backgroundColor: '#EEE5D7' },
  caption: { fontSize: 9, color: colors.inkMuted, marginTop: 7, textAlign: 'center' },
  mascotButton: { position: 'absolute', bottom: 1, alignSelf: 'center', width: 66, height: 65, padding: 4, borderRadius: 25, backgroundColor: '#FFF9EA', borderColor: '#FFFFFF', borderWidth: 3 },
  mascot: { width: '100%', height: '100%' },
  sparkle: { position: 'absolute', right: '2%', top: 8, color: '#DBB363', fontSize: 27 },
  pencil: { position: 'absolute', left: '2%', bottom: 20, color: '#A47957', fontSize: 42 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  note: { fontSize: 11, lineHeight: 19, color: colors.inkMuted, textAlign: 'center', marginTop: 7 },
  steps: { flexDirection: 'row', gap: 8, marginTop: 24 },
  step: { flex: 1, alignItems: 'center', gap: 8 },
  stepDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0E8DB', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#F0D6A9' },
  stepNumber: { color: '#A59B8D', fontSize: 10, fontWeight: '700' },
  stepNumberActive: { color: '#805A39' },
  stepLabel: { color: '#A59B8D', fontSize: 10 },
  stepLabelActive: { color: colors.cocoa, fontWeight: '700' },
  stepLine: { height: 4, borderRadius: 3, backgroundColor: '#EEE5D8', width: '100%' },
  stepLineActive: { backgroundColor: '#DCAF72' },
  timePill: { alignSelf: 'center', marginTop: 18, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F6EDDE' },
  time: { fontSize: 10, color: '#A17955', fontVariant: ['tabular-nums'] },
  whisper: { color: colors.inkMuted, textAlign: 'center', fontSize: 10, lineHeight: 17, marginTop: 10, minHeight: 34 },
  hide: { minHeight: 44, justifyContent: 'center', borderRadius: 18, backgroundColor: '#F5E3CD', marginTop: 10 },
  hideText: { textAlign: 'center', color: colors.cocoa, fontSize: 12, fontWeight: '600' },
  footnote: { textAlign: 'center', color: colors.inkMuted, fontSize: 8, marginTop: 9 },
});
