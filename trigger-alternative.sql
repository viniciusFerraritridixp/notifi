-- SOLUÇÃO ALTERNATIVA: Trigger sem extensão HTTP
-- Use este código se não conseguir habilitar a extensão http

-- Primeiro, vamos criar uma função que usa Real-time em vez de HTTP
CREATE OR REPLACE FUNCTION notify_sale_inserted_realtime()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir um registro em uma tabela de eventos para ser capturado pelo Real-time
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

-- Criar tabela de eventos de vendas
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_events_processed ON sales_events(processed);
CREATE INDEX IF NOT EXISTS idx_sales_events_created_at ON sales_events(created_at);

-- Habilitar Real-time para a nova tabela
ALTER PUBLICATION supabase_realtime ADD TABLE sales_events;

-- Política RLS para a tabela de eventos
ALTER TABLE sales_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir inserção de eventos" ON sales_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir leitura de eventos" ON sales_events
  FOR SELECT USING (true);

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_sale_notification ON vendas;

-- Criar novo trigger usando Real-time
CREATE TRIGGER trigger_sale_notification_realtime
  AFTER INSERT ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION notify_sale_inserted_realtime();

-- Verificar se o trigger foi criado
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sale_notification_realtime';