-- ==============================================================================
-- SISTEMA DE GEOLOCALIZAÇÃO EM TEMPO REAL (ESTILO LIFE360)
-- Script SQL para executar no Supabase: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Habilitar a extensão pgcrypto para geração de UUIDs (geralmente ativa por padrão)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tabela de Círculos / Grupos de Família
CREATE TABLE IF NOT EXISTS public.circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Localizações em Tempo Real dos Usuários
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_code TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#0091ff',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy REAL DEFAULT 0,
    speed REAL DEFAULT 0,
    heading REAL DEFAULT 0,
    battery_level INTEGER DEFAULT 100,
    is_charging BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'moving', -- 'moving', 'idle', 'stopped', 'sos'
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_per_circle UNIQUE (circle_code, user_id)
);

-- 4. Tabela de Histórico de Trajetos (Para consultar onde o usuário esteve)
CREATE TABLE IF NOT EXISTS public.location_history (
    id BIGSERIAL PRIMARY KEY,
    circle_code TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed REAL DEFAULT 0,
    battery_level INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela de Lugares Seguros (Geofencing: Casa, Trabalho, Escola)
CREATE TABLE IF NOT EXISTS public.places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_code TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'home', -- 'home', 'school', 'work', 'gym'
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER DEFAULT 150,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabela de Alertas e Notificações (Entrou em Casa, Saiu, Bateria Fraca, SOS)
CREATE TABLE IF NOT EXISTS public.alerts (
    id BIGSERIAL PRIMARY KEY,
    circle_code TEXT NOT NULL,
    user_name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'sos', 'geofence_enter', 'geofence_exit', 'low_battery'
    message TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Criar índices para busca ultra rápida
CREATE INDEX IF NOT EXISTS idx_locations_circle ON public.locations(circle_code);
CREATE INDEX IF NOT EXISTS idx_history_circle_user ON public.location_history(circle_code, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_places_circle ON public.places(circle_code);
CREATE INDEX IF NOT EXISTS idx_alerts_circle ON public.alerts(circle_code, created_at DESC);

-- 8. Configurar Políticas de Segurança (Row Level Security - RLS)
-- Permite leitura e escrita anônima usando a chave pública do Supabase (para círculos abertos via código)
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para a chave anônima (anon) operar por código de círculo
CREATE POLICY "Acesso publico circles" ON public.circles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico locations" ON public.locations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico location_history" ON public.location_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico places" ON public.places FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico alerts" ON public.alerts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. HABILITAR TRANSMISSÃO EM TEMPO REAL (SUPABASE REALTIME)
-- Permite que o mapa receba atualizações instantâneas de novos dados sem precisar recarregar a página
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.places;

-- 10. Criar um círculo padrão para teste imediato
INSERT INTO public.circles (code, name) 
VALUES ('FAMILIA-01', 'Meu Primeiro Círculo')
ON CONFLICT (code) DO NOTHING;
