// Item type constants for the application
// These correspond to the types table in the database

export const ITEM_TYPES = {
  PHOTO: 1,
  EVENT: 2,
  LINK: 3,
  TEXT: 4,
  COMPANY: 5,
  VIDEO: 6
} as const;

export const ITEM_TYPE_LABELS = {
  [ITEM_TYPES.PHOTO]: 'Foto',
  [ITEM_TYPES.EVENT]: 'Event',
  [ITEM_TYPES.LINK]: 'Link',
  [ITEM_TYPES.TEXT]: 'Text',
  [ITEM_TYPES.COMPANY]: 'Firma',
  [ITEM_TYPES.VIDEO]: 'Video'
} as const;

export const ITEM_TYPE_DESCRIPTIONS = {
  [ITEM_TYPES.PHOTO]: 'Fotografien und Bilder',
  [ITEM_TYPES.EVENT]: 'Veranstaltungen und Events',
  [ITEM_TYPES.LINK]: 'Externe Links und Verweise',
  [ITEM_TYPES.TEXT]: 'Textbeiträge und Artikel',
  [ITEM_TYPES.COMPANY]: 'Firmen- und Unternehmensinformationen',
  [ITEM_TYPES.VIDEO]: 'Videomaterial und Filme'
} as const;

// Helper function to get type label by ID
export function getTypeLabel(typeId: number): string {
  return ITEM_TYPE_LABELS[typeId as keyof typeof ITEM_TYPE_LABELS] || 'Unbekannt';
}

// Helper function to get type description by ID
export function getTypeDescription(typeId: number): string {
  return ITEM_TYPE_DESCRIPTIONS[typeId as keyof typeof ITEM_TYPE_DESCRIPTIONS] || '';
}

// Get all available types as array for dropdowns
export function getAvailableTypes() {
  return Object.entries(ITEM_TYPE_LABELS).map(([id, label]) => ({
    id: parseInt(id),
    label,
    description: ITEM_TYPE_DESCRIPTIONS[parseInt(id) as keyof typeof ITEM_TYPE_DESCRIPTIONS]
  }));
} 