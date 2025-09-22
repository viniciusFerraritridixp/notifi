# 🔧 Solução para Erro "schema net does not exist"

## Problema
O erro `"schema \"net\" does not exist"` indica que o Supabase não tem a extensão HTTP habilitada para Edge Functions complexas.

## ✅ Solução Simplificada (Recomendada)

### Opção 1: Sistema Híbrido SQL + Real-time

1. **Execute o SQL simplificado** no Supabase:
   ```sql
   -- Copie e cole o conteúdo de: simple-notification-trigger.sql
   ```

2. **Substitua o arquivo de serviço** atual:
   ```bash
   # Renomeie o arquivo atual
   mv src/services/supabasePushService.js src/services/supabasePushService-old.js
   
   # Use a nova versão
   mv src/services/supabasePushService-v2.js src/services/supabasePushService.js
   ```

3. **Vantagens desta abordagem:**
   - ✅ Não depende de Edge Functions complexas
   - ✅ Usa apenas PostgreSQL + Real-time do Supabase
   - ✅ Funciona com PWA fechado (via Service Worker)
   - ✅ Sistema de fila para confiabilidade
   - ✅ Sem problemas de schema

### Opção 2: Habilitar Extensão HTTP (Se preferir Edge Function)

Se você quiser manter a Edge Function, execute este SQL no Supabase:

```sql
-- Habilitar extensão HTTP
CREATE EXTENSION IF NOT EXISTS http;

-- Verificar se foi habilitada
SELECT * FROM pg_extension WHERE extname = 'http';
```

## 🚀 Implementação da Solução Recomendada

### Passo 1: Execute o SQL
1. Vá em **SQL Editor** no painel Supabase
2. Cole o conteúdo do arquivo `simple-notification-trigger.sql`
3. Execute o script completo

### Passo 2: Atualize o serviço JavaScript
1. Substitua o arquivo `src/services/supabasePushService.js` pelo conteúdo de `supabasePushService-v2.js`

### Passo 3: Teste
1. Insira uma venda teste:
   ```sql
   INSERT INTO vendas (valor, produto, cliente) VALUES (199.99, 'Produto Teste', 'Cliente Teste');
   ```

2. Verifique se:
   - Trigger foi executado
   - Item foi inserido na `notifications_queue`
   - Notificação apareceu no navegador/PWA

## 📊 Como Funciona o Sistema Híbrido

```
[Venda Inserida] 
      ↓
[Trigger SQL] → [notifications_queue]
      ↓                    ↓
[Real-time]          [Service Worker]
      ↓                    ↓
[JavaScript]         [Push Notification]
      ↓
[Notificação Exibida]
```

## 🔍 Verificação e Debug

### Verificar trigger:
```sql
SELECT tgname, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgname = 'trigger_sale_notification';
```

### Verificar fila de notificações:
```sql
SELECT * FROM notifications_queue 
ORDER BY created_at DESC 
LIMIT 5;
```

### Verificar subscriptions ativas:
```sql
SELECT id, endpoint, is_active, created_at 
FROM push_subscriptions 
WHERE is_active = true;
```

## 🎯 Vantagens desta Solução

1. **Mais Confiável**: Não depende de Edge Functions complexas
2. **Melhor Performance**: Usa recursos nativos do PostgreSQL
3. **Mais Simples**: Menos dependências externas
4. **Funciona Offline**: Service Worker handle push quando PWA fechado
5. **Sistema de Fila**: Garante entrega das notificações
6. **Fácil Debug**: Logs claros em cada etapa

---

**Recomendação**: Use a **Opção 1** (Sistema Híbrido) pois é mais robusta e evita problemas de configuração de extensões no Supabase.