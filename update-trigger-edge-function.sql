-- SQL para atualizar trigger e chamar a nova Edge Function
-- Execute este código no SQL Editor do Supabase

-- 1. Remover triggers antigos se existirem
DROP TRIGGER IF EXISTS trigger_sale_notification ON vendas;
DROP TRIGGER IF EXISTS trigger_sale_notification_realtime ON vendas;

-- 2. Criar nova função do trigger para chamar Edge Function
CREATE OR REPLACE FUNCTION send_sale_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Chamar Edge Function para enviar notificações push
  PERFORM net.http_post(
    url := 'https://SEU_PROJETO.supabase.co/functions/v1/send-sale-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'saleData', jsonb_build_object(
        'id', NEW.id,
        'valor', NEW.valor,
        'produto', NEW.produto,
        'cliente', NEW.cliente,
        'created_at', NEW.created_at
      )
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar trigger que dispara após inserção de venda
CREATE TRIGGER trigger_sale_notification
  AFTER INSERT ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION send_sale_notification();

-- 4. Verificar se o trigger foi criado
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'trigger_sale_notification';

-- 5. Testar inserção (opcional - remova se não quiser testar agora)
/*
INSERT INTO vendas (valor, produto, cliente) 
VALUES (299.99, 'Produto Teste', 'Cliente Teste');
*/