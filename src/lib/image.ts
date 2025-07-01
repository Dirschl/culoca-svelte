import sharp from 'sharp';

export async function resizeJPG(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  const { width: originalWidth, height: originalHeight } = metadata;
  
  // Calculate target dimensions to make longest edge 2048px
  let targetWidth2048, targetHeight2048;
  if (originalWidth && originalHeight) {
    if (originalWidth >= originalHeight) {
      // Width is longer - make width 2048
      targetWidth2048 = 2048;
      targetHeight2048 = Math.round((originalHeight / originalWidth) * 2048);
    } else {
      // Height is longer - make height 2048
      targetHeight2048 = 2048;
      targetWidth2048 = Math.round((originalWidth / originalHeight) * 2048);
    }
  } else {
    targetWidth2048 = 2048;
    targetHeight2048 = 2048;
  }

  console.log(`Resizing from ${originalWidth}x${originalHeight} to ${targetWidth2048}x${targetHeight2048}`);

  return {
    original: buffer,
    jpg2048: await sharp(buffer)
      .resize(targetWidth2048, targetHeight2048, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ mozjpeg: true, quality: 85 })
      .toBuffer(),
    jpg512: await sharp(buffer)
      .resize(512, 512, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ mozjpeg: true, quality: 80 })
      .toBuffer(),
    jpg64: await sharp(buffer)
      .resize(64, 64, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ mozjpeg: true, quality: 70 })
      .toBuffer()
  };
}
