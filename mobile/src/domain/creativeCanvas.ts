import type {
  CreativeCanvasElement,
  CreativeCanvasElementBase,
  CreativeCatalogStickerElement,
  CreativeJournalStickerElement,
  CreativePhotoElement,
  CreativeProject,
  JournalSticker,
} from './models';

const LIFE_STICKER_X_SPAN = 0.58;
const LIFE_STICKER_Y_SPAN = 0.53;

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const baseIsValid = (value: Record<string, unknown>) =>
  typeof value.id === 'string'
  && finite(value.positionX)
  && finite(value.positionY)
  && finite(value.scale)
  && finite(value.rotationDegrees)
  && finite(value.zIndex)
  && typeof value.visible === 'boolean';

export const isCreativeCanvasElement = (value: unknown): value is CreativeCanvasElement => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!baseIsValid(candidate)) return false;
  if (candidate.kind === 'photo') return true;
  if (candidate.kind === 'catalog-sticker') return typeof candidate.stickerId === 'string';
  if (candidate.kind === 'journal-sticker') return typeof candidate.journalStickerId === 'string';
  return false;
};

/** Returns undefined for a legacy/unreadable value so callers can hydrate old columns safely. */
export const parseCreativeCanvasElements = (raw?: string): CreativeCanvasElement[] | undefined => {
  if (raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every(isCreativeCanvasElement)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
};

export const creativePhotoElement = (project: CreativeProject): CreativePhotoElement => ({
  id: 'photo',
  kind: 'photo',
  positionX: project.photoPositionX,
  positionY: project.photoPositionY,
  scale: project.photoScale,
  rotationDegrees: project.photoRotationDegrees,
  zIndex: 1,
  visible: true,
});

export const creativeJournalStickerElement = (
  sticker: JournalSticker,
  zIndex: number,
): CreativeJournalStickerElement => ({
  id: `journal-${sticker.id}`,
  kind: 'journal-sticker',
  journalStickerId: sticker.id,
  positionX: sticker.positionX * LIFE_STICKER_X_SPAN,
  positionY: sticker.positionY * LIFE_STICKER_Y_SPAN,
  scale: sticker.scale,
  rotationDegrees: sticker.rotationDegrees,
  zIndex,
  visible: true,
});

const legacyCatalogElement = (project: CreativeProject): CreativeCatalogStickerElement | undefined =>
  project.stickerId === 'none'
    ? undefined
    : {
        id: 'catalog-legacy',
        kind: 'catalog-sticker',
        stickerId: project.stickerId,
        positionX: project.stickerPositionX,
        positionY: project.stickerPositionY,
        scale: project.stickerScale,
        rotationDegrees: project.stickerRotationDegrees,
        zIndex: 2,
        visible: true,
      };

/**
 * Upgrades legacy photo/single-sticker columns and adds genuinely new life
 * stickers. Hidden journal entries remain as tombstones, so deleting from a
 * composition never deletes or unexpectedly restores the diary source.
 */
export const hydrateCreativeCanvasElements = (
  project: CreativeProject,
  journalStickers: JournalSticker[] = [],
): CreativeCanvasElement[] => {
  const existing = project.canvasElements;
  const catalog = legacyCatalogElement(project);
  const sourceJournalIds = new Set(journalStickers.map(sticker => sticker.id));
  const hydrated: CreativeCanvasElement[] = (existing === undefined
    ? [creativePhotoElement(project), ...(catalog ? [catalog] : [])]
    : [...existing])
    // A hidden entry remains a tombstone only while its source photo still
    // belongs to the diary. Once the user removes that source photo, dropping
    // the stale canvas reference prevents an invisible "ghost" selection.
    .filter(item => item.kind !== 'journal-sticker' || sourceJournalIds.has(item.journalStickerId));
  const knownJournalIds = new Set(
    hydrated
      .filter((item): item is CreativeJournalStickerElement => item.kind === 'journal-sticker')
      .map(item => item.journalStickerId),
  );
  let zIndex = hydrated.reduce((maximum, item) => Math.max(maximum, item.zIndex), 0) + 1;
  journalStickers.forEach(sticker => {
    if (!knownJournalIds.has(sticker.id)) {
      hydrated.push(creativeJournalStickerElement(sticker, zIndex));
      zIndex += 1;
    }
  });
  return hydrated;
};

export const createCatalogCanvasElement = (
  instanceId: string,
  stickerId: string,
  existing: CreativeCanvasElement[],
): CreativeCatalogStickerElement => {
  const catalogCount = existing.filter(item => item.kind === 'catalog-sticker').length;
  const step = catalogCount % 5;
  return {
    id: `catalog-${instanceId}`,
    kind: 'catalog-sticker',
    stickerId,
    positionX: 0.16 - step * 0.07,
    positionY: -0.14 + step * 0.075,
    scale: 1,
    rotationDegrees: step % 2 === 0 ? -7 : 7,
    zIndex: existing.reduce((maximum, item) => Math.max(maximum, item.zIndex), 0) + 1,
    visible: true,
  };
};

export const patchCanvasElement = (
  elements: CreativeCanvasElement[],
  elementId: string,
  patch: Partial<CreativeCanvasElementBase>,
) => elements.map(element => element.id === elementId ? { ...element, ...patch } : element);

export const removeCanvasElement = (
  elements: CreativeCanvasElement[],
  elementId: string,
) => elements.flatMap(element => {
  if (element.id !== elementId) return [element];
  // Catalog entries are composition-only instances and can be removed outright.
  // Photo/journal entries stay hidden to remember the user's deletion on reload.
  return element.kind === 'catalog-sticker' ? [] : [{ ...element, visible: false }];
});

export const restorePhotoCanvasElement = (
  project: CreativeProject,
  elements: CreativeCanvasElement[],
): CreativeCanvasElement[] => {
  const current = elements.find(item => item.kind === 'photo');
  if (current) return patchCanvasElement(elements, current.id, { visible: true });
  return [creativePhotoElement(project), ...elements];
};
