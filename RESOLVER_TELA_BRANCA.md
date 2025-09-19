# 🚨 SOLUÇÃO: Tela Branca no PWA/Vercel

## 📋 **Diagnóstico do Problema**

Tela branca geralmente indica erro de JavaScript. Vamos resolver sistematicamente:

## 🔧 **Soluções Implementadas**

### ✅ **1. Configuração Vite Melhorada**
- Adicionado `base: './'` para paths relativos
- Configurado build otimizado para Vercel
- Corrigido sourcemaps

### ✅ **2. Verificação Local**
- Servidor rodando em: http://localhost:5174/
- Se funciona local, problema é no deploy

## 🎯 **Passos para Resolver**

### **Passo 1: Verificar Console do Navegador**
1. Abra o site (local ou Vercel)
2. Pressione F12 (DevTools)
3. Vá na aba **Console**
4. Procure por erros em vermelho

### **Passo 2: Verificar Credenciais Supabase**
Você precisa adicionar a SERVICE_ROLE_KEY no .env:

```env
VITE_SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_real_aqui
```

Para encontrar no Supabase:
1. Vá em **Settings** > **API**
2. Copie a **service_role key**
3. Cole no .env

### **Passo 3: Build e Deploy para Vercel**

```bash
# 1. Fazer build local
npm run build

# 2. Verificar se build funciona
npm run preview

# 3. Deploy no Vercel
# - Conecte o repo no Vercel
# - Configure variáveis de ambiente
# - Redeploy
```

### **Passo 4: Configurar Variáveis no Vercel**
No painel da Vercel:
1. Vá em **Settings** > **Environment Variables**
2. Adicione todas as variáveis do .env:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_VAPID_PUBLIC_KEY`

## 🔍 **Diagnosticar Problemas Específicos**

### **Erro: "Failed to fetch"**
- **Causa**: Variáveis de ambiente não configuradas
- **Solução**: Configurar variáveis no Vercel

### **Erro: "Supabase client error"**
- **Causa**: URLs ou keys inválidas
- **Solução**: Verificar credenciais no Supabase

### **Erro: "Cannot read property"**
- **Causa**: Componente tentando acessar dados undefined
- **Solução**: Adicionar verificações de null/undefined

### **Página carrega mas não funciona**
- **Causa**: Service Worker não registrado
- **Solução**: Verificar arquivos na pasta public/

## 🎨 **Verificação Rápida**

### Teste 1: Console Local
```bash
# Execute e veja se há erros no console
npx vite
# Abra http://localhost:5174
```

### Teste 2: Build Local
```bash
# Teste o build de produção
npm run build
npm run preview
```

### Teste 3: Sem JavaScript
- Se a página aparecer sem CSS = problema de build
- Se não aparecer nada = erro de JavaScript

## 🚀 **Para Deploy no Vercel**

### Arquivo vercel.json (crie se não existir):
```json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Comandos no Vercel:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## 🎯 **Próximos Passos Imediatos**

1. **Verificar local**: Acesse http://localhost:5174/ e veja o console
2. **Configurar SERVICE_ROLE_KEY** no .env
3. **Fazer build**: `npm run build`
4. **Configurar variáveis no Vercel**
5. **Redeploy no Vercel**

---

**✅ Após estes passos, a tela branca deve ser resolvida!**

**Qual erro específico você vê no Console do navegador?**