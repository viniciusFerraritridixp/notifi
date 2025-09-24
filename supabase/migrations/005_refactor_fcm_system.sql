-- Migration 005: Refatorar sistema FCM
-- Remove estruturas antigas e cria sistema FCM otimizado

-- ========================================
-- 1. LIMPEZA DO SISTEMA ANTERIOR
-- ========================================

-- Remover triggers e funções antigas
DROP TRIGGER IF EXISTS trigger_log_notification_delivery ON pending_notifications;
DROP FUNCTION IF EXISTS log_notification_delivery() CASCADE;

-- Limpar dados de teste antigos
DELETE FROM notification_logs WHERE tipo IN ('firebase_delivered', 'notification_delivered');
UPDATE pending_notifications SET delivered = false, delivered_at = null WHERE delivered = true;

-- ========================================
-- 2. ESTRUTURA OTIMIZADA DE DISPOSITIVOS
-- ========================================

-- Limpar e recriar tabela device_registrations com estrutura otimizada
DROP TABLE IF EXISTS device_registrations CASCADE;

CREATE TABLE device_registrations (
    id BIGSERIAL PRIMARY KEY,
    device_token TEXT UNIQUE NOT NULL, -- Token único do dispositivo (dt_xxx)
    fcm_token TEXT, -- Token FCM do Firebase (pode ser NULL)
    fcm_token_updated_at TIMESTAMPTZ, -- Quando o FCM token foi atualizado
    
    -- Informações do dispositivo
    user_agent TEXT,
    platform TEXT,
    is_mobile BOOLEAN DEFAULT false,
    is_ios BOOLEAN DEFAULT false,
    
    -- Informações de localização/sessão
    language TEXT DEFAULT 'pt-BR',
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    screen_resolution TEXT,
    last_seen_url TEXT,
    
    -- Status e metadados
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_notification_sent_at TIMESTAMPTZ,
    
    -- Índices para performance
    CONSTRAINT valid_device_token CHECK (device_token LIKE 'dt_%'),
    CONSTRAINT valid_fcm_token CHECK (fcm_token IS NULL OR length(fcm_token) > 50)
);

-- Índices para performance
CREATE INDEX idx_device_registrations_device_token ON device_registrations(device_token);
CREATE INDEX idx_device_registrations_fcm_token ON device_registrations(fcm_token) WHERE fcm_token IS NOT NULL;
CREATE INDEX idx_device_registrations_active ON device_registrations(is_active) WHERE is_active = true;

-- ========================================
-- 3. OTIMIZAR TABELA PENDING_NOTIFICATIONS
-- ========================================

-- Adicionar colunas se não existirem
ALTER TABLE pending_notifications 
ADD COLUMN IF NOT EXISTS fcm_token TEXT,
ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'firebase',
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ DEFAULT now();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pending_notifications_fcm_token ON pending_notifications(fcm_token) WHERE fcm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_notifications_delivered ON pending_notifications(delivered) WHERE delivered = false;
CREATE INDEX IF NOT EXISTS idx_pending_notifications_scheduled ON pending_notifications(scheduled_for) WHERE delivered = false;

-- ========================================
-- 4. FUNÇÕES OTIMIZADAS PARA FCM
-- ========================================

