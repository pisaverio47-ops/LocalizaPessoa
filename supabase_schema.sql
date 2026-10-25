-- ==============================================================================
-- SISTEMA DE GEOLOCALIZAÇÃO EM TEMPO REAL (ESTILO LIFE360) COM FAMÍLIAS E CÓDIGOS
-- Script SQL para executar no Supabase: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Habilitar a extensão pgcrypto para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tabela de Famílias / Círculos
CREATE TABLE IF NOT EXISTS public.circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Membros de cada Família (Permite que um usuário pertença a várias famílias)
CREATE TABLE IF NOT EXISTS public.circle_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_code TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#0091ff',
    role TEXT DEFAULT 'member', -- 'admin', 'member'
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_circle_member UNIQUE (circle_code, user_id)
);

-- 4. Tabela de Localizações em Tempo Real dos Usuários
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
    altitude REAL DEFAULT NULL,
    battery_level INTEGER DEFAULT 100,
    is_charging BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'moving', -- 'moving', 'idle', 'stopped', 'sos'
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_per_circle UNIQUE (circle_code, user_id)
);

-- Garantir coluna altitude
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS altitude REAL DEFAULT NULL;

-- 5. Tabela de Histórico de Trajetos (Breadcrumbs)
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

-- 6. Tabela de Lugares Seguros (Geofencing: Casa, Trabalho, Escola)
CREATE TABLE IF NOT EXISTS public.places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_code TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'home',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER DEFAULT 150,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Tabela de Alertas e Notificações (Entrou em Casa, Saiu, Bateria Fraca, SOS)
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

-- 8. Índices de busca rápida
CREATE INDEX IF NOT EXISTS idx_circles_code ON public.circles(code);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON public.circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON public.circle_members(circle_code);
CREATE INDEX IF NOT EXISTS idx_locations_circle ON public.locations(circle_code);
CREATE INDEX IF NOT EXISTS idx_history_circle_user ON public.location_history(circle_code, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_places_circle ON public.places(circle_code);
CREATE INDEX IF NOT EXISTS idx_alerts_circle ON public.alerts(circle_code, created_at DESC);

-- 9. Políticas de Segurança (Row Level Security - RLS)
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso publico circles" ON public.circles;
DROP POLICY IF EXISTS "Acesso publico circle_members" ON public.circle_members;
DROP POLICY IF EXISTS "Acesso publico locations" ON public.locations;
DROP POLICY IF EXISTS "Acesso publico location_history" ON public.location_history;
DROP POLICY IF EXISTS "Acesso publico places" ON public.places;
DROP POLICY IF EXISTS "Acesso publico alerts" ON public.alerts;

CREATE POLICY "Acesso publico circles" ON public.circles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico circle_members" ON public.circle_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico locations" ON public.locations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico location_history" ON public.location_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico places" ON public.places FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico alerts" ON public.alerts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 10. HABILITAR TRANSMISSÃO EM TEMPO REAL (SUPABASE REALTIME WEBSOCKETS)
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.places;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;

-- 11. Criar família padrão inicial
INSERT INTO public.circles (code, name) 
VALUES ('FAMILIA-01', 'Meu Primeiro Círculo')
ON CONFLICT (code) DO NOTHING;
