-- Atualização para suporte ao Firebase Cloud Messaging
-- Adicionar coluna para token FCM na tabela de registros de dispositivos

ALTER TABLE device_registrations 
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Adicionar coluna para mensagem de erro nas notificações pendentes
ALTER TABLE pending_notifications 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Índice para o token FCM
CREATE INDEX IF NOT EXISTS idx_device_registrations_fcm_token 
ON device_registrations(fcm_token);

-- Função para incrementar tentativas de entrega
CREATE OR REPLACE FUNCTION increment_delivery_attempts(
  notification_id INTEGER,
  error_msg TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE pending_notifications 
  SET 
    delivery_attempts = delivery_attempts + 1,
    last_attempt = now(),
    error_message = error_msg
  WHERE id = notification_id;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar notificações pendentes com dispositivos ativos
CREATE OR REPLACE FUNCTION get_pending_notifications_with_fcm(
  batch_size INTEGER DEFAULT 10,
  max_attempts INTEGER DEFAULT 3
)
RETURNS TABLE(
  notification_id INTEGER,
  device_token TEXT,
  fcm_token TEXT,
  notification_data JSONB,
  delivery_method TEXT,
  delivery_attempts INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  platform TEXT,
  is_ios BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pn.id as notification_id,
    pn.device_token,
    dr.fcm_token,
    pn.notification_data,
    pn.delivery_method,
    pn.delivery_attempts,
    pn.created_at,
    dr.platform,
    dr.is_ios
  FROM pending_notifications pn
  INNER JOIN device_registrations dr ON pn.device_token = dr.device_token
  WHERE 
    pn.delivered = false 
    AND pn.delivery_attempts < max_attempts
    AND dr.is_active = true
    AND dr.fcm_token IS NOT NULL
  ORDER BY pn.created_at ASC
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

-- Função para estatísticas de notificações
CREATE OR REPLACE FUNCTION get_notification_stats()
RETURNS TABLE(
  total_pending INTEGER,
  total_delivered INTEGER,
  total_failed INTEGER,
  devices_with_fcm INTEGER,
  devices_without_fcm INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM pending_notifications WHERE delivered = false) as total_pending,
    (SELECT COUNT(*)::INTEGER FROM pending_notifications WHERE delivered = true) as total_delivered,
    (SELECT COUNT(*)::INTEGER FROM pending_notifications WHERE delivered = false AND delivery_attempts >= 3) as total_failed,
    (SELECT COUNT(*)::INTEGER FROM device_registrations WHERE is_active = true AND fcm_token IS NOT NULL) as devices_with_fcm,
    (SELECT COUNT(*)::INTEGER FROM device_registrations WHERE is_active = true AND fcm_token IS NULL) as devices_without_fcm;
END;
$$ LANGUAGE plpgsql;

-- Trigger para logging de mudanças importantes
CREATE OR REPLACE FUNCTION log_notification_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Log quando uma notificação é marcada como entregue
  IF OLD.delivered = false AND NEW.delivered = true THEN
    -- Inserir no formato atual da tabela notification_logs: usar 'tipo' e 'payload' JSON
    INSERT INTO notification_logs (
      tipo,
      payload,
      created_at
    ) VALUES (
      'notification_delivered',
      jsonb_build_object(
        'notification_id', NEW.id,
        'device_token', NEW.device_token,
        'delivery_method', NEW.delivery_method,
        'attempts', NEW.delivery_attempts,
        'delivered_at', NEW.delivered_at,
        'error_message', NEW.error_message
      ),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para logging
DROP TRIGGER IF EXISTS trigger_log_notification_delivery ON pending_notifications;
CREATE TRIGGER trigger_log_notification_delivery
  AFTER UPDATE ON pending_notifications
  FOR EACH ROW
  EXECUTE FUNCTION log_notification_delivery();

-- Comentários
COMMENT ON COLUMN device_registrations.fcm_token IS 'Token do Firebase Cloud Messaging para notificações push';
COMMENT ON COLUMN pending_notifications.error_message IS 'Mensagem de erro da última tentativa de entrega';
COMMENT ON FUNCTION increment_delivery_attempts(INTEGER, TEXT) IS 'Incrementa o contador de tentativas de entrega';
COMMENT ON FUNCTION get_pending_notifications_with_fcm(INTEGER, INTEGER) IS 'Busca notificações pendentes para dispositivos com token FCM';
COMMENT ON FUNCTION get_notification_stats() IS 'Retorna estatísticas das notificações e dispositivos';