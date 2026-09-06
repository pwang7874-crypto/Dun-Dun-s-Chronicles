import { CachesDirectoryPath, downloadFile, exists, read, stat, unlink } from '@dr.pogodin/react-native-fs';
import { Image } from 'react-native';
import type { ImportedPhoto } from '../../domain/models';
import { AiArtError } from '../network/HttpAiArtService';
import { newId } from '../../shared/id';
import { contentTypeFromSignature } from './imageSignature';

const prefix = `${CachesDirectoryPath}/dundun-ai-`;

export const releaseAiImageDownload = async (uri: string): Promise<void> => {
  const path = uri.replace(/^file:\/\//, '');
  if (!path.startsWith(prefix) || !/^[a-f0-9-]+\.download$/i.test(path.slice(prefix.length))) return;
  if (await exists(path)) await unlink(path);
};

export const downloadAiImage = async (url: string, token: string): Promise<ImportedPhoto> => {
  const path = `${prefix}${newId()}.download`;
  const uri = `file://${path}`;
  try {
    const response = await downloadFile({ fromUrl: url, toFile: path,
      headers: { Authorization: `Bearer ${token}`, Accept: 'image/jpeg, image/png' },
      connectionTimeout: 30000, readTimeout: 120000,
    }).promise;
    if (response.statusCode === 401) throw new AiArtError('AI_AUTH_REQUIRED', '请登录后继续收取作品。');
    if (response.statusCode !== 200) throw new AiArtError('AI_DOWNLOAD_PENDING', '作品还没有收好，请稍后继续查看。');
    const file = await stat(path);
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error('Invalid result size');
    const contentType = contentTypeFromSignature(await read(path, 32, 0, 'ascii'));
    if (contentType !== 'image/jpeg' && contentType !== 'image/png') throw new Error('Invalid result type');
    const size = await Image.getSize(uri);
    if (size.width < 1 || size.height < 1 || size.width * size.height > 40_000_000) throw new Error('Invalid result dimensions');
    return { uri, contentType, pixelWidth: size.width, pixelHeight: size.height, byteCount: file.size };
  } catch (error) {
    await releaseAiImageDownload(uri).catch(() => undefined);
    if (error instanceof AiArtError) throw error;
    throw new AiArtError('AI_DOWNLOAD_PENDING', '作品还没下载完整，可以继续收取，不用重新生成。');
  }
};
