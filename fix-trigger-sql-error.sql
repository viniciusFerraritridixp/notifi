-- Fix SQL trigger que está causando erro 42703
-- O trigger tentava inserir em colunas que não existem na tabela notification_logs
-- Colunas existentes: id, sale_id, tipo, subscriptions_enviadas, sucessos, falhas, payload, created_at

-- Primeiro, remover o trigger problemático se existir
DROP TRIGGER IF EXISTS trigger_log_notification_delivery ON pending_notifications;
DROP FUNCTION IF EXISTS log_notification_delivery();

-- Recriar a função de trigger com o schema correto da tabela notification_logs
CREATE OR REPLACE FUNCTION log_notification_delivery()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar se a notificação foi marcada como delivered
    IF NEW.delivered = true AND (OLD.delivered IS NULL OR OLD.delivered = false) THEN
        -- Inserir log usando as colunas que realmente existem na notification_logs
        INSERT INTO notification_logs (
            sale_id,
            tipo, 
            subscriptions_enviadas,
            sucessos,
            falhas,
            payload, 
            created_at
        )
        VALUES (
            COALESCE(NEW.sale_id, 0), -- sale_id da pending_notifications ou 0 se NULL
            'firebase_delivered', -- tipo de log
            1, -- 1 subscription foi processada
            1, -- sucesso (já que marcamos como delivered)
            0, -- 0 falhas
            jsonb_build_object(
                'notification_id', NEW.id,
                'device_token', NEW.device_token,
                'fcm_token', NEW.fcm_token,
                'title', NEW.title,
                'body', NEW.body,
                'delivered_at', now(),
                'method', 'firebase_admin'
            ),
            now()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger
CREATE TRIGGER trigger_log_notification_delivery
    AFTER UPDATE ON pending_notifications
    FOR EACH ROW
    EXECUTE FUNCTION log_notification_delivery();

-- Testar se a função foi criada corretamente
SELECT 
    routine_name, 
    routine_type, 
    routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'log_notification_delivery';