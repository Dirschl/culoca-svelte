export type EventDisplayMode = 'single_day' | 'multi_day';

export type EventSettings = {
  display_mode: EventDisplayMode;
  all_day: boolean;
  location_name: string;
  booking_url: string;
  is_free: boolean;
  price_text: string;
};

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  display_mode: 'single_day',
  all_day: false,
  location_name: '',
  booking_url: '',
  is_free: false,
  price_text: ''
};

export type EventLike = {
  id?: string | null;
  type_id?: number | null;
  title?: string | null;
  description?: string | null;
  caption?: string | null;
  slug?: string | null;
  created_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  group_slug?: string | null;
  canonical_path?: string | null;
  page_settings?: Record<string, unknown> | null;
  lat?: number | null;
  lon?: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function getEventSettings(pageSettings: Record<string, unknown> | null | undefined): EventSettings {
  if (!isRecord(pageSettings) || !isRecord(pageSettings.event)) {
    return { ...DEFAULT_EVENT_SETTINGS };
  }

  const event = pageSettings.event;
  return {
    display_mode: event.display_mode === 'multi_day' ? 'multi_day' : 'single_day',
    all_day: event.all_day === true,
    location_name: typeof event.location_name === 'string' ? event.location_name : '',
    booking_url: typeof event.booking_url === 'string' ? event.booking_url : '',
    is_free: event.is_free === true,
    price_text: typeof event.price_text === 'string' ? event.price_text : ''
  };
}

export function buildEventPageSettings(
  currentSettings: Record<string, unknown> | null | undefined,
  eventSettings: EventSettings,
  includeEventSettings: boolean
) {
  const nextSettings =
    currentSettings && isRecord(currentSettings)
      ? { ...currentSettings }
      : {};

  if (!includeEventSettings) {
    delete nextSettings.event;
    return nextSettings;
  }

  nextSettings.event = {
    display_mode: eventSettings.display_mode,
    all_day: eventSettings.all_day,
    location_name: eventSettings.location_name.trim(),
    booking_url: eventSettings.booking_url.trim(),
    is_free: eventSettings.is_free,
    price_text: eventSettings.price_text.trim()
  };

  return nextSettings;
}

export function isEventType(item: Pick<EventLike, 'type_id'> | null | undefined) {
  return item?.type_id === 2;
}

export function hasPersistentEventLandingPage(item: Pick<EventLike, 'type_id' | 'group_slug'> | null | undefined) {
  return isEventType(item) && !!item?.group_slug;
}

export function isPastEvent(item: Pick<EventLike, 'type_id' | 'ends_at' | 'group_slug'> | null | undefined) {
  if (!isEventType(item) || !item?.ends_at) return false;
  return new Date(item.ends_at).getTime() < Date.now();
}

export function isUpcomingOrCurrentEvent(item: Pick<EventLike, 'type_id' | 'ends_at'> | null | undefined) {
  if (!isEventType(item)) return false;
  if (!item?.ends_at) return true;
  return new Date(item.ends_at).getTime() >= Date.now();
}

export function hasEventGps(item: Pick<EventLike, 'lat' | 'lon'> | null | undefined) {
  return typeof item?.lat === 'number' && typeof item?.lon === 'number';
}

export function compareEventStartsAscending(a: Pick<EventLike, 'starts_at' | 'created_at'>, b: Pick<EventLike, 'starts_at' | 'created_at'>) {
  const aTime = a.starts_at ? new Date(a.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.starts_at ? new Date(b.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  const aCreated = 'created_at' in a && a.created_at ? new Date(a.created_at).getTime() : 0;
  const bCreated = 'created_at' in b && b.created_at ? new Date(b.created_at).getTime() : 0;
  return aCreated - bCreated;
}

export function compareEventEndsDescending(a: Pick<EventLike, 'ends_at' | 'starts_at' | 'created_at'>, b: Pick<EventLike, 'ends_at' | 'starts_at' | 'created_at'>) {
  const aTime = a.ends_at ? new Date(a.ends_at).getTime() : (a.starts_at ? new Date(a.starts_at).getTime() : 0);
  const bTime = b.ends_at ? new Date(b.ends_at).getTime() : (b.starts_at ? new Date(b.starts_at).getTime() : 0);
  if (aTime !== bTime) return bTime - aTime;
  const aCreated = 'created_at' in a && a.created_at ? new Date(a.created_at).getTime() : 0;
  const bCreated = 'created_at' in b && b.created_at ? new Date(b.created_at).getTime() : 0;
  return bCreated - aCreated;
}

export function formatEventSchedule(item: Pick<EventLike, 'starts_at' | 'ends_at'>, settings: EventSettings) {
  if (!item.starts_at && !item.ends_at) return '';

  const dateOnly = (value: string) =>
    new Date(value).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

  const timeOnly = (value: string) =>
    new Date(value).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });

  if (settings.all_day && item.starts_at && item.ends_at) {
    if (settings.display_mode === 'multi_day') {
      return `${dateOnly(item.starts_at)} bis ${dateOnly(item.ends_at)} ganztägig`;
    }
    return `${dateOnly(item.starts_at)} ganztägig`;
  }

  if (item.starts_at && item.ends_at) {
    if (settings.display_mode === 'multi_day') {
      return `${dateOnly(item.starts_at)} ${settings.all_day ? '' : timeOnly(item.starts_at)} bis ${dateOnly(item.ends_at)} ${settings.all_day ? '' : timeOnly(item.ends_at)}`.trim();
    }

    if (dateOnly(item.starts_at) === dateOnly(item.ends_at)) {
      return `${dateOnly(item.starts_at)} ${timeOnly(item.starts_at)} bis ${timeOnly(item.ends_at)}`;
    }

    return `${dateOnly(item.starts_at)} ${timeOnly(item.starts_at)} bis ${dateOnly(item.ends_at)} ${timeOnly(item.ends_at)}`;
  }

  if (item.starts_at) {
    return settings.all_day ? `${dateOnly(item.starts_at)} ganztägig` : `${dateOnly(item.starts_at)} ${timeOnly(item.starts_at)}`;
  }

  return item.ends_at ? `Bis ${dateOnly(item.ends_at)}` : '';
}

function formatIcsDate(value: string, allDay: boolean) {
  const date = new Date(value);
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }

  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function createEventIcs(item: EventLike, settings: EventSettings) {
  if (!item.starts_at) return null;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Culoca//Events//DE',
    'BEGIN:VEVENT',
    `UID:${item.id || item.slug || Date.now()}@culoca.com`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString(), false)}`
  ];

  if (settings.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(item.starts_at, true)}`);
    if (item.ends_at) {
      const end = new Date(item.ends_at);
      end.setDate(end.getDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
  } else {
    lines.push(`DTSTART:${formatIcsDate(item.starts_at, false)}`);
    if (item.ends_at) {
      lines.push(`DTEND:${formatIcsDate(item.ends_at, false)}`);
    }
  }

  if (item.title) lines.push(`SUMMARY:${item.title.replace(/\n/g, ' ')}`);
  if (item.description || item.caption) {
    lines.push(`DESCRIPTION:${(item.description || item.caption || '').replace(/\n/g, '\\n')}`);
  }
  if (settings.location_name) lines.push(`LOCATION:${settings.location_name.replace(/\n/g, ' ')}`);
  if (settings.booking_url) lines.push(`URL:${settings.booking_url}`);

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
