# Configuração de Deploy no Vercel - Sistema de Notificações

## ⚠️ PROBLEMA: Tela Branca no Vercel
A tela branca que você está vendo é causada por **variáveis de ambiente faltando**. O sistema agora mostra um painel de configuração que indica exatamente o que está faltando.

## 🔧 Solução: Configurar Variáveis de Ambiente

### 1. Acesse o Dashboard do Vercel
1. Vá para https://vercel.com/dashboard
2. Clique no seu projeto `notifi`
3. Vá na aba **Settings**
4. No menu lateral, clique em **Environment Variables**

### 2. Adicione as Seguintes Variáveis

#### Variáveis do Supabase:
```
VITE_SUPABASE_URL
Valor: https://cfxkdklzpxwzvjvgnzhy.supabase.co

VITE_SUPABASE_ANON_KEY
Valor: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmeGtka2x6cHh3enZqdmduenh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMzMzExNjUsImV4cCI6MjA0ODkwNzE2NX0.n6YQSfR5iDVnWkQQAkJfKiUW_hQ6Fti3z9sUJi8rqXk

VITE_SUPABASE_SERVICE_ROLE_KEY
Valor: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmeGtka2x6cHh3enZqdmduenh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzMzMTE2NSwiZXhwIjoyMDQ4OTA3MTY1fQ.MnEGcUOJNlNtcGpvC3TYiL-m3NI19TdYWMiDzWRoFIY
```

#### Variável VAPID:
```
VITE_VAPID_PUBLIC_KEY
Valor: BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o
```

### 3. Como Adicionar no Vercel
1. Para cada variável:
   - Clique em **Add New**
   - Digite o nome (ex: `VITE_SUPABASE_URL`)
   - Digite o valor
   - Selecione **Production, Preview, Development**
   - Clique **Save**

### 4. Após Adicionar as Variáveis
1. Vá na aba **Deployments**
2. Clique no último deployment
3. Clique nos **três pontos** (⋯)
4. Selecione **Redeploy**
5. Marque **Use existing Build Cache**
6. Clique **Redeploy**

## 📋 Checklist de Verificação

Depois do redeploy, acesse sua aplicação. Você deve ver:
- [ ] Painel de configuração verde (todas as variáveis encontradas)
- [ ] Dashboard funcionando
- [ ] Componente de teste de vendas
- [ ] Notificações funcionando

## 🔍 Se Ainda Aparecer Problemas

Se ainda houver tela branca:
1. Abra as **Ferramentas do Desenvolvedor** (F12)
2. Vá na aba **Console**
3. Procure por erros em vermelho
4. Me informe quais erros aparecem

## 📱 Próximos Passos Após Resolver

1. **Testar Notificações**: Use o componente de teste para simular vendas
2. **Configurar Edge Function**: Deploy da função para notificações em massa
3. **Testar PWA**: Instalar o app e testar notificações com app fechado

---

**Nota**: O sistema foi desenvolvido para funcionar mesmo sem algumas configurações, mas para funcionalidade completa, todas as variáveis são necessárias.