# 🚀 Deploy da Nova Edge Function - Notificações Push

## 1. Deploy da Edge Function no Supabase

### Passo 1: Criar a Edge Function
1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Edge Functions** no menu lateral
4. Clique em **Create a new function**
5. Nome: `send-sale-notification`
6. Copie o código do arquivo `edge-function-send-notifications.ts`

### Passo 2: Configurar Variáveis de Ambiente
Em **Settings** > **Edge Functions** > **Environment variables**, adicione:

```
SUPABASE_URL=https://qjrirsvrxlemamvjhdwz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqcmlyc3ZyeGxlbWFtdmpoZHd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzMzMTE2NSwiZXhwIjoyMDQ4OTA3MTY1fQ.MnEGcUOJNlNtcGpvC3TYiL-m3NI19TdYWMiDzWRoFIY
VAPID_PUBLIC_KEY=BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o
VAPID_PRIVATE_KEY=qm_eXxdd8WFq2YYgJV3Kox5fy39hhztxrwX9OgTo6B8
```

### Passo 3: Deploy
1. Clique em **Deploy function**
2. Aguarde o deploy completar
3. Copie a URL da função (será algo como: `https://qjrirsvrxlemamvjhdwz.supabase.co/functions/v1/send-sale-notification`)

## 2. Atualizar Trigger no Banco

### Passo 1: Atualizar URL no SQL
1. Abra o arquivo `update-trigger-edge-function.sql`
2. **IMPORTANTE**: Substitua `SEU_PROJETO` pela sua URL real:
   ```sql
   url := 'https://qjrirsvrxlemamvjhdwz.supabase.co/functions/v1/send-sale-notification',
   ```

### Passo 2: Executar SQL
1. No painel Supabase, vá em **SQL Editor**
2. Cole o conteúdo do arquivo `update-trigger-edge-function.sql` (já com URL corrigida)
3. Execute o script
4. Verifique se aparece o trigger criado na consulta final

## 3. Testar o Sistema

### Teste Manual:
1. No painel Supabase, vá em **Table Editor** > **vendas**
2. Clique em **Insert** > **Insert row**
3. Adicione uma venda teste:
   ```
   valor: 150.99
   produto: Produto Teste
   cliente: Cliente Teste
   ```
4. Salve

### Verificar Logs:
1. Vá em **Edge Functions** > **send-sale-notification**
2. Clique na aba **Logs**
3. Deve aparecer logs da execução

### No Celular/PWA:
- A notificação deve aparecer mesmo com o PWA fechado
- Teste tanto com PWA aberto quanto fechado

## 4. Troubleshooting

### Se a notificação não aparecer:
1. **Verificar logs da Edge Function** (erros de autenticação, subscriptions)
2. **Verificar se trigger disparou** (SQL Editor: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_sale_notification';`)
3. **Verificar subscriptions ativas** (Table Editor: `push_subscriptions` com `is_active = true`)

### Se aparecer erro de "net.http_post":
```sql
-- Habilitar extensão HTTP (se necessário)
CREATE EXTENSION IF NOT EXISTS http;
```

### Se Edge Function falhar:
- Verificar se todas as variáveis de ambiente estão configuradas
- Verificar se a URL no trigger está correta
- Verificar logs da função para erros específicos

## 5. Resultado Esperado

✅ **Quando inserir uma venda:**
1. Trigger dispara automaticamente
2. Edge Function é chamada
3. Busca todas as subscriptions ativas
4. Envia notificação push via Web Push
5. Notificação aparece em todos os dispositivos (PWA aberto ou fechado)

✅ **Não haverá mais duplicação:**
- Deduplicação no cliente (localStorage)
- Uma única fonte de notificação (Edge Function)

---

**Importante**: Esta Edge Function substitui completamente qualquer sistema anterior. Remova outras Edge Functions relacionadas a notificações se existirem.