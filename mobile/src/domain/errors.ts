export type AppErrorCode =
  | 'PHOTO_UNSUPPORTED'
  | 'PHOTO_TOO_LARGE'
  | 'CAMERA_UNAVAILABLE'
  | 'CAMERA_PERMISSION_DENIED'
  | 'ASSET_WRITE_FAILED'
  | 'RENDER_FAILED'
  | 'PERSISTENCE_FAILED'
  | 'DATABASE_CORRUPTED'
  | 'ASSET_MISSING'
  | 'RECIPE_INCOMPATIBLE'
  | 'CUTOUT_UNAVAILABLE'
  | 'CUTOUT_FAILED'
  | 'PLATFORM_NOT_SUPPORTED';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = 'AppError';
  }
}

export const toAppError = (
  error: unknown,
  fallbackCode: AppErrorCode,
  fallbackMessage: string,
): AppError =>
  error instanceof AppError
    ? error
    : new AppError(fallbackCode, fallbackMessage, { cause: error });
