-- Trigger SQL para envio automático de notificações de venda
-- Este arquivo deve ser executado no Supabase SQL Editor

-- Primeiro, criar a tabela de vendas se não existir
CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar função que chama a edge function
CREATE OR REPLACE FUNCTION notify_sale_created()
RETURNS TRIGGER AS $$
DECLARE
    sale_payload JSONB;
BEGIN
    -- Preparar payload com dados da venda
    sale_payload := jsonb_build_object(
        'saleData', jsonb_build_object(
            'id', NEW.id,
            'product_name', NEW.product_name,
            'amount', NEW.amount,
            'customer_name', NEW.customer_name,
            'created_at', NEW.created_at
        )
    );

    -- Chamar a edge function de forma assíncrona
    PERFORM net.http_post(
        url := concat(
            current_setting('app.settings.supabase_url', true),
            '/functions/v1/send-sale-notification'
        ),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', concat('Bearer ', current_setting('app.settings.service_role_key', true))
        ),
        body := sale_payload
    );

    -- Log da tentativa de notificação
    INSERT INTO notification_logs (
        title,
        body,
        payload,
        status,
        created_at
    ) VALUES (
        'Nova Venda Trigger',
        concat('Trigger executado para venda: ', NEW.product_name),
        sale_payload,
        'triggered',
        NOW()
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Em caso de erro, logar mas não falhar a inserção da venda
        INSERT INTO notification_logs (
            title,
            body,
            payload,
            status,
            error_message,
            created_at
        ) VALUES (
            'Erro no Trigger de Venda',
            concat('Erro ao processar venda: ', NEW.product_name),
            sale_payload,
            'failed',
            SQLERRM,
            NOW()
        );
        
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger que executa após inserção de nova venda
DROP TRIGGER IF EXISTS trigger_notify_sale_created ON sales;
CREATE TRIGGER trigger_notify_sale_created
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION notify_sale_created();

-- Alternativa usando supabase_functions.http_request (se disponível)
CREATE OR REPLACE FUNCTION notify_sale_created_v2()
RETURNS TRIGGER AS $$
DECLARE
    sale_payload JSONB;
    function_url TEXT;
BEGIN
    -- Preparar payload
    sale_payload := jsonb_build_object(
        'saleData', jsonb_build_object(
            'id', NEW.id,
            'product_name', NEW.product_name,
            'amount', NEW.amount,
            'customer_name', NEW.customer_name,
            'created_at', NEW.created_at
        )
    );

    -- URL da edge function
    function_url := concat(
        current_setting('app.settings.supabase_url', true),
        '/functions/v1/send-sale-notification'
    );

    -- Tentar chamar usando extensão supabase_functions se disponível
    BEGIN
        SELECT supabase_functions.http_request(
            'POST',
            function_url,
            jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', concat('Bearer ', current_setting('app.settings.service_role_key', true))
            ),
            sale_payload::text
        );
    EXCEPTION
        WHEN OTHERS THEN
            -- Se supabase_functions não estiver disponível, usar net.http_post
            PERFORM net.http_post(
                url := function_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', concat('Bearer ', current_setting('app.settings.service_role_key', true))
                ),
                body := sale_payload
            );
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentários e instruções de configuração
/*
INSTRUÇÕES PARA CONFIGURAÇÃO:

1. Primeiro, configure as variáveis de ambiente no Supabase:
   - Vá para Project Settings > API
   - Copie a URL do projeto e a Service Role Key
   
2. Execute estes comandos SQL para configurar as settings:

-- Configurar URL do Supabase (substitua pela sua URL)
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://seu-projeto.supabase.co';

-- Configurar Service Role Key (substitua pela sua chave)
ALTER DATABASE postgres SET app.settings.service_role_key = 'sua-service-role-key-aqui';

3. Verificar se a extensão net está habilitada:
SELECT * FROM pg_extension WHERE extname = 'http';

4. Se não estiver habilitada, execute:
CREATE EXTENSION IF NOT EXISTS http;

5. Para testar o trigger, insira uma venda de teste:
INSERT INTO sales (product_name, amount, customer_name) 
VALUES ('Produto Teste', 99.99, 'Cliente Teste');

6. Verificar logs de notificação:
SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 10;
*/