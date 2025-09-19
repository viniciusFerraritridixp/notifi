# Sistema de Notificações Push para Vendas com Supabase

Este sistema implementa notificações push automáticas que são disparadas sempre que uma nova venda é inserida na tabela de vendas do Supabase. As notificações são enviadas para todos os dispositivos PWA registrados, independentemente de estarem com o app aberto ou fechado.

## 🚀 Características

- ✅ Notificações push automáticas para vendas
- ✅ Suporte a PWA (Progressive Web App)
- ✅ Real-time usando Supabase
- ✅ Edge Functions para envio em massa
- ✅ Triggers automáticos no banco de dados
- ✅ Mensagens personalizáveis
- ✅ Funciona com app fechado
- ✅ Gerenciamento de subscriptions

## 📋 Pré-requisitos

1. Projeto Supabase configurado
2. Node.js instalado
3. Acesso ao painel do Supabase

## ⚙️ Configuração

### 1. Configurar Variáveis de Ambiente

Edite o arquivo `.env` com suas credenciais do Supabase:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# VAPID Keys (já configuradas automaticamente)
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

### 2. Executar Migrations no Supabase

No painel do Supabase, vá em **SQL Editor** e execute os seguintes arquivos SQL na ordem:

1. `supabase/migrations/001_create_notification_system.sql`
2. `supabase/migrations/002_create_notification_logs.sql`

### 3. Configurar Edge Function

1. Instale a CLI do Supabase:
```bash
npm install -g supabase
```

2. Faça login:
```bash
supabase login
```

3. Vincule seu projeto:
```bash
supabase link --project-ref your-project-ref
```

4. Faça deploy da Edge Function:
```bash
supabase functions deploy send-sale-notification
```

5. Configure as variáveis de ambiente da Edge Function no painel do Supabase:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_EMAIL` (opcional)

### 4. Atualizar Trigger SQL

No SQL Editor do Supabase, atualize a URL da Edge Function no trigger:

```sql
-- Substituir 'your-project' pela referência do seu projeto
UPDATE pg_proc 
SET prosrc = replace(prosrc, 'your-project.supabase.co', 'sua-referencia-real.supabase.co')
WHERE proname = 'notify_sale_inserted';
```

## 🎯 Como Funciona

### Fluxo Automático

1. **Insert na Tabela**: Quando uma venda é inserida na tabela `vendas`
2. **Trigger Ativado**: O trigger `trigger_sale_notification` é executado
3. **Edge Function**: Chama a função `send-sale-notification`
4. **Busca Subscriptions**: A função busca todos os dispositivos registrados
5. **Envio Push**: Envia notificações para todos os dispositivos
6. **Real-time**: Dispositivos ativos também recebem via Real-time

### Estrutura das Tabelas

```sql
-- Tabela de vendas
vendas (
  id UUID PRIMARY KEY,
  valor DECIMAL(10,2),
  produto TEXT,
  cliente TEXT,
  created_at TIMESTAMP
)

-- Subscriptions de dispositivos
push_subscriptions (
  id UUID PRIMARY KEY,
  endpoint TEXT UNIQUE,
  p256dh TEXT,
  auth TEXT,
  is_active BOOLEAN
)

-- Configurações de notificação
notification_settings (
  tipo_notificacao TEXT,
  titulo TEXT,
  mensagem_template TEXT,
  ativo BOOLEAN
)
```

## 🧪 Testando o Sistema

1. **Inicie o projeto**:
```bash
npm run dev
```

2. **Abra o PWA** em http://localhost:5173

3. **Permita notificações** quando solicitado

4. **Use o componente de teste** na página principal:
   - Clique em "Simular Venda" para inserir uma venda
   - Observe as notificações sendo enviadas
   - Verifique subscriptions ativas

5. **Teste em múltiplos dispositivos**:
   - Abra o PWA em diferentes navegadores/dispositivos
   - Permita notificações em todos
   - Faça uma venda e veja as notificações chegarem

## 📱 Funcionamento em Dispositivos

### Desktop
- Chrome, Firefox, Edge: Notificações do sistema
- Funciona com navegador fechado se PWA instalado

### Mobile (Android)
- Chrome: Notificações push nativas
- Funciona com app em background
- Requer instalação do PWA

### Mobile (iOS)
- Safari: Suporte limitado a push notifications
- Melhor funcionamento com app aberto

## 🔧 Personalização

### Modificar Mensagens

Edite a tabela `notification_settings`:

```sql
UPDATE notification_settings 
SET mensagem_template = 'Venda de R$ {valor} para {cliente}!'
WHERE tipo_notificacao = 'venda_realizada';
```

### Variáveis Disponíveis

- `{valor}`: Valor da venda (formatado em R$)
- `{produto}`: Nome do produto
- `{cliente}`: Nome do cliente

### Adicionar Novos Tipos

```sql
INSERT INTO notification_settings (
  tipo_notificacao,
  titulo,
  mensagem_template
) VALUES (
  'produto_baixo_estoque',
  'Estoque Baixo!',
  'Produto {produto} com apenas {quantidade} unidades'
);
```

## 🐛 Solução de Problemas

### Notificações não chegam

1. Verificar permissões do navegador
2. Confirmar se subscription está ativa:
```sql
SELECT * FROM push_subscriptions WHERE is_active = true;
```
3. Verificar logs da Edge Function no Supabase
4. Testar trigger manualmente

### Edge Function com erro

1. Verificar variáveis de ambiente
2. Ver logs em Functions > send-sale-notification
3. Testar endpoint manualmente

### Real-time não funciona

1. Verificar se Real-time está habilitado no Supabase
2. Confirmar RLS policies
3. Verificar conexão de internet

## 📊 Monitoramento

### Verificar Estatísticas

```sql
-- Vendas com notificações
SELECT v.*, nl.sucessos, nl.falhas 
FROM vendas v
LEFT JOIN notification_logs nl ON v.id = nl.sale_id
ORDER BY v.created_at DESC;

-- Dispositivos ativos
SELECT COUNT(*) as dispositivos_ativos 
FROM push_subscriptions 
WHERE is_active = true;
```

### Logs de Notificações

```sql
SELECT * FROM notification_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

## 🔒 Segurança

- Row Level Security (RLS) habilitado em todas as tabelas
- Service Role necessário para operations administrativas
- Subscriptions protegidas por políticas
- Edge Functions com autenticação

## 📈 Próximos Passos

1. Implementar dashboard de estatísticas
2. Adicionar filtros por tipo de cliente
3. Criar templates de mensagem avançados
4. Implementar agendamento de notificações
5. Adicionar suporte a imagens nas notificações

## 🤝 Contribuindo

Para adicionar novas funcionalidades:

1. Crie uma nova migration SQL
2. Atualize a Edge Function se necessário
3. Modifique o frontend para novos tipos
4. Teste em múltiplos dispositivos
5. Atualize esta documentação

---

**Desenvolvido com ❤️ usando Supabase, React e Web Push API**