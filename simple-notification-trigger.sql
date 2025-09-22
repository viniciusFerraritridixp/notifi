-- SQL Trigger Function Simplificada para Notificações
-- Esta versão usa apenas recursos internos do PostgreSQL

-- 1. Primeiro, criar a função de trigger simplificada
CREATE OR REPLACE FUNCTION notify_sale_inserted()
RETURNS TRIGGER AS $$
DECLARE
    subscription_record RECORD;
    notification_title TEXT := 'Venda Realizada!';
    notification_body TEXT;
    total_subscriptions INTEGER := 0;
    processed_subscriptions INTEGER := 0;
BEGIN
    -- Formatar o valor da venda
    notification_body := 'Nova venda de R$ ' || 
                        TO_CHAR(NEW.valor, 'FM999G999G999D00') || 
                        ' realizada!';
    
    IF NEW.produto IS NOT NULL THEN
        notification_body := notification_body || ' Produto: ' || NEW.produto;
    END IF;

    -- Log da venda inserida
    RAISE NOTICE 'Nova venda inserida: ID=%, Valor=R$%', NEW.id, NEW.valor;

    -- Buscar todas as subscriptions ativas
    FOR subscription_record IN 
        SELECT * FROM push_subscriptions WHERE is_active = true
    LOOP
        total_subscriptions := total_subscriptions + 1;
        
        -- Inserir notificação na tabela de notificações para processamento
        INSERT INTO notifications_queue (
            subscription_id,
            endpoint,
            title,
            body,
            icon,
            tag,
            data_payload,
            created_at,
            status
        ) VALUES (
            subscription_record.id,
            subscription_record.endpoint,
            notification_title,
            notification_body,
            '/pwa-192x192.png',
            'sale-' || NEW.id::TEXT,
            json_build_object(
                'saleId', NEW.id,
                'valor', NEW.valor,
                'type', 'sale-notification',
                'url', '/'
            ),
            NOW(),
            'pending'
        );
        
        processed_subscriptions := processed_subscriptions + 1;
    END LOOP;

    RAISE NOTICE 'Notificações enfileiradas: % de % subscriptions', processed_subscriptions, total_subscriptions;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Criar tabela de fila de notificações (se não existir)
CREATE TABLE IF NOT EXISTS notifications_queue (
    id SERIAL PRIMARY KEY,
    subscription_id UUID,
    endpoint TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon TEXT,
    tag TEXT,
    data_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);

-- 3. Remover trigger existente e criar novo
DROP TRIGGER IF EXISTS trigger_sale_notification ON vendas;

CREATE TRIGGER trigger_sale_notification
    AFTER INSERT ON vendas
    FOR EACH ROW
    EXECUTE FUNCTION notify_sale_inserted();

-- 4. Criar função para processar fila de notificações (opcional - para background job)
CREATE OR REPLACE FUNCTION process_notification_queue()
RETURNS INTEGER AS $$
DECLARE
    notification_record RECORD;
    processed_count INTEGER := 0;
BEGIN
    -- Processar notificações pendentes
    FOR notification_record IN 
        SELECT * FROM notifications_queue 
        WHERE status = 'pending' 
        AND retry_count < 3
        ORDER BY created_at ASC
        LIMIT 10
    LOOP
        -- Aqui você pode implementar a lógica de envio
        -- Por enquanto, apenas marcar como enviado
        UPDATE notifications_queue 
        SET status = 'sent', 
            processed_at = NOW()
        WHERE id = notification_record.id;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Verificar se o trigger foi criado
SELECT 
    tgname as trigger_name,
    tgtype as trigger_type,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trigger_sale_notification';

-- 6. Verificar estrutura da tabela de fila
\d notifications_queue;