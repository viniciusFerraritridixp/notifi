-- Script para aplicar a migração 003_create_device_system.sql manualmente
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Criar tabela para registros de dispositivos (device tokens)
CREATE TABLE IF NOT EXISTS device_registrations (
  id SERIAL PRIMARY KEY,
  device_token TEXT UNIQUE NOT NULL,
  user_agent TEXT,
  platform TEXT,
  is_ios BOOLEAN DEFAULT false,
  is_mobile BOOLEAN DEFAULT false,
  language TEXT,
  timezone TEXT,
  screen_resolution TEXT,
  strategies JSONB,
  web_push_endpoint TEXT,
  web_push_p256dh TEXT,
  web_push_auth TEXT,
  registration_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Criar tabela para notificações pendentes
CREATE TABLE IF NOT EXISTS pending_notifications (
  id SERIAL PRIMARY KEY,
  device_token TEXT NOT NULL,
  notification_data JSONB NOT NULL,
  delivery_method TEXT NOT NULL,
  delivered BOOLEAN DEFAULT false,
  delivery_attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_device_registrations_token ON device_registrations(device_token);
CREATE INDEX IF NOT EXISTS idx_device_registrations_active ON device_registrations(is_active);
CREATE INDEX IF NOT EXISTS idx_device_registrations_ios ON device_registrations(is_ios);
CREATE INDEX IF NOT EXISTS idx_device_registrations_last_seen ON device_registrations(last_seen);

CREATE INDEX IF NOT EXISTS idx_pending_notifications_device ON pending_notifications(device_token);
CREATE INDEX IF NOT EXISTS idx_pending_notifications_delivered ON pending_notifications(delivered);
CREATE INDEX IF NOT EXISTS idx_pending_notifications_created ON pending_notifications(created_at);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas para permitir acesso (ajustar conforme necessário)
DROP POLICY IF EXISTS "Permitir acesso total a device_registrations" ON device_registrations;
CREATE POLICY "Permitir acesso total a device_registrations" ON device_registrations
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir acesso total a pending_notifications" ON pending_notifications;
CREATE POLICY "Permitir acesso total a pending_notifications" ON pending_notifications
  FOR ALL USING (true);

-- 6. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Criar trigger para atualizar updated_at em device_registrations
DROP TRIGGER IF EXISTS update_device_registrations_updated_at ON device_registrations;
CREATE TRIGGER update_device_registrations_updated_at
  BEFORE UPDATE ON device_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Adicionar comentários para documentação
COMMENT ON TABLE device_registrations IS 'Registros de dispositivos para notificações híbridas';
COMMENT ON TABLE pending_notifications IS 'Notificações pendentes para entrega';

COMMENT ON COLUMN device_registrations.device_token IS 'Token único gerado pelo dispositivo';
COMMENT ON COLUMN device_registrations.strategies IS 'Array das estratégias de notificação suportadas';
COMMENT ON COLUMN device_registrations.web_push_endpoint IS 'Endpoint para Web Push (se disponível)';
COMMENT ON COLUMN device_registrations.is_ios IS 'Indica se é um dispositivo iOS';
COMMENT ON COLUMN device_registrations.last_seen IS 'Última vez que o dispositivo foi visto online';

COMMENT ON COLUMN pending_notifications.delivery_method IS 'Método de entrega: web_push, ios_fallback, fallback, etc.';
COMMENT ON COLUMN pending_notifications.delivery_attempts IS 'Número de tentativas de entrega';

-- Verificar se as tabelas foram criadas
SELECT 'device_registrations criada' as status WHERE EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'device_registrations'
);

SELECT 'pending_notifications criada' as status WHERE EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'pending_notifications'
);

-- Mostrar estrutura das tabelas criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'device_registrations' 
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pending_notifications' 
ORDER BY ordinal_position;