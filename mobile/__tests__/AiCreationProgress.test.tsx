import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AiCreationProgress } from '../src/features/create-studio/AiCreationProgress';

jest.mock('../src/design-system/components/useMotionEnabled', () => ({ useMotionEnabled: () => false }));
const props = { visible: true, phase: 'painting' as const, startedAt: Date.now(),
  styleName: '奶油海报', preview: 1, onHide: jest.fn() };
describe('cream creation progress', () => {
  it('shows actual phases, elapsed time, and no fabricated percentage', async () => {
    const screen = await render(<AiCreationProgress {...props} />);
    expect(screen.getByRole('progressbar').props.accessibilityLabel).toBe('创作进度：正在绘制');
    expect(screen.getByText('小酱油的创作小工坊')).toBeTruthy();
    expect(screen.getByText(/已等待/)).toBeTruthy();
    expect(screen.queryByText(/\d+%/)).toBeNull();
  });
  it('has a gentle interactive mascot and can fold without starting another task', async () => {
    const onHide = jest.fn(); const screen = await render(<AiCreationProgress {...props} onHide={onHide} />);
    await fireEvent.press(screen.getByRole('button', { name: '给小酱油加一点灵感' }));
    expect(screen.getByText('这次不用多点几下，我已经接到任务啦')).toBeTruthy();
    await fireEvent.press(screen.getByText('先收起，稍后回来看看 ↓'));
    expect(onHide).toHaveBeenCalledTimes(1);
  });
  it('changes to the real saving stage and checks off drawing', async () => {
    const screen = await render(<AiCreationProgress {...props} phase="saving" />);
    expect(screen.getByRole('progressbar').props.accessibilityLabel).toBe('创作进度：收好作品');
    expect(screen.getAllByText('✓')).toHaveLength(2);
  });
});
