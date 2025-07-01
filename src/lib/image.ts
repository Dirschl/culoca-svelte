import sharp from 'sharp';

export async function resizeJPG(buffer: Buffer) {
  return {
    original: buffer,
    jpg2048 : await sharp(buffer).resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).jpeg({ mozjpeg: true }).toBuffer(),
    jpg512  : await sharp(buffer).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ mozjpeg: true }).toBuffer(),
    jpg64   : await sharp(buffer).resize(64, 64, { fit: 'inside', withoutEnlargement: true }).jpeg({ mozjpeg: true }).toBuffer()
  };
}
