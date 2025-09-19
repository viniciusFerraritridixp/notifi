# Deploy Manual da Edge Function

## Como fazer deploy da Edge Function pelo painel do Supabase

### 1. Acesse o painel do Supabase
1. Vá para https://app.supabase.com
2. Entre no seu projeto
3. Navegue para **Edge Functions** no menu lateral

### 2. Criar a função
1. Clique em **"Create a new function"**
2. Nome da função: `send-sale-notification`
3. Copie todo o código do arquivo `supabase/functions/send-sale-notification/index.ts`
4. Cole no editor do painel
5. Clique em **"Create function"**

### 3. Configurar variáveis de ambiente
Na seção **Settings** > **Edge Functions**:

```
VAPID_PUBLIC_KEY=BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o
VAPID_PRIVATE_KEY=qm_eXxdd8WFq2YYgJV3Kox5fy39hhztxrwX9OgTo6B8
VAPID_EMAIL=mailto:seu-email@example.com
```

### 4. Testar a função
Após o deploy, você pode testar com este payload:

```json
{
  "sale_id": "123e4567-e89b-12d3-a456-426614174000",
  "valor": 150.99,
  "produto": "Produto Teste",
  "cliente": "Cliente Teste"
}
```

### 5. Obter a URL da função
Após criar, copie a URL da função (algo como):
```
https://sua-referencia.supabase.co/functions/v1/send-sale-notification
```

### 6. Atualizar o trigger no banco
Execute este SQL no **SQL Editor** substituindo a URL:

```sql
-- Atualizar a função do trigger com a URL correta
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

### 7. Verificar se está funcionando
1. Use o componente de teste no PWA
2. Simule uma venda
3. Verifique os logs da Edge Function no painel
4. Confirme se as notificações são enviadas