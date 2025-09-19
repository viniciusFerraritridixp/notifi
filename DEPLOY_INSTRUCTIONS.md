# 🚀 Deploy da Edge Function - Passo a Passo

## Opção 1: Deploy pelo Painel Web (Recomendado)

### 1. Acesse o Supabase
1. Vá para https://app.supabase.com
2. Entre no seu projeto
3. Clique em **"Edge Functions"** no menu lateral

### 2. Criar nova função
1. Clique em **"Create a new function"**
2. Nome: `send-sale-notification`
3. Copie o código do arquivo `edge-function-simple.ts` 
4. Cole no editor
5. Clique em **"Deploy function"**

### 3. Configurar variáveis de ambiente
Em **Settings** > **Edge Functions** > **Environment variables**:

```
VAPID_PUBLIC_KEY=BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o
VAPID_PRIVATE_KEY=qm_eXxdd8WFq2YYgJV3Kox5fy39hhztxrwX9OgTo6B8
VAPID_EMAIL=mailto:seu-email@exemplo.com
```

### 4. Copiar URL da função
Após deploy, copie a URL (similar a):
```
https://[sua-referencia].supabase.co/functions/v1/send-sale-notification
```

### 5. Atualizar trigger no banco
No **SQL Editor**, execute:

```sql
-- Substituir 'SUA-REFERENCIA-AQUI' pela sua referência real
CREATE OR REPLACE FUNCTION notify_sale_inserted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://SUA-REFERENCIA-AQUI.supabase.co/functions/v1/send-sale-notification',
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
```

## Opção 2: Deploy via CLI (Alternativo)

Se conseguir instalar a CLI:

```bash
# Fazer login
supabase login

# Vincular projeto
supabase link --project-ref [sua-referencia]

# Deploy
supabase functions deploy send-sale-notification
```

## 6. Testar o sistema

1. Execute o PWA: `npm run dev`
2. Permita notificações
3. Use o botão "Simular Venda" 
4. Verifique logs da função no painel Supabase
5. Confirme se notificações chegam

## 🔍 Verificações

### Verificar se função foi criada:
- Painel Supabase > Edge Functions > `send-sale-notification`

### Verificar variáveis de ambiente:
- Settings > Edge Functions > Environment variables

### Verificar trigger:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sale_notification';
```

### Verificar subscriptions:
```sql
SELECT COUNT(*) FROM push_subscriptions WHERE is_active = true;
```

## ❗ Problemas Comuns

- **Função não dispara**: Verificar URL no trigger
- **Erro 500**: Verificar variáveis de ambiente
- **Sem notificações**: Verificar subscriptions ativas
- **Trigger não funciona**: Recriar o trigger com URL correta

---

**✅ Após seguir estes passos, o sistema estará funcionando!**