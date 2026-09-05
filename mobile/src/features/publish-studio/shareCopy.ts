import type { ShareDraft } from '../../domain/models';

export const DUNDUN_TAG = '吨吨记';

const cleanTag = (tag: string) => tag.trim().replace(/^#+/, '').trim();

/** Keeps the app tag locked in while preserving the user's own tag order. */
export const normalizeShareTags = (tags: string[]): string[] => {
  const seen = new Set<string>();
  return [DUNDUN_TAG, ...tags]
    .map(cleanTag)
    .filter(tag => {
      if (!tag || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
};

export const parseShareTags = (value: string): string[] => normalizeShareTags(
  value.split(/[\s#]+/).filter(Boolean),
);

export const editableShareTags = (tags: string[]): string[] => normalizeShareTags(tags)
  .filter(tag => tag !== DUNDUN_TAG);

export const prepareShareDraft = (draft: ShareDraft): ShareDraft => ({
  ...draft,
  title: draft.title.trim(),
  body: draft.body.trim(),
  tags: normalizeShareTags(draft.tags),
});

export const buildShareCopy = (draft: ShareDraft): string => {
  const prepared = prepareShareDraft(draft);
  const tagLine = prepared.tags.map(tag => `#${tag}`).join(' ');
  return [prepared.title, prepared.body, tagLine].filter(Boolean).join('\n\n');
};
