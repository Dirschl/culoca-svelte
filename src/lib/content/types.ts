export type ContentTypeDefinition = {
  id: number;
  name: string;
  slug: string;
  description: string;
  show_image: boolean;
  show_gallery: boolean;
  show_audio: boolean;
  show_map: boolean;
  show_nearby_gallery: boolean;
  show_content_html: boolean;
  show_external_link: boolean;
  show_date_range: boolean;
  show_video_embed: boolean;
};

export const DEFAULT_CONTENT_TYPES: ContentTypeDefinition[] = [
  {
    id: 1,
    name: 'Foto',
    slug: 'foto',
    description: 'Fotografien und Bilder',
    show_image: true,
    show_gallery: true,
    show_audio: false,
    show_map: true,
    show_nearby_gallery: true,
    show_content_html: true,
    show_external_link: false,
    show_date_range: false,
    show_video_embed: false
  },
  {
    id: 2,
    name: 'Event',
    slug: 'event',
    description: 'Veranstaltungen und Events',
    show_image: true,
    show_gallery: true,
    show_audio: false,
    show_map: true,
    show_nearby_gallery: false,
    show_content_html: true,
    show_external_link: false,
    show_date_range: true,
    show_video_embed: false
  },
  {
    id: 3,
    name: 'Link',
    slug: 'link',
    description: 'Externe Links und Verweise',
    show_image: true,
    show_gallery: false,
    show_audio: false,
    show_map: false,
    show_nearby_gallery: false,
    show_content_html: false,
    show_external_link: true,
    show_date_range: true,
    show_video_embed: false
  },
  {
    id: 4,
    name: 'Text',
    slug: 'text',
    description: 'Textbeitraege und Artikel',
    show_image: true,
    show_gallery: false,
    show_audio: false,
    show_map: true,
    show_nearby_gallery: false,
    show_content_html: true,
    show_external_link: false,
    show_date_range: false,
    show_video_embed: false
  },
  {
    id: 5,
    name: 'Firma',
    slug: 'firma',
    description: 'Firmen- und Unternehmensinformationen',
    show_image: true,
    show_gallery: false,
    show_audio: false,
    show_map: false,
    show_nearby_gallery: false,
    show_content_html: true,
    show_external_link: true,
    show_date_range: false,
    show_video_embed: false
  },
  {
    id: 6,
    name: 'Video',
    slug: 'video',
    description: 'Videomaterial und Filme',
    show_image: true,
    show_gallery: false,
    show_audio: false,
    show_map: false,
    show_nearby_gallery: false,
    show_content_html: true,
    show_external_link: false,
    show_date_range: false,
    show_video_embed: true
  },
  {
    id: 7,
    name: 'Musik',
    slug: 'musik',
    description: 'Musik- und Audioinhalte',
    show_image: true,
    show_gallery: false,
    show_audio: true,
    show_map: false,
    show_nearby_gallery: false,
    show_content_html: true,
    show_external_link: false,
    show_date_range: false,
    show_video_embed: false
  },
  {
    id: 8,
    name: 'KI-Bild',
    slug: 'ki-bild',
    description: 'KI-generierte Bilder',
    show_image: true,
    show_gallery: true,
    show_audio: false,
    show_map: false,
    show_nearby_gallery: false,
    show_content_html: true,
    show_external_link: false,
    show_date_range: false,
    show_video_embed: false
  }
];

export const DEFAULT_CONTENT_TYPE_BY_ID = new Map(
  DEFAULT_CONTENT_TYPES.map((type) => [type.id, type])
);

export const DEFAULT_CONTENT_TYPE_BY_SLUG = new Map(
  DEFAULT_CONTENT_TYPES.map((type) => [type.slug, type])
);

export const VALID_CONTENT_TYPE_SLUGS = DEFAULT_CONTENT_TYPES.map((type) => type.slug);
