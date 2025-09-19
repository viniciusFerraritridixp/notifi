-- SOLUÇÃO SEM EXTENSÃO HTTP - Execute este código no SQL Editor do Supabase
-- Esta solução usa apenas Real-time e não precisa da extensão http

-- 1. Criar tabela de eventos de vendas
CREATE TABLE IF NOT EXISTS sales_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'venda_realizada',
  valor DECIMAL(10,2),
  produto TEXT,
  cliente TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_events_processed ON sales_events(processed);
CREATE INDEX IF NOT EXISTS idx_sales_events_created_at ON sales_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_events_sale_id ON sales_events(sale_id);

-- 3. Habilitar Real-time para a nova tabela
ALTER PUBLICATION supabase_realtime ADD TABLE sales_events;

-- 4. Configurar RLS (Row Level Security)
ALTER TABLE sales_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir inserção de eventos" ON sales_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir leitura de eventos" ON sales_events
  FOR SELECT USING (true);

CREATE POLICY "Permitir atualização de eventos" ON sales_events
  FOR UPDATE USING (true);

-- 5. Criar função do trigger (SEM extensão HTTP)
CREATE OR REPLACE FUNCTION notify_sale_inserted_realtime()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir evento na tabela que será capturado pelo Real-time
  INSERT INTO sales_events (
    sale_id,
    event_type,
    valor,
    produto,
    cliente,
    created_at
  ) VALUES (
    NEW.id,
    'venda_realizada',
    NEW.valor,
    NEW.produto,
    NEW.cliente,
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_sale_notification ON vendas;
DROP TRIGGER IF EXISTS trigger_sale_notification_realtime ON vendas;

-- 7. Criar novo trigger
CREATE TRIGGER trigger_sale_notification_realtime
  AFTER INSERT ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION notify_sale_inserted_realtime();

-- 8. Verificar se tudo foi criado corretamente
SELECT 'Tabela sales_events criada' as status
UNION ALL
SELECT 'Trigger criado: ' || tgname as status FROM pg_trigger WHERE tgname = 'trigger_sale_notification_realtime'
UNION ALL
SELECT 'Real-time habilitado para: ' || tablename as status FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sales_events';