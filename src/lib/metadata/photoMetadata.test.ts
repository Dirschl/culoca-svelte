import { describe, expect, it } from 'vitest';
import { extractPhotoMetadataFields } from './photoMetadata';

describe('extractPhotoMetadataFields', () => {
  it('prefers XMP title values as caption content', () => {
    const result = extractPhotoMetadataFields({
      'XMP-dc:Title': 'Bunte Nacht im Holzland',
      'IPTC:Headline': 'Morgenstimmung am See',
      'XMP-dc:Description': 'Leichter Nebel ueber dem Wasser.'
    });

    expect(result.caption).toBe('Bunte Nacht im Holzland');
    expect(result.title).toBe('Morgenstimmung am See');
    expect(result.description).toBe('Leichter Nebel ueber dem Wasser.');
  });
  it('reads IPTC Byline and CopyrightNotice as creator/copyright fallbacks', () => {
    const result = extractPhotoMetadataFields({
      Byline: 'Dirschl Johann',
      Copyright: 'DIRSCHL.com GmbH',
      CopyrightNotice: 'DIRSCHL.com GmbH'
    });
    expect(result.creator).toBe('Dirschl Johann');
    expect(result.copyright).toBe('DIRSCHL.com GmbH');
    expect(result.copyrightNotice).toBe('DIRSCHL.com GmbH');
    expect(result.copyrightFromTag).toBe('DIRSCHL.com GmbH');
  });

  it('keeps title and caption separated for flat exiftool keys', () => {
    const result = extractPhotoMetadataFields({
      Title: 'Pfarrkirche St. Georg und Urban im Abendlicht',
      Headline: 'Pfarrkirche St. Georg und Urban, Stubenberg, Rottal-Inn',
      Description: 'Historisches Gotteshaus im Abendlicht.'
    });

    expect(result.title).toBe('Pfarrkirche St. Georg und Urban, Stubenberg, Rottal-Inn');
    expect(result.caption).toBe('Pfarrkirche St. Georg und Urban im Abendlicht');
    expect(result.description).toBe('Historisches Gotteshaus im Abendlicht.');
  });

  it('does not map IPTC caption-abstract text into caption', () => {
    const result = extractPhotoMetadataFields({
      Headline: 'Pfarrkirche St. Georg und Urban, Stubenberg, Rottal-Inn',
      Caption:
        'Pfarrkirche St. Georg und Urban in Stubenberg, Rottal-Inn, Niederbayern. Historisches Gotteshaus im ländlichen Holzland, Deutschland.',
      Description:
        'Pfarrkirche St. Georg und Urban in Stubenberg, Rottal-Inn, Niederbayern. Historisches Gotteshaus im ländlichen Holzland, Deutschland.',
      XPSubject: 'Pfarrkirche St. Georg und Urban im Abendlicht'
    });

    expect(result.title).toBe('Pfarrkirche St. Georg und Urban, Stubenberg, Rottal-Inn');
    expect(result.caption).toBe('Pfarrkirche St. Georg und Urban im Abendlicht');
    expect(result.description).toBe(
      'Pfarrkirche St. Georg und Urban in Stubenberg, Rottal-Inn, Niederbayern. Historisches Gotteshaus im ländlichen Holzland, Deutschland.'
    );
  });
});

