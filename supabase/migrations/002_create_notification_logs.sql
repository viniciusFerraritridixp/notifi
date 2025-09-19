-- Tabela para logs de notificações enviadas
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'venda_realizada',
  subscriptions_enviadas INTEGER DEFAULT 0,
  sucessos INTEGER DEFAULT 0,
  falhas INTEGER DEFAULT 0,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_sale_id ON notification_logs(sale_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_tipo ON notification_logs(tipo);

-- Política RLS para logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role pode inserir logs" ON notification_logs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Permitir leitura de logs" ON notification_logs
  FOR SELECT USING (true);