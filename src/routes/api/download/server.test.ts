import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();
const buildDownloadFilenameMock = vi.fn();
const canBypassImageProcessingMock = vi.fn();
const fetchOriginalItemBufferMock = vi.fn();
const normalizeDownloadExportOptionsMock = vi.fn();
const renderDownloadExportMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock
}));

vi.mock('$lib/server/downloadExport', () => ({
  buildDownloadFilename: buildDownloadFilenameMock,
  canBypassImageProcessing: canBypassImageProcessingMock,
  fetchOriginalItemBuffer: fetchOriginalItemBufferMock,
  normalizeDownloadExportOptions: normalizeDownloadExportOptionsMock,
  renderDownloadExport: renderDownloadExportMock
}));

describe('/api/download/[id] POST', () => {
  const itemRecord = {
    id: '28fe6820-16af-4cda-90dc-a36243acea7d',
    profile_id: 'owner-1',
    user_id: 'owner-1',
    short_id: 'abc123def4',
    width: 4032,
    height: 3024,
    original_url: 'https://example.com/original.jpg',
    path_2048: 'foo/bar-2048.jpg',
    path_512: 'foo/bar-512.jpg',
    original_name: 'abendlicht.jpg',
    title: 'Abendlicht am Weiher',
    caption: 'Ein stiller Moment im Abendlicht.',
    description: 'Ein stiller Moment im Abendlicht.',
    keywords: ['abend', 'weiher'],
    exif_data: null,
    lat: 48.123,
    lon: 12.456,
    profile: {
      full_name: 'Test Creator',
      accountname: 'creator'
    }
  };

  function createSupabaseMock() {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'owner-1' } },
          error: null
        })
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: itemRecord,
              error: null
            })
          }))
        }))
      })),
      rpc: vi.fn((fnName: string) => {
        if (fnName === 'get_unified_item_rights') {
          return Promise.resolve({
            data: { download: true, download_original: true },
            error: null
          });
        }

        if (fnName === 'log_item_download') {
          return Promise.resolve({ data: null, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      })
    };
  }

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    createClientMock.mockReturnValue(createSupabaseMock());
    fetchOriginalItemBufferMock.mockResolvedValue(Buffer.from('original-jpg'));
  });

  it('returns an estimate payload for custom open graph exports', async () => {
    const options = {
      sizeMode: 'custom',
      width: 1200,
      height: 630,
      cropEnabled: true,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      format: 'jpg',
      metadataMode: 'culoca',
      filenameMode: 'web'
    };

    normalizeDownloadExportOptionsMock.mockReturnValue(options);
    canBypassImageProcessingMock.mockReturnValue(false);
    buildDownloadFilenameMock.mockReturnValue('abendlicht-am-weiher-culoca-abc123def4.jpg');
    renderDownloadExportMock.mockResolvedValue({
      info: { size: 123456 },
      outputWidth: 1200,
      outputHeight: 630,
      contentType: 'image/jpeg',
      filename: 'abendlicht-am-weiher-culoca-abc123def4.jpg',
      buffer: Buffer.from('rendered')
    });

    const { POST } = await import('./[id]/+server');
    const response = await POST({
      params: { id: itemRecord.id },
      request: new Request('http://localhost/api/download/' + itemRecord.id, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'estimate',
          options
        })
      })
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      sizeBytes: 123456,
      width: 1200,
      height: 630,
      filename: 'abendlicht-am-weiher-culoca-abc123def4.jpg',
      contentType: 'image/jpeg'
    });
  });

  it('returns the user-facing sharp fallback error for unavailable export variants', async () => {
    const options = {
      sizeMode: 'custom',
      width: 1200,
      height: 630,
      cropEnabled: true,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      format: 'jpg',
      metadataMode: 'culoca',
      filenameMode: 'web'
    };

    normalizeDownloadExportOptionsMock.mockReturnValue(options);
    canBypassImageProcessingMock.mockReturnValue(false);
    renderDownloadExportMock.mockRejectedValue(new Error('sharp failed during render'));

    const { POST } = await import('./[id]/+server');
    const response = await POST({
      params: { id: itemRecord.id },
      request: new Request('http://localhost/api/download/' + itemRecord.id, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'download',
          options
        })
      })
    } as any);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Die gewaehlte Exportvariante ist gerade nicht verfuegbar. Bitte versuche JPG in voller Aufloesung oder Original-Metadaten.'
    });
  });
});
