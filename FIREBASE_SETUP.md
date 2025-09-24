# 🔥 Firebase Cloud Messaging - Configuração e Uso

Este documento explica como configurar e usar o Firebase Cloud Messaging (FCM) para enviar notificações push para dispositivos que não estão com o PWA aberto.

> 🚀 **CONFIGURAÇÃO RÁPIDA**: Veja `CONFIGURACAO_RAPIDA.md` para um guia passo-a-passo simplificado.

## 📋 Visão Geral

O sistema integra o Firebase FCM com o Supabase para:
- ✅ Detectar dispositivos offline
- ✅ Enviar notificações via Firebase
- ✅ Marcar notificações como entregues
- ✅ Processar filas de notificações pendentes
- ✅ Suporte a notificações em background

## 🚀 Configuração Rápida

### 1. Configurar Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Crie um novo projeto
3. Ative **Cloud Messaging**
4. Em **Project Settings > General**, copie a configuração web
5. Em **Project Settings > Cloud Messaging**, gere uma chave VAPID

### 2. Configurar Service Account

1. Vá em **Project Settings > Service Accounts**
2. Clique em **"Generate new private key"**
3. Baixe o arquivo JSON
4. Extraia as informações para o arquivo `.env`

### 3. Configurar Variáveis de Ambiente

Copie `.env.firebase.example` para `.env` e preencha:

```bash
# Frontend (Firebase Web)
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key

# Backend (Firebase Admin)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@project.iam.gserviceaccount.com

# Supabase
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Executar Migrações

```bash
# Se usando Supabase CLI
supabase migration up

# Ou execute manualmente no Supabase
# Execute: supabase/migrations/004_firebase_integration.sql
```

### 5. Instalar Dependências

```bash
npm install
```

## 🛠️ Scripts Disponíveis

```bash
# Configurar Firebase automaticamente
npm run firebase:setup

# Testar configuração (COMECE POR AQUI!)
npm run firebase:test

# Processar notificações (contínuo)
npm run firebase:process

# Processar notificações (uma vez)
npm run firebase:process:once

# Desenvolvimento
npm run dev
```

> 💡 **DICA**: Execute `npm run firebase:test` primeiro para verificar se tudo está configurado!

## 📱 Como Funciona

### Fluxo de Notificações

1. **Registro do Dispositivo**
   - Usuário abre o PWA
   - Sistema solicita permissão para notificações
   - Obtém token FCM do Firebase
   - Salva no Supabase (`device_registrations.fcm_token`)

2. **Envio de Notificação**
   - Aplicação adiciona notificação em `pending_notifications`
   - Campo `delivered = false`
   - Sistema tenta entrega imediata para dispositivos online

3. **Processamento Background**
   - Script roda a cada 5 minutos
   - Busca notificações não entregues
   - Envia via Firebase FCM
   - Marca como `delivered = true`

### Estrutura de Dados

```sql
-- Registro de dispositivos
device_registrations (
  device_token TEXT,     -- Token único do dispositivo
  fcm_token TEXT,        -- Token do Firebase
  is_active BOOLEAN,     -- Dispositivo ativo
  last_seen TIMESTAMP    -- Última vez online
)

-- Notificações pendentes
pending_notifications (
  device_token TEXT,        -- Dispositivo alvo
  notification_data JSONB,  -- Dados da notificação
  delivered BOOLEAN,        -- Status de entrega
  delivery_attempts INT,    -- Tentativas de entrega
  error_message TEXT        -- Erro da última tentativa
)
```

## 🔧 Uso no Código

### Frontend - Registrar Dispositivo

```javascript
import HybridFirebaseService from './services/hybridFirebaseService.js';

// Inicializar Firebase
await HybridFirebaseService.initialize();

