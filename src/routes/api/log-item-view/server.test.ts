import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock
}));

describe('/api/log-item-view POST', () => {
  function createSupabaseMock() {
    const itemEventsInsertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    return {
      from: vi.fn((tableName: string) => {
        if (tableName === 'items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { profile_id: 'owner-1', user_id: 'owner-1' },
                  error: null
                })
              }))
            }))
          };
        }

        if (tableName === 'item_events') {
          return {
            insert: itemEventsInsertMock
          };
        }

        if (tableName === 'item_views') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'fallback-view' },
                  error: null
                })
              }))
            }))
          };
        }

        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          select: vi.fn()
        };
      }),
      rpc: vi.fn((fnName: string) => {
        if (fnName === 'log_item_view') {
          return Promise.resolve({ data: { id: 'view-1' }, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      })
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('logs a matching item_event after a successful item view', async () => {
    const supabaseMock = createSupabaseMock();
    createClientMock.mockReturnValue(supabaseMock);
    const itemEventsInsertMock = supabaseMock.from('item_events').insert;

    const { POST } = await import('./+server');
    const response = await POST({
      request: new Request('http://localhost/api/log-item-view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: 'http://localhost/item/test'
        },
        body: JSON.stringify({
          itemId: 'item-1',
          visitorId: 'user-1',
          visitorLat: 48.123,
          visitorLon: 12.456,
          userAgent: 'Vitest Browser'
        })
      }),
      getClientAddress: () => '127.0.0.1'
    } as any);

    expect(response.status).toBe(200);
    expect(itemEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: 'item-1',
        actor_user_id: 'user-1',
        owner_user_id: 'owner-1',
        event_type: 'item_view',
        source: 'authenticated',
        metadata: expect.objectContaining({
          referer: 'http://localhost/item/test',
          user_agent: 'Vitest Browser',
          has_gps: true,
          visitor_lat: 48.123,
          visitor_lon: 12.456
        })
      })
    );
  });
});
