import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { NewsFlashImage } from '$lib/types';

export const items = writable<NewsFlashImage[]>([]);

export async function loadAllItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .limit(10000);
  if (!error && data) items.set(data as NewsFlashImage[]);
  else console.error('Fehler beim Laden der Items:', error);
} 