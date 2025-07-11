-- Create table for welcome section content
CREATE TABLE IF NOT EXISTS public.welcome_content (
    id SERIAL PRIMARY KEY,
    section_key VARCHAR(50) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insert default content
INSERT INTO public.welcome_content (section_key, title, content) VALUES
('greeting', 'Hallo {userName}! 👋', 'Willkommen bei <strong>Culoca</strong> – deiner GPS-basierten Foto-Community!<br><br>Du nutzt die <span class="beta-badge">Beta-Version</span>. Wir haben viele Ideen, lass dich überraschen! 🚀'),
('gps_feature', 'GPS zeigt dir was du willst', 'Entdecke <strong>Fotos genau dort</strong>, wo du gerade bist oder hinfahren möchtest.<br><br>Deine Kamera kennt bereits jeden Ort – wir machen ihn für andere sichtbar.'),
('discover', 'Entdecke deine Region', 'Sieh deine Umgebung mit <strong>neuen Augen</strong>. Versteckte Schätze, bekannte Orte, unentdeckte Perspektiven.<br><br>Teile deine schönsten Momente und inspiriere andere Fotografen.')
ON CONFLICT (section_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.welcome_content ENABLE ROW LEVEL SECURITY;

-- Policy for reading (everyone can read active content)
CREATE POLICY "Everyone can read active welcome content" ON public.welcome_content
FOR SELECT USING (is_active = true);

-- Policy for updating (only specific user)
CREATE POLICY "Creator can update welcome content" ON public.welcome_content
FOR UPDATE USING (auth.uid()::text = '0ceb2320-0553-463b-971a-a0eef5ecdf09');

-- Policy for inserting (only specific user)
CREATE POLICY "Creator can insert welcome content" ON public.welcome_content
FOR INSERT WITH CHECK (auth.uid()::text = '0ceb2320-0553-463b-971a-a0eef5ecdf09');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_welcome_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_welcome_content_updated_at_trigger
    BEFORE UPDATE ON public.welcome_content
    FOR EACH ROW
    EXECUTE FUNCTION public.update_welcome_content_updated_at(); 