-- Tabela para armazenar subscriptions de dispositivos PWA
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created_at ON push_subscriptions(created_at);

-- Tabela de exemplo para vendas (adapte conforme sua estrutura existente)
CREATE TABLE IF NOT EXISTS vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  valor DECIMAL(10,2) NOT NULL,
  produto TEXT NOT NULL,
  cliente TEXT,
  data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para configurações de notificações
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_notificacao TEXT NOT NULL DEFAULT 'venda_realizada',
  titulo TEXT NOT NULL DEFAULT 'Venda Realizada!',
  mensagem_template TEXT NOT NULL DEFAULT 'Nova venda de R$ {valor} realizada!',
  icone TEXT DEFAULT '/icon-192x192.png',
  badge TEXT DEFAULT '/icon-64x64.png',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configuração padrão para notificações de venda
INSERT INTO notification_settings (tipo_notificacao, titulo, mensagem_template) 
VALUES ('venda_realizada', 'Venda Realizada!', 'Nova venda de R$ {valor} realizada!')
ON CONFLICT DO NOTHING;

-- Função para trigger de notificação de vendas
CREATE OR REPLACE FUNCTION notify_sale_inserted()
RETURNS TRIGGER AS $$
BEGIN
  -- Chamar Edge Function para enviar notificações
  PERFORM
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/send-sale-notification',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}',
      body := json_build_object(
        'sale_id', NEW.id,
        'valor', NEW.valor,
        'produto', NEW.produto,
        'cliente', NEW.cliente
      )::text
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que dispara quando uma nova venda é inserida
DROP TRIGGER IF EXISTS trigger_sale_notification ON vendas;
CREATE TRIGGER trigger_sale_notification
  AFTER INSERT ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION notify_sale_inserted();

-- Habilitar Real-time para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE vendas;
ALTER PUBLICATION supabase_realtime ADD TABLE push_subscriptions;

-- Políticas RLS (Row Level Security)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção de subscriptions
CREATE POLICY "Permitir inserção de subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (true);

-- Política para permitir leitura de subscriptions (apenas para service role)
CREATE POLICY "Service role pode ler subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Política para permitir inserção de vendas
CREATE POLICY "Permitir inserção de vendas" ON vendas
  FOR INSERT WITH CHECK (true);

-- Política para leitura de configurações de notificação
CREATE POLICY "Permitir leitura de configurações" ON notification_settings
  FOR SELECT USING (true);