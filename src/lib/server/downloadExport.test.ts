import { exiftool } from 'exiftool-vendored';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  renderDownloadExport,
  buildDownloadFilename,
  rewriteJpegMetadataWithoutSharp
} from './downloadExport';

describe('downloadExport', () => {
  it('renders open graph exports from auto-oriented JPEGs without failing crop math', async () => {
    const source = await sharp({
      create: {
        width: 1200,
        height: 1800,
        channels: 3,
        background: { r: 120, g: 80, b: 40 }
      }
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await renderDownloadExport(
      source,
      {
        id: '28fe6820-16af-4cda-90dc-a36243acea7d',
        width: 1800,
        height: 1200,
        title: 'Abendlicht am Weiher',
        caption: 'Ein stiller Moment im Abendlicht.',
        description: 'Ein stiller Moment im Abendlicht.',
        profile: {
          full_name: 'Test Creator'
        }
      },
      {
        sizeMode: 'custom',
        width: 1200,
        height: 630,
        cropEnabled: true,
        crop: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        format: 'jpg',
        metadataMode: 'culoca',
        filenameMode: 'web'
      }
    );

    expect(result.outputWidth).toBe(1200);
    expect(result.outputHeight).toBe(630);
    expect(result.contentType).toBe('image/jpeg');
  });

  it('uses the short id in web filenames', () => {
    const filename = buildDownloadFilename(
      {
        id: '28fe6820-16af-4cda-90dc-a36243acea7d',
        short_id: 'abc123def4',
        title: 'Abendlicht am Weiher'
      },
      {
        sizeMode: 'full',
        format: 'jpg',
        metadataMode: 'original',
        filenameMode: 'web'
      }
    );

    expect(filename).toBe('abendlicht-am-weiher-culoca-abc123def4.jpg');
  });

  it('rewrites full resolution culoca jpeg metadata without sharp', async () => {
    const source = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 60, g: 90, b: 120 }
      }
    })
      .jpeg()
      .toBuffer();

    const result = await rewriteJpegMetadataWithoutSharp(
      source,
      {
        id: '28fe6820-16af-4cda-90dc-a36243acea7d',
        short_id: 'abc123def4',
        title: 'Abendlicht am Weiher',
        caption: 'Ein stiller Moment im Abendlicht.',
        description: 'Ein stiller Moment im Abendlicht.',
        keywords: ['abend', 'weiher'],
        profile: {
          full_name: 'Test Creator'
        },
        exif_data: {
          Copyright: 'Johann Dirschl'
        },
        lat: 48.123,
        lon: 12.456,
        width: 1200,
        height: 800
      },
      {
        sizeMode: 'full',
        format: 'jpg',
        metadataMode: 'culoca',
        filenameMode: 'web'
      }
    );

    const tempFile = join(tmpdir(), `culoca-download-test-${randomUUID()}.jpg`);

    try {
      await fs.writeFile(tempFile, result.buffer);
      const tags = await exiftool.read(tempFile);

      expect(tags.Copyright).toBe('Johann Dirschl | culoca.com');
      expect(tags.Headline).toBe('Abendlicht am Weiher');
      expect(tags.Title).toBe('Ein stiller Moment im Abendlicht.');
      expect(tags.UsageTerms).toBe('culoca.com');
      expect(tags.Marked).toBe(true);
      expect(tags.ImageDescription).toBe('Ein stiller Moment im Abendlicht.');
    } finally {
      await fs.unlink(tempFile).catch(() => undefined);
    }
  });
});
