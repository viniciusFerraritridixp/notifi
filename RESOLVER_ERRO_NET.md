# 🚨 SOLUÇÃO: Erro "schema net does not exist"

## 📋 **O Problema**
O erro `schema "net" does not exist` acontece porque a extensão HTTP não está habilitada no Supabase.

## 🔧 **Solução 1: Habilitar Extensão HTTP (Recomendado)**

### Execute no SQL Editor do Supabase:

```sql
-- Habilitar extensão HTTP
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA net;

-- Conceder permissões
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- Verificar se funcionou
SELECT * FROM pg_extension WHERE extname = 'http';
```

### Depois execute o trigger original:

```sql
CREATE OR REPLACE FUNCTION notify_sale_inserted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://SUA-REFERENCIA.supabase.co/functions/v1/send-sale-notification',
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

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_sale_notification ON vendas;
CREATE TRIGGER trigger_sale_notification
  AFTER INSERT ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION notify_sale_inserted();
```

## 🔧 **Solução 2: Alternativa sem HTTP (Mais Simples)**

Se a Solução 1 não funcionar, use esta abordagem com Real-time:

### Execute o arquivo `trigger-alternative.sql`:

```sql
-- Função que usa Real-time em vez de HTTP
CREATE OR REPLACE FUNCTION notify_sale_inserted_realtime()
RETURNS TRIGGER AS $$
BEGIN
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

-- Criar tabela de eventos
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

-- Habilitar Real-time
ALTER PUBLICATION supabase_realtime ADD TABLE sales_events;

-- RLS
ALTER TABLE sales_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir inserção de eventos" ON sales_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura de eventos" ON sales_events FOR SELECT USING (true);

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_sale_notification ON vendas;
CREATE TRIGGER trigger_sale_notification_realtime
  AFTER INSERT ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION notify_sale_inserted_realtime();
```

## ✅ **Testando**

1. **Execute o PWA**: `npm run dev`
2. **Permita notificações** quando solicitado
3. **Use o botão "Simular Venda"** na interface
4. **Verifique se a venda foi inserida**:
   ```sql
   SELECT * FROM vendas ORDER BY created_at DESC LIMIT 5;
   ```
5. **Verifique eventos (Solução 2)**:
   ```sql
   SELECT * FROM sales_events ORDER BY created_at DESC LIMIT 5;
   ```

## 🔍 **Verificações**

### Verificar se extensão HTTP está ativa:
```sql
SELECT * FROM pg_extension WHERE extname = 'http';
```

### Verificar se trigger existe:
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE '%sale%';
```

### Verificar Real-time:
```sql
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

## 💡 **Qual Solução Usar?**

- **Use Solução 1** se você quer notificações push via Edge Function
- **Use Solução 2** se você quer apenas notificações locais via Real-time
- **Ambas funcionam**, mas Solução 1 é mais robusta para produção

## 🎯 **Próximos Passos**

Após implementar uma das soluções:

1. Teste inserindo uma venda
2. Verifique se notificações aparecem
3. Verifique logs no console do navegador
4. Se usar Solução 1, verifique logs da Edge Function

---

**✅ Com uma dessas soluções, o erro será resolvido e o sistema funcionará!**