/** Isolated simulator-only visual harness. Never imported by App or production entry points. */
import React, { useState } from 'react';
import { AppRegistry, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AiCreationProgress } from '../src/features/create-studio/AiCreationProgress';
import type { AiCreationPhase } from '../src/features/create-studio/aiCreation';
import { CreamPromptModal } from '../src/design-system/components/CreamPromptModal';

const Preview = () => {
  const [phase, setPhase] = useState<AiCreationPhase>('painting');
  const [visible, setVisible] = useState(true);
  const [failure, setFailure] = useState(false);
  const [startedAt] = useState(Date.now());
  return <View style={styles.screen}>
    <Text>仅用于模拟器视觉验收 · 不调用 AI</Text>
    {(['preparing', 'painting', 'saving'] as const).map(value => <Pressable key={value} style={styles.button} onPress={() => { setPhase(value); setVisible(true); }}><Text>{value}</Text></Pressable>)}
    <Pressable style={styles.button} onPress={() => setFailure(true)}><Text>查看失败提示</Text></Pressable>
    <AiCreationProgress visible={visible} phase={phase} startedAt={startedAt} styleName="奶油海报" preview={require('../src/assets/ai-styles/cream-poster.jpg')}
      imageUri={Image.resolveAssetSource(require('../src/assets/ai-styles/polaroid-note.jpg'))?.uri} onHide={() => setVisible(false)} />
    <CreamPromptModal visible={failure} title="灵感打了个小盹" body="这次没有顺利画好，但你的原图和摆放都还在。休息一下，再试试其他风格吧。"
      note="原照片好好留着呢" confirmLabel="再试一次" cancelLabel="先留在这里" onCancel={() => setFailure(false)} onConfirm={() => { setFailure(false); setVisible(true); }} />
  </View>;
};
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#FAF4E8', justifyContent: 'center', padding: 25, gap: 20 }, button: { padding: 20, borderRadius: 20, backgroundColor: '#F3DAB6' } });
AppRegistry.registerComponent('DrinkDiary', () => Preview);
