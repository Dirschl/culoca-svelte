import type { RequestHandler } from '@sveltejs/kit';
import sharp from 'sharp';
import { supabase } from '$lib/supabaseClient';

const SUPABASE_STORAGE_URL = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';

export const GET: RequestHandler = async ({ params, fetch }) => {
  const { id } = params;
  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  console.log(`🔍 OG-Image API: Processing image ${id}`);

  // 1. Hole Bilddaten aus Supabase DB
  const { data: images, error } = await supabase
    .from('images')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    console.error(`❌ Supabase error: ${error.message}`);
    return new Response(`Database error: ${error.message}`, { status: 500 });
  }

  if (!images || images.length === 0) {
    console.error(`❌ No image found with ID: ${id}`);
    return new Response('Image not found', { status: 404 });
  }

  const image = images[0];
  console.log(`✅ Found image: ${image.original_name}, path_512: ${image.path_512}, path_2048: ${image.path_2048}`);

  // 2. Hole Bilddatei (512 oder 2048)
  const path = image.path_2048 || image.path_512;
  if (!path) {
    console.error(`❌ No image path found for ID: ${id}`);
    return new Response('No image file', { status: 404 });
  }
  
  const imgUrl = image.path_2048
    ? `${SUPABASE_STORAGE_URL}/images-2048/${image.path_2048}`
    : `${SUPABASE_STORAGE_URL}/images-512/${image.path_512}`;
    
  console.log(`📥 Fetching image from: ${imgUrl}`);
  
  const imgRes = await fetch(imgUrl);
  console.log(`📊 Image fetch response status: ${imgRes.status}`);
  
  if (!imgRes.ok) {
    console.error(`❌ Image fetch error: ${imgRes.status} ${imgRes.statusText}`);
    return new Response(`Image file not found (Storage: ${imgRes.status})`, { status: 404 });
  }
  
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  console.log(`✅ Image loaded, size: ${imgBuffer.length} bytes`);

  // 3. OG-Image generieren (1200x630, zentriert, bei Hochformat mit Blur-Rand)
  const ogWidth = 1200;
  const ogHeight = 630;
  let outputBuffer: Buffer;
  try {
    const meta = await sharp(imgBuffer).metadata();
    console.log(`📐 Image metadata: ${meta.width}x${meta.height}, format: ${meta.format}`);
    
    let mainImage;
    if (meta.width && meta.height && meta.height > meta.width) {
      // Hochformat: Bild zentrieren, Ränder mit Blur
      console.log(`🖼️ Processing portrait image with blur background`);
      const resized = await sharp(imgBuffer)
        .resize({ height: ogHeight, fit: 'contain', background: { r: 32, g: 32, b: 32 } })
        .toBuffer();
      const blurred = await sharp(imgBuffer)
        .resize({ width: ogWidth, height: ogHeight, fit: 'cover' })
        .blur(40)
        .toBuffer();
      mainImage = await sharp(blurred)
        .composite([{ input: resized, gravity: 'center' }])
        .jpeg({ quality: 90 })
        .toBuffer();
    } else {
      // Querformat oder quadratisch: einfach cover
      console.log(`🖼️ Processing landscape/square image with cover fit`);
      mainImage = await sharp(imgBuffer)
        .resize(ogWidth, ogHeight, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();
    }
    outputBuffer = mainImage;
    console.log(`✅ OG-Image generated successfully, size: ${outputBuffer.length} bytes`);
  } catch (e: any) {
    // Fallback: graues Bild mit Text
    console.error(`❌ Error generating OG-Image: ${e?.message || 'Unknown error'}`);
    console.log(`🔄 Creating fallback gray image`);
    outputBuffer = await sharp({
      create: {
        width: ogWidth,
        height: ogHeight,
        channels: 3,
        background: { r: 32, g: 32, b: 32 }
      }
    })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  return new Response(outputBuffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}; 