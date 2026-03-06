BEGIN;

ALTER TABLE public.types
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS show_image boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_gallery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_audio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_map boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_nearby_gallery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_content_html boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_external_link boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_date_range boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_video_embed boolean NOT NULL DEFAULT false;

UPDATE public.types
SET slug = CASE id
  WHEN 1 THEN 'foto'
  WHEN 2 THEN 'event'
  WHEN 3 THEN 'link'
  WHEN 4 THEN 'text'
  WHEN 5 THEN 'firma'
  WHEN 6 THEN 'video'
  WHEN 7 THEN 'musik'
  WHEN 8 THEN 'ki-bild'
  ELSE slug
END
WHERE slug IS NULL;

INSERT INTO public.types (
  id, name, slug, description, show_image, show_gallery, show_audio, show_map,
  show_nearby_gallery, show_content_html, show_external_link, show_date_range, show_video_embed
)
VALUES
  (1, 'Foto', 'foto', 'Fotografien und Bilder', true, true, false, true, true, true, false, false, false),
  (2, 'Event', 'event', 'Veranstaltungen und Events', true, true, false, true, false, true, false, true, false),
  (3, 'Link', 'link', 'Externe Links und Verweise', true, false, false, false, false, false, true, true, false),
  (4, 'Text', 'text', 'Textbeitraege und Artikel', true, false, false, true, false, true, false, false, false),
  (5, 'Firma', 'firma', 'Firmen- und Unternehmensinformationen', true, false, false, false, false, true, true, false, false),
  (6, 'Video', 'video', 'Videomaterial und Filme', true, false, false, false, false, true, false, false, true),
  (7, 'Musik', 'musik', 'Musik- und Audioinhalte', true, false, true, false, false, true, false, false, false),
  (8, 'KI-Bild', 'ki-bild', 'KI-generierte Bilder', true, true, false, false, false, true, false, false, false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  show_image = EXCLUDED.show_image,
  show_gallery = EXCLUDED.show_gallery,
  show_audio = EXCLUDED.show_audio,
  show_map = EXCLUDED.show_map,
  show_nearby_gallery = EXCLUDED.show_nearby_gallery,
  show_content_html = EXCLUDED.show_content_html,
  show_external_link = EXCLUDED.show_external_link,
  show_date_range = EXCLUDED.show_date_range,
  show_video_embed = EXCLUDED.show_video_embed,
  updated_at = now();

ALTER TABLE public.types
  ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'types_slug_key'
  ) THEN
    CREATE UNIQUE INDEX types_slug_key ON public.types (slug);
  END IF;
END $$;

COMMIT;
