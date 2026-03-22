import { describe, expect, it } from 'vitest';
import { extractPhotoMetadataFields } from './photoMetadata';

describe('extractPhotoMetadataFields', () => {
  it('treats IPTC headline values as caption content', () => {
    const result = extractPhotoMetadataFields({
      'IPTC:Headline': 'Morgenstimmung am See',
      'XMP-dc:Description': 'Leichter Nebel ueber dem Wasser.'
    });

    expect(result.caption).toBe('Morgenstimmung am See');
    expect(result.description).toBe('Leichter Nebel ueber dem Wasser.');
  });
});