-- Função para buscar dispositivo por device_token
CREATE OR REPLACE FUNCTION get_device_by_token(p_device_token TEXT)
RETURNS TABLE (
    id BIGINT,
    device_token TEXT,
    fcm_token TEXT,
    is_active BOOLEAN,
    is_mobile BOOLEAN,
    is_ios BOOLEAN,
    created_at TIMESTAMPTZ,
    fcm_token_updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dr.id,
        dr.device_token,
        dr.fcm_token,
        dr.is_active,
        dr.is_mobile,
        dr.is_ios,
        dr.created_at,
        dr.fcm_token_updated_at
    FROM device_registrations dr
    WHERE dr.device_token = p_device_token
    AND dr.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Função para registrar/atualizar dispositivo
CREATE OR REPLACE FUNCTION upsert_device_registration(
    p_device_token TEXT,
    p_fcm_token TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_platform TEXT DEFAULT NULL,
    p_is_mobile BOOLEAN DEFAULT false,
    p_is_ios BOOLEAN DEFAULT false,
    p_language TEXT DEFAULT 'pt-BR',
    p_timezone TEXT DEFAULT 'America/Sao_Paulo',
    p_screen_resolution TEXT DEFAULT NULL,
    p_last_seen_url TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    device_token TEXT,
    fcm_token TEXT,
    was_created BOOLEAN
) AS $$
DECLARE
    v_device_id BIGINT;
    v_was_created BOOLEAN := false;
    v_existing_fcm TEXT;
BEGIN
    -- Tentar buscar dispositivo existente
    SELECT dr.id, dr.fcm_token INTO v_device_id, v_existing_fcm
    FROM device_registrations dr
    WHERE dr.device_token = p_device_token;
    
    IF v_device_id IS NULL THEN
        -- Criar novo dispositivo
        INSERT INTO device_registrations (
            device_token, fcm_token, user_agent, platform, 
            is_mobile, is_ios, language, timezone, 
            screen_resolution, last_seen_url, fcm_token_updated_at
        ) VALUES (
            p_device_token, p_fcm_token, p_user_agent, p_platform,
            p_is_mobile, p_is_ios, p_language, p_timezone,
            p_screen_resolution, p_last_seen_url,
            CASE WHEN p_fcm_token IS NOT NULL THEN now() ELSE NULL END
        )
        RETURNING device_registrations.id INTO v_device_id;
        
        v_was_created := true;
    ELSE
        -- Atualizar dispositivo existente
        UPDATE device_registrations SET
            fcm_token = COALESCE(p_fcm_token, fcm_token),
            fcm_token_updated_at = CASE 
                WHEN p_fcm_token IS NOT NULL AND p_fcm_token != COALESCE(fcm_token, '') 
                THEN now() 
                ELSE fcm_token_updated_at 
            END,
            user_agent = COALESCE(p_user_agent, user_agent),
            platform = COALESCE(p_platform, platform),
            is_mobile = COALESCE(p_is_mobile, is_mobile),
            is_ios = COALESCE(p_is_ios, is_ios),
            language = COALESCE(p_language, language),
            timezone = COALESCE(p_timezone, timezone),
            screen_resolution = COALESCE(p_screen_resolution, screen_resolution),
            last_seen_url = COALESCE(p_last_seen_url, last_seen_url),
            updated_at = now(),
            is_active = true
        WHERE id = v_device_id;
    END IF;
    
    -- Retornar dados do dispositivo
    RETURN QUERY
    SELECT 
        dr.id,
        dr.device_token,
        dr.fcm_token,
        v_was_created
    FROM device_registrations dr
    WHERE dr.id = v_device_id;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar notificações pendentes com FCM
CREATE OR REPLACE FUNCTION get_pending_notifications_with_fcm()
RETURNS TABLE (
    notification_id BIGINT,
    device_token TEXT,
    fcm_token TEXT,
    title TEXT,
    body TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ,
    retry_count INTEGER,
    is_mobile BOOLEAN,
    is_ios BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pn.id as notification_id,
        pn.device_token,
        COALESCE(pn.fcm_token, dr.fcm_token) as fcm_token,
        pn.title,
        pn.body,
        pn.payload,
        pn.created_at,
        pn.retry_count,
        COALESCE(dr.is_mobile, false) as is_mobile,
        COALESCE(dr.is_ios, false) as is_ios
    FROM pending_notifications pn
    LEFT JOIN device_registrations dr ON pn.device_token = dr.device_token
    WHERE pn.delivered = false
    AND pn.scheduled_for <= now()
    AND (COALESCE(pn.fcm_token, dr.fcm_token) IS NOT NULL)
    AND (dr.is_active IS NULL OR dr.is_active = true)
    ORDER BY pn.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Função para marcar notificação como entregue
CREATE OR REPLACE FUNCTION mark_notification_delivered(
    p_notification_id BIGINT,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_success THEN
        UPDATE pending_notifications 
        SET 
            delivered = true,
            delivered_at = now(),
            last_error = NULL
        WHERE id = p_notification_id;
        
        -- Log de sucesso
        INSERT INTO notification_logs (sale_id, tipo, subscriptions_enviadas, sucessos, falhas, payload, created_at)
        SELECT 
            COALESCE(pn.sale_id, 0),
            'firebase_delivered',
            1, 1, 0,
            jsonb_build_object(
                'notification_id', pn.id,
                'device_token', pn.device_token,
                'title', pn.title,
                'delivered_at', now()
            ),
            now()
        FROM pending_notifications pn
        WHERE pn.id = p_notification_id;
    ELSE
        -- Incrementar retry count em caso de erro
        UPDATE pending_notifications 
        SET 
            retry_count = retry_count + 1,
            last_error = p_error_message,
            scheduled_for = now() + (retry_count + 1) * interval '5 minutes'
        WHERE id = p_notification_id;
        
        -- Log de erro se muitas tentativas
        INSERT INTO notification_logs (sale_id, tipo, subscriptions_enviadas, sucessos, falhas, payload, created_at)
        SELECT 
            COALESCE(pn.sale_id, 0),
            'firebase_failed',
            1, 0, 1,
            jsonb_build_object(
                'notification_id', pn.id,
                'device_token', pn.device_token,
                'error', p_error_message,
                'retry_count', pn.retry_count
            ),
            now()
        FROM pending_notifications pn
        WHERE pn.id = p_notification_id
        AND pn.retry_count >= 3; -- Log apenas após 3 tentativas
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. ESTATÍSTICAS E MONITORAMENTO
-- ========================================

-- Função atualizada de estatísticas
CREATE OR REPLACE FUNCTION get_notification_stats()
RETURNS TABLE (
    total_devices BIGINT,
    active_devices BIGINT,
    devices_with_fcm BIGINT,
    devices_without_fcm BIGINT,
    total_pending BIGINT,
    total_delivered BIGINT,
    total_failed BIGINT,
    fcm_tokens_updated_today BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM device_registrations) as total_devices,
        (SELECT COUNT(*) FROM device_registrations WHERE is_active = true) as active_devices,
        (SELECT COUNT(*) FROM device_registrations WHERE fcm_token IS NOT NULL AND is_active = true) as devices_with_fcm,
        (SELECT COUNT(*) FROM device_registrations WHERE fcm_token IS NULL AND is_active = true) as devices_without_fcm,
        (SELECT COUNT(*) FROM pending_notifications WHERE delivered = false) as total_pending,
        (SELECT COUNT(*) FROM pending_notifications WHERE delivered = true) as total_delivered,
        (SELECT COUNT(*) FROM pending_notifications WHERE retry_count >= 3) as total_failed,
        (SELECT COUNT(*) FROM device_registrations WHERE fcm_token_updated_at >= CURRENT_DATE) as fcm_tokens_updated_today;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. TRIGGERS PARA AUDITORIA
-- ========================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_device_registrations_updated_at
    BEFORE UPDATE ON device_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 7. DADOS DE EXEMPLO E LIMPEZA
-- ========================================

-- Migrar dados existentes se houverem
DO $$
DECLARE
    device_record RECORD;
BEGIN
    -- Este bloco só executa se existirem dados na tabela antiga
    -- (Como dropamos a tabela, este é apenas um exemplo de como migrar)
    
    RAISE NOTICE 'Sistema FCM refatorado com sucesso!';
    RAISE NOTICE 'Execute get_notification_stats() para ver estatísticas.';
END;
$$;