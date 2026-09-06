import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radii, spacing } from '../theme';
import { TwinklingStar, WobblingCharm } from './CuteMotionBits';

interface CreamPromptModalProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'warm' | 'celebrate';
  note?: string;
}

/**
 * A small scrapbook-style decision card used for important editor moments.
 * It intentionally avoids the visual mismatch of the native system alert.
 */
export const CreamPromptModal = ({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = 'warm',
  note,
}: CreamPromptModalProps) => (
  <Modal
    animationType="fade"
    onRequestClose={onCancel}
    statusBarTranslucent
    transparent
    visible={visible}
  >
    <View accessibilityViewIsModal style={styles.backdrop}>
      <Pressable
        accessibilityLabel="关闭提示"
        onPress={onCancel}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.card}>
        <View style={styles.tape} />
        <View style={[styles.softBlob, tone === 'celebrate' && styles.celebrateBlob]} />
        <TwinklingStar active={visible} color={colors.blush} size={19} style={styles.starOne} />
        <TwinklingStar active={visible} color={colors.butter} delay={720} size={13} style={styles.starTwo} />
        <WobblingCharm active={visible} kind="flower" delay={400} style={styles.charm} />

        <View style={styles.mascotBadge}>
          <Image
            accessibilityLabel="吨吨记奶油小画家"
            source={require('../../assets/images/diary-girl-mascot.png')}
            resizeMode="contain"
            style={styles.mascot}
          />
          <View style={styles.speechDot} />
          <Text style={styles.speechHeart}>{tone === 'celebrate' ? '✦' : '♡'}</Text>
        </View>

        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.promisePill}>
          <Text style={styles.promiseText}>
            {note ?? (tone === 'celebrate'
              ? '✦ 今天这一页已经亮起来啦'
              : '☕ 这张草稿签还会在这里')}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onConfirm}
            style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
            <Text style={styles.confirmArrow}>→</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(56,36,31,0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 390,
    paddingTop: 86,
    paddingHorizontal: 22,
    paddingBottom: 20,
    overflow: 'hidden',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E8D4B9',
    backgroundColor: colors.card,
    shadowColor: colors.black,
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 13 },
    elevation: 12,
  },
  tape: {
    position: 'absolute',
    top: -3,
    left: '50%',
    width: 92,
    height: 26,
    marginLeft: -46,
    backgroundColor: 'rgba(232,179,111,0.58)',
    transform: [{ rotate: '-3deg' }],
  },
  softBlob: {
    position: 'absolute',
    top: -58,
    right: -42,
    width: 174,
    height: 174,
    borderRadius: 87,
    backgroundColor: colors.blushSoft,
    opacity: 0.72,
  },
  celebrateBlob: { backgroundColor: colors.butterSoft },
  starOne: { position: 'absolute', top: 41, left: 28 },
  starTwo: { position: 'absolute', top: 104, right: 28 },
  charm: { position: 'absolute', left: 23, top: 117 },
  mascotBadge: {
    position: 'absolute',
    top: 24,
    left: '50%',
    width: 78,
    height: 78,
    marginLeft: -39,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: colors.white,
    backgroundColor: colors.butterSoft,
    transform: [{ rotate: '2deg' }],
    shadowColor: colors.cocoa,
    shadowOpacity: 0.13,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  mascot: { width: '100%', height: '100%' },
  speechDot: {
    position: 'absolute',
    right: -13,
    top: 4,
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  speechHeart: {
    position: 'absolute',
    right: -8,
    top: 6,
    color: colors.blush,
    fontSize: 20,
    fontWeight: '900',
  },
  title: {
    marginTop: 17,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  promisePill: {
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.paperDeep,
  },
  promiseText: { color: colors.cocoa, fontSize: 10, fontWeight: '700' },
  actions: { marginTop: 20, flexDirection: 'row', gap: 10 },
  cancelButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  cancelText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  confirmButton: {
    minHeight: 50,
    flex: 1.12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.creamDeep,
    shadowColor: colors.creamDeep,
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  confirmText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  confirmArrow: { color: colors.white, fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
