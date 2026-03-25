import { describe, expect, it } from 'vitest';
import { isMeaningfulAttributionValue, resolveAttribution } from './attributionResolver';

describe('isMeaningfulAttributionValue', () => {
  it('rejects placeholders', () => {
    expect(isMeaningfulAttributionValue(null)).toBe(false);
    expect(isMeaningfulAttributionValue('')).toBe(false);
    expect(isMeaningfulAttributionValue('  ')).toBe(false);
    expect(isMeaningfulAttributionValue('Unbekannt')).toBe(false);
    expect(isMeaningfulAttributionValue('unknown')).toBe(false);
    expect(isMeaningfulAttributionValue('N/A')).toBe(false);
  });

  it('accepts real names', () => {
    expect(isMeaningfulAttributionValue('Johann Dirschl')).toBe(true);
    expect(isMeaningfulAttributionValue('DIRSCHL.com GmbH')).toBe(true);
  });
});

describe('resolveAttribution', () => {
  it('uses EXIF when profile is null (no EXIF flags required)', () => {
    const a = resolveAttribution({
      exifData: {
        Artist: 'Dirschl Johann',
        Copyright: 'DIRSCHL.com GmbH',
        CopyrightNotice: 'DIRSCHL.com GmbH'
      },
      profile: null,
      mode: 'culoca'
    });
    expect(a.creatorName).toBe('Dirschl Johann');
    expect(a.copyrightHolderName).toBe('DIRSCHL.com GmbH');
    expect(a.creditText).toContain('Dirschl Johann');
    expect(a.authorMeta).toBe('Dirschl Johann');
    expect(a.copyrightNotice).toContain('DIRSCHL.com GmbH');
  });

  it('ignores meaningless profile full_name and still uses EXIF', () => {
    const a = resolveAttribution({
      exifData: { Artist: 'Dirschl Johann', Copyright: 'DIRSCHL.com GmbH' },
      profile: { full_name: 'Unbekannt', use_exif_creator_override: false },
      mode: 'culoca'
    });
    expect(a.creatorName).toBe('Dirschl Johann');
    expect(a.copyrightHolderName).toBe('DIRSCHL.com GmbH');
  });

  it('prefers profile defaults when EXIF override is off and profile is meaningful', () => {
    const a = resolveAttribution({
      exifData: { Artist: 'Someone Else', Copyright: 'EXIF Corp' },
      profile: {
        default_creator_name: 'Johann Dirschl',
        copyright_holder_name: 'DIRSCHL.com GmbH',
        use_exif_creator_override: false,
        use_exif_copyright_override: false
      },
      mode: 'culoca'
    });
    expect(a.creatorName).toBe('Johann Dirschl');
    expect(a.copyrightHolderName).toBe('DIRSCHL.com GmbH');
  });

  it('EXIF override wins when flags are true', () => {
    const a = resolveAttribution({
      exifData: { Artist: 'Dirschl Johann', Copyright: 'EXIF Only GmbH' },
      profile: {
        default_creator_name: 'Johann Dirschl',
        copyright_holder_name: 'DIRSCHL.com GmbH',
        use_exif_creator_override: true,
        use_exif_copyright_override: true
      },
      mode: 'culoca'
    });
    expect(a.creatorName).toBe('Johann Dirschl'); // normalisiert gegen Profil-Vorname
    expect(a.copyrightHolderName).toBe('EXIF Only GmbH');
  });
});