// Registrar dispositivo
await HybridFirebaseService.registerDevice({
  deviceToken: 'unique-device-id',
  userAgent: navigator.userAgent,
  platform: 'web',
  // ... outros dados
});
```

### Frontend - Enviar Notificação

```javascript
// Enviar notificação (vai para fila)
await HybridFirebaseService.sendNotification('device-token', {
  title: 'Nova Venda!',
  body: 'Você tem uma nova venda de R$ 100,00',
  type: 'sale',
  url: '/vendas/123',
  sound: 'cash'
});
```

### Backend - Processamento

```javascript
import PendingNotificationsProcessor from './src/services/firebasePendingProcessor.js';

const processor = new PendingNotificationsProcessor();

// Processar uma vez
await processor.processPendingNotifications();

// Processar continuamente (5 em 5 minutos)
processor.startContinuousProcessing(5);
```

## 🎛️ Componente React

```jsx
import FirebaseNotificationManager from './components/FirebaseNotificationManager.jsx';

function App() {
  return (
    <div>
      <FirebaseNotificationManager />
    </div>
  );
}
```

## 📊 Monitoramento

### Estatísticas Disponíveis

```javascript
const stats = await HybridFirebaseService.getNotificationStats();
// Retorna:
// {
//   total_pending: 10,
//   total_delivered: 95,
//   total_failed: 2,
//   devices_with_fcm: 150,
//   devices_without_fcm: 5
// }
```

### Logs e Debug

```bash
# Ver logs do processador
npm run firebase:process

# Logs aparecem no console:
# ✅ [Firebase Admin] Notificação enviada: projects/xxx/messages/xxx
# ❌ [Firebase Admin] Erro ao enviar: Invalid token
```

## 🔍 Troubleshooting

### Problemas Comuns

1. **Token FCM inválido**
   ```
   ❌ [Firebase Admin] Erro: Invalid registration token
   ```
   **Solução**: Token expirou, re-registrar dispositivo

2. **Permissões negadas**
   ```
   ⚠️ [Firebase] Permissão para notificações negada
   ```
   **Solução**: Usuário deve permitir notificações no browser

3. **Service Worker não carrega**
   ```
   ❌ Service Worker registration failed
   ```
   **Solução**: Verificar se `firebase-messaging-sw.js` está acessível

4. **Variáveis de ambiente**
   ```
   ❌ Firebase Admin não inicializado
   ```
   **Solução**: Verificar `.env` com todas as variáveis

### Debug

```javascript
// Ativar logs detalhados
localStorage.setItem('debug', 'firebase*');

// Verificar token FCM
console.log(HybridFirebaseService.currentFCMToken);

// Testar configuração
await HybridFirebaseService.initialize();
```

## 📋 Checklist de Configuração

- [ ] Projeto Firebase criado
- [ ] Cloud Messaging ativado
- [ ] Chave VAPID gerada
- [ ] Service Account configurado
- [ ] Arquivo `.env` preenchido
- [ ] Migrações executadas
- [ ] Dependências instaladas
- [ ] Processador rodando
- [ ] Teste enviado com sucesso

## 🔗 Links Úteis

- [Firebase Console](https://console.firebase.google.com)
- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Supabase Dashboard](https://app.supabase.io)
- [VAPID Key Generator](https://tools.reactpwa.com/vapid)

## 📞 Suporte

Se encontrar problemas:

1. **🔍 Execute primeiro**: `npm run firebase:test` 
2. **📖 Veja guia rápido**: `CONFIGURACAO_RAPIDA.md`
3. **🔧 Verifique logs**: Console do navegador e terminal
4. **🔑 Confirme credenciais**: Arquivo `.env` completo

### ⚡ Teste Rápido

```bash
# 1. Verificar configuração
npm run firebase:test

# 2. Se OK, testar processamento
npm run firebase:process:once

# 3. Se OK, rodar continuamente  
npm run firebase:process
```

## 🚀 Próximos Passos

Após configurar:

1. Teste o sistema completo
2. Configure monitoramento de produção
3. Implemente analytics de notificações
4. Adicione templates de notificação
5. Configure rate limiting