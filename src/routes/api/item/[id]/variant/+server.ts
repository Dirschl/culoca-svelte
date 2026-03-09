import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

type ItemRow = {
  id: string;
  title: string | null;
  user_id: string | null;
  profile_id: string | null;
  group_root_item_id: string | null;
};

function createAuthClient(token: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase auth configuration');
  }

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

function createServerClient() {
  const supabaseUrl =
    process.env.PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase server configuration');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}

async function requireUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Nicht angemeldet' }, { status: 401 }) };
  }

  const token = authHeader.slice(7);
  const authClient = createAuthClient(token);
  const {
    data: { user },
    error
  } = await authClient.auth.getUser();

  if (error || !user) {
    return { error: json({ error: 'Nicht angemeldet' }, { status: 401 }) };
  }

  return { user };
}

async function canEditItem(serverClient: ReturnType<typeof createServerClient>, itemId: string, userId: string) {
  const { data, error } = await serverClient.rpc('get_unified_item_rights', {
    p_item_id: itemId,
    p_user_id: userId
  });

  if (error) {
    throw new Error(error.message);
  }

  return !!data?.edit;
}

async function loadItem(serverClient: ReturnType<typeof createServerClient>, itemId: string) {
  const { data, error } = await serverClient
    .from('items')
    .select('id, title, user_id, profile_id, group_root_item_id')
    .eq('id', itemId)
    .maybeSingle<ItemRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function loadChildIds(serverClient: ReturnType<typeof createServerClient>, itemId: string) {
  const { data, error } = await serverClient
    .from('items')
    .select('id')
    .eq('group_root_item_id', itemId);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((item) => item.id);
}

export async function PATCH({ params, request }: any) {
  const auth = await requireUser(request);
  if ('error' in auth) return auth.error;

  const { id } = params;
  if (!id) {
    return json({ error: 'Fehlende Item-ID' }, { status: 400 });
  }

  let body: {
    action?: 'assign' | 'detach';
    targetRootId?: string | null;
    confirmReparent?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungueltiges JSON' }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return json({ error: 'Fehlende Aktion' }, { status: 400 });
  }

  const serverClient = createServerClient();
  const sourceItem = await loadItem(serverClient, id);

  if (!sourceItem) {
    return json({ error: 'Item nicht gefunden' }, { status: 404 });
  }

  if (!(await canEditItem(serverClient, sourceItem.id, auth.user.id))) {
    return json({ error: 'Keine Berechtigung fuer dieses Item' }, { status: 403 });
  }

  if (action === 'detach') {
    const { data, error } = await serverClient
      .from('items')
      .update({ group_root_item_id: null })
      .eq('id', sourceItem.id)
      .select('id, group_root_item_id')
      .single();

    if (error) {
      return json({ error: error.message }, { status: 500 });
    }

    return json({
      success: true,
      action: 'detach',
      item: data
    });
  }

  const targetRootId = body.targetRootId;
  if (!targetRootId) {
    return json({ error: 'Fehlendes Ziel-Root' }, { status: 400 });
  }

  if (targetRootId === sourceItem.id) {
    return json({ error: 'Item kann nicht sich selbst zugeordnet werden' }, { status: 409 });
  }

  const targetRoot = await loadItem(serverClient, targetRootId);
  if (!targetRoot) {
    return json({ error: 'Ziel-Item nicht gefunden' }, { status: 404 });
  }

  if (targetRoot.group_root_item_id) {
    return json(
      {
        error: 'Ziel-Item ist kein Haupt-Item',
        code: 'target_not_root'
      },
      { status: 409 }
    );
  }

  if (!(await canEditItem(serverClient, targetRoot.id, auth.user.id))) {
    return json({ error: 'Keine Berechtigung fuer das Ziel-Item' }, { status: 403 });
  }

  const sourceChildIds = await loadChildIds(serverClient, sourceItem.id);
  const requiresReparent = sourceChildIds.length > 0;

  if (requiresReparent && !body.confirmReparent) {
    return json(
      {
        error:
          'Dieses Item hat Unter-Items. Wollen sie eine neue Hauptvariante festlegen? Dabei werden das Eltern-Item und alle ihm festgelegten Kind-Items zu einem neuen Elternelement',
        code: 'requires_reparent_confirmation',
        childCount: sourceChildIds.length
      },
      { status: 409 }
    );
  }

  if (requiresReparent) {
    for (const childId of sourceChildIds) {
      if (!(await canEditItem(serverClient, childId, auth.user.id))) {
        return json(
          { error: 'Keine Berechtigung fuer alle betroffenen Kind-Items' },
          { status: 403 }
        );
      }
    }

    const { error: moveChildrenError } = await serverClient
      .from('items')
      .update({ group_root_item_id: targetRoot.id })
      .in('id', sourceChildIds);

    if (moveChildrenError) {
      return json({ error: moveChildrenError.message }, { status: 500 });
    }
  }

  const { data, error } = await serverClient
    .from('items')
    .update({ group_root_item_id: targetRoot.id })
    .eq('id', sourceItem.id)
    .select('id, group_root_item_id')
    .single();

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  return json({
    success: true,
    action: 'assign',
    item: data,
    targetRootId: targetRoot.id,
    reparentedChildren: sourceChildIds
  });
}
