# Guia Completo: Notificações Push em Background

Este guia explica como implementar e configurar notificações push que funcionam mesmo quando o PWA/site estão fechados.

## 🎯 O que foi implementado

### 1. Service Worker Otimizado (`public/sw.js`)
- **Background Sync**: Garante entrega mesmo offline
- **Persistência iOS**: Estratégias específicas para dispositivos Apple
- **Keep-alive**: Mantém o service worker ativo
- **Logs detalhados**: Para debugging

### 2. Manifest Atualizado (`public/manifest.json`)
- **Permissões de background**: `notifications`, `background-sync`, `push`
- **Configuração PWA**: Otimizada para notificações
- **GCM Sender ID**: Para compatibilidade com Firebase

### 3. Edge Function (`supabase/functions/send-sale-notification/index.ts`)
- **Envio automático**: Processa notificações de venda
- **Multi-dispositivo**: Envia para todos os dispositivos registrados
- **Logs completos**: Rastreia sucesso/falha de cada envio
- **Tratamento de erros**: Robusto e confiável

### 4. Trigger SQL (`trigger-sales-notification.sql`)
- **Automático**: Dispara quando nova venda é inserida
- **Assíncrono**: Não bloqueia inserção de vendas
- **Fallback**: Múltiplas estratégias de envio

## 🚀 Como configurar

### Passo 1: Configurar o Supabase

1. **Habilitar extensão HTTP**:
```sql
CREATE EXTENSION IF NOT EXISTS http;
```

2. **Configurar variáveis de ambiente**:
```sql
-- Substitua pela sua URL do projeto
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://seu-projeto.supabase.co';

-- Substitua pela sua Service Role Key
ALTER DATABASE postgres SET app.settings.service_role_key = 'sua-service-role-key-aqui';
```

3. **Executar o arquivo `trigger-sales-notification.sql`** no SQL Editor do Supabase

### Passo 2: Deploy da Edge Function

1. **Instalar Supabase CLI** (se ainda não tiver):
```bash
npm install -g supabase
```

2. **Fazer login**:
```bash
supabase login
```

3. **Fazer deploy da função**:
```bash
supabase functions deploy send-sale-notification
```

### Passo 3: Testar a implementação

1. **Executar o servidor de desenvolvimento**:
```bash
npm run dev
```

2. **Abrir o console do navegador** e executar:
```javascript
// Carregar o teste
const script = document.createElement('script');
script.src = '/test-background-notifications.js';
document.head.appendChild(script);

// Aguardar carregar e executar
setTimeout(async () => {
  const tester = new NotificationTester();
  await tester.runAllTests();
}, 1000);
```

## 📱 Como testar notificações em background

### Teste 1: Com navegador minimizado
1. Abra o PWA no navegador
2. Registre-se para notificações
3. Minimize o navegador (não feche)
4. Insira uma venda de teste no banco:
```sql
INSERT INTO sales (product_name, amount, customer_name) 
VALUES ('Produto Teste', 99.99, 'Cliente Teste');
```
5. Verifique se a notificação aparece

### Teste 2: Com PWA "fechado"
1. Instale o PWA (Add to Home Screen)
2. Abra o PWA instalado
3. Registre-se para notificações
4. Feche completamente o PWA
5. Insira uma venda de teste
6. A notificação deve aparecer mesmo com app fechado

### Teste 3: Usando o script de teste
```javascript
// No console do navegador
const tester = new NotificationTester();
await tester.runAllTests();

// Para simular app em background
await tester.testWithHiddenApp();
```

## 🔧 Configurações importantes

### Permissões necessárias
- **Notifications**: Para exibir notificações
- **Background Sync**: Para funcionamento offline
- **Push**: Para receber push messages

### Chaves VAPID
- Certifique-se de que as chaves VAPID estão configuradas em `/public/vapid-keys.json`
- Se não existir, gere novas chaves:
```bash
node scripts/generate-vapid.js
```

### Service Worker
- O service worker precisa estar registrado e ativo
- Verificar no DevTools → Application → Service Workers

## 🐛 Troubleshooting

### Notificações não aparecem
1. **Verificar permissões**:
   - Site Settings → Notifications → Allow
   
2. **Verificar service worker**:
   - DevTools → Application → Service Workers
   - Deve estar "activated and running"
   
3. **Verificar logs**:
   - Console do navegador
   - Logs da edge function no Supabase

### iOS específico
- iOS tem limitações para PWAs não instalados
- Instalar o PWA na tela inicial melhora funcionamento
- Usar `requireInteraction: true` para persistência

### Android
- Funciona melhor que iOS
- Chrome permite notificações mesmo com app fechado
- Samsung Internet também suporta

## 📊 Monitoramento

### Logs de notificação
Verifique a tabela `notification_logs` no Supabase:
```sql
SELECT * FROM notification_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Dispositivos registrados
Verifique a tabela `device_registrations`:
```sql
SELECT id, platform, is_active, last_seen 
FROM device_registrations 
WHERE is_active = true;
```

### Edge function logs
- Supabase Dashboard → Edge Functions → Logs
- Mostra execuções e erros da função

## 🎯 Resultados esperados

Após a implementação completa:

✅ **Notificações funcionam com app fechado**
✅ **Suporte multi-plataforma** (iOS, Android, Desktop)
✅ **Envio automático** quando nova venda é inserida
✅ **Logs completos** para debugging
✅ **Tratamento de erros** robusto
✅ **Background sync** para garantia de entrega

## 🔄 Fluxo completo

1. **Nova venda inserida** → Trigger SQL ativado
2. **Trigger chama** → Edge Function
3. **Edge Function busca** → Dispositivos registrados
4. **Edge Function envia** → Push notifications
5. **Service Worker recebe** → Push event
6. **Service Worker exibe** → Notificação visual
7. **Usuário clica** → Abre PWA/site

Este fluxo garante que as notificações cheguem mesmo com o app completamente fechado!