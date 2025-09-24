# 🔧 Guia Rápido de Configuração Firebase

Este arquivo te ajuda a configurar rapidamente o Firebase Cloud Messaging.

## ✅ Status Atual

✅ **Sistema Instalado e Funcional**
- Scripts criados e testados
- Dependências instaladas
- Estrutura de banco configurada

❌ **Pendente: Configuração das Credenciais**
- Você precisa configurar as variáveis do Firebase no arquivo `.env`

## 🚀 Próximos Passos

### 1. Configurar Firebase Console

1. **Acesse**: https://console.firebase.google.com
2. **Clique em**: "Criar um projeto" ou "Add project"
3. **Nome do projeto**: `notifi-app` (ou qualquer nome)
4. **Pule** o Google Analytics (não é necessário)

### 2. Ativar Cloud Messaging

1. No painel do projeto, vá em **"Build" > "Cloud Messaging"**
2. Se aparecer para ativar, clique em **"Get started"**

### 3. Obter Configuração Web

1. Vá em **"Project Settings"** (ícone de engrenagem)
2. Na aba **"General"**, role até **"Your apps"**
3. Clique no ícone **"</>"** (Web)
4. **Nome do app**: `notifi-pwa`
5. **Marque**: "Also set up Firebase Hosting"
6. Clique **"Register app"**
7. **COPIE** a configuração que aparece:

```javascript
const firebaseConfig = {
  apiKey: "AIza...", // ← COPIE ESTE
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto", // ← E ESTE
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789", // ← E ESTE
  appId: "1:123:web:abc...", // ← E ESTE
  measurementId: "G-ABC..." // ← E ESTE
};
```

### 4. Gerar Chave VAPID

1. Ainda em **"Project Settings"**
2. Vá na aba **"Cloud Messaging"**
3. Role até **"Web configuration"**
4. Em **"Web Push certificates"**, clique **"Generate key pair"**
5. **COPIE** a chave VAPID gerada

### 5. Criar Service Account

1. Vá na aba **"Service accounts"**
2. Clique **"Generate new private key"**
3. **Baixe** o arquivo JSON
4. **Abra** o arquivo e encontre:
   - `project_id` ← COPIE
   - `private_key` ← COPIE (toda a chave incluindo \\n)
   - `client_email` ← COPIE

### 6. Configurar .env

Abra o arquivo `.env` e preencha:

```bash
# === CONFIGURAÇÕES SUPABASE ===
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

# === CONFIGURAÇÕES FIREBASE WEB ===
VITE_FIREBASE_API_KEY=AIza... (do passo 3)
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto (do passo 3)
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 (do passo 3)
VITE_FIREBASE_APP_ID=1:123:web:abc... (do passo 3)
VITE_FIREBASE_MEASUREMENT_ID=G-ABC... (do passo 3)
VITE_FIREBASE_VAPID_KEY=chave_vapid_do_passo_4

# === CONFIGURAÇÕES FIREBASE ADMIN ===
FIREBASE_PROJECT_ID=seu-projeto (mesmo do acima)
FIREBASE_PRIVATE_KEY_ID=id_da_chave_privada (do arquivo JSON)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nchave_privada_completa\\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@seu-projeto.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=id_do_cliente (do arquivo JSON)
```

### 7. Testar Configuração

```bash
npm run firebase:test
```

Se tudo estiver correto, você verá:
```
✅ Todas as variáveis de ambiente estão configuradas!
✅ Conexão com Supabase OK
✅ Configuração Firebase OK
🎉 Configuração verificada com sucesso!
```

### 8. Executar Sistema

```bash
# Terminal 1: Aplicação
npm run dev

# Terminal 2: Processador Firebase
npm run firebase:process
```

## 🔍 Problemas Comuns

### ❌ "SUPABASE_SERVICE_ROLE_KEY: MISSING"
**Solução**: No Supabase Dashboard → Settings → API → copie a **service_role** key

### ❌ "Firebase Admin não inicializado"
**Solução**: Verifique se a `FIREBASE_PRIVATE_KEY` está entre aspas e com `\\n`

### ❌ "Invalid token"
**Solução**: Re-gere as chaves no Firebase Console

## 📞 Ajuda

Se tiver problemas:

1. ✅ Execute: `npm run firebase:test`
2. ✅ Verifique cada variável no `.env`
3. ✅ Confirme que copiou as chaves corretas
4. ✅ Veja os logs detalhados no console

**Documentação completa**: `FIREBASE_SETUP.md`