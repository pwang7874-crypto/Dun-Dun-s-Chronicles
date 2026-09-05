import {
  buildShareCopy,
  editableShareTags,
  normalizeShareTags,
  parseShareTags,
  prepareShareDraft,
} from '../src/features/publish-studio/shareCopy';

const draft = {
  recordId: 'record-1',
  channel: 'redbook' as const,
  title: '  今天也要喝甜甜的  ',
  body: '  奶茶让今天变得软乎乎。  ',
  tags: ['#奶茶日常', '吨吨记', '奶茶日常'],
  updatedAt: '2026-09-04T00:00:00.000Z',
};

describe('publish share copy', () => {
  it('locks the app tag, removes hashes and de-duplicates tags', () => {
    expect(normalizeShareTags(draft.tags)).toEqual(['吨吨记', '奶茶日常']);
    expect(parseShareTags('#周五快乐  #奶茶日常')).toEqual(['吨吨记', '周五快乐', '奶茶日常']);
    expect(editableShareTags(draft.tags)).toEqual(['奶茶日常']);
  });

  it('prepares clean fields for persistence', () => {
    expect(prepareShareDraft(draft)).toMatchObject({
      title: '今天也要喝甜甜的',
      body: '奶茶让今天变得软乎乎。',
      tags: ['吨吨记', '奶茶日常'],
    });
  });

  it('copies title, body and all tags as one ready-to-publish block', () => {
    expect(buildShareCopy(draft)).toBe(
      '今天也要喝甜甜的\n\n奶茶让今天变得软乎乎。\n\n#吨吨记 #奶茶日常',
    );
  });

  it('still includes the brand tag when all optional copy is empty', () => {
    expect(buildShareCopy({ ...draft, title: '', body: '', tags: [] })).toBe('#吨吨记');
  });
});
