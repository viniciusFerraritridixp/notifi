-- Habilitar extensão HTTP no Supabase
-- Execute este comando no SQL Editor do Supabase

-- 1. Habilitar a extensão http
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA net;

-- 2. Conceder permissões necessárias
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- 3. Verificar se a extensão foi instalada
SELECT * FROM pg_extension WHERE extname = 'http';