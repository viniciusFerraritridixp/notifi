# Push Notification PWA

Um Progressive Web App (PWA) completo para gerenciamento de notificações push em dispositivos móveis.

## 🚀 Funcionalidades

- ✅ **PWA Completo**: Instalável, funciona offline, atualização automática
- 🔔 **Notificações Push**: Sistema completo de notificações web
- 📱 **Mobile-First**: Interface otimizada para dispositivos móveis
- 🎨 **Design Responsivo**: Adaptável a diferentes tamanhos de tela
- 🌙 **Tema Escuro**: Suporte automático ao tema escuro do sistema
- 📊 **Dashboard**: Estatísticas e gerenciamento de notificações
- ⚙️ **Configurações**: Personalização de preferências
- 🔄 **Modo Offline**: Funciona sem conexão com internet

## 📱 Tecnologias Utilizadas

- **React 18** - Framework de interface
- **Vite** - Build tool e dev server
- **Service Workers** - Cache e funcionamento offline
- **Web Push API** - Notificações push nativas
- **CSS3** - Estilos responsivos e animações
- **PWA** - Progressive Web App features

## 🏗️ Estrutura do Projeto

```
push-notification-pwa/
├── public/
│   ├── manifest.json          # Manifest PWA
│   ├── sw.js                  # Service Worker
│   └── *.png                  # Ícones do app
├── src/
│   ├── components/            # Componentes React
│   │   ├── Dashboard.jsx      # Dashboard principal
│   │   ├── NotificationCenter.jsx # Central de notificações
│   │   ├── Settings.jsx       # Configurações
│   │   └── ...
│   ├── utils/                 # Utilitários
│   │   ├── notificationManager.js # Gerenciador de notificações
│   │   └── pwaManager.js      # Gerenciador PWA
│   ├── App.jsx               # Componente principal
│   ├── App.css               # Estilos principais
│   └── main.jsx              # Entry point
├── package.json
├── vite.config.js            # Configuração Vite + PWA
└── README.md
```

## 🛠️ Instalação e Execução

### Pré-requisitos

- Node.js 16+ 
- npm ou yarn

### Passo a passo

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Executar em modo desenvolvimento**
   ```bash
   npm run dev
   ```

3. **Build para produção**
   ```bash
   npm run build
   ```

4. **Visualizar build de produção**
   ```bash
   npm run preview
   ```

## 📋 Como Usar

### 1. Primeira Execução

1. Abra o app no navegador
2. Clique em "Solicitar Permissão para Notificações"
3. Aceite as permissões no browser
4. O app estará pronto para uso!

### 2. Instalar como PWA

- **No Chrome/Edge**: Clique no ícone de instalação na barra de endereço
- **No Mobile**: Use o menu "Adicionar à tela inicial"
- **Prompt automático**: O app oferecerá instalação automaticamente

### 3. Funcionalidades Principais

#### Dashboard
- Visualizar status das notificações
- Estatísticas de uso
- Enviar notificações de teste
- Criar notificações personalizadas

#### Central de Notificações
- Histórico de todas as notificações
- Filtros e organização
- Limpeza de notificações

#### Configurações
- Preferências de notificação
- Informações do sistema
- Gerenciamento de cache
- Reset de permissões

## 🔧 Configuração Avançada

### Service Worker

O Service Worker (`public/sw.js`) gerencia:
- Cache de recursos
- Funcionamento offline
- Interceptação de notificações push
- Atualização automática

### Notificações Push

Para implementar notificações push reais:

1. **Configure um servidor VAPID**
2. **Atualize a chave pública** em `notificationManager.js`
3. **Implemente endpoint** para receber subscriptions
4. **Configure servidor push** (Firebase, OneSignal, etc.)

### Customização

#### Cores e Tema
Edite as variáveis CSS em `src/App.css`:
```css
:root {
  --primary-color: #2196F3;
  --secondary-color: #FFC107;
  /* ... outras variáveis */
}
```

#### Ícones
Substitua os ícones em `public/` pelos seus próprios:
- `pwa-64x64.png`
- `pwa-192x192.png` 
- `pwa-512x512.png`

#### Manifest
Edite `public/manifest.json` para personalizar:
- Nome do app
- Cores
- Ícones
- Configurações de display

## 📱 Compatibilidade

### Navegadores Suportados
- ✅ Chrome 80+
- ✅ Firefox 76+
- ✅ Safari 13.1+
- ✅ Edge 80+

### Funcionalidades por Navegador

| Funcionalidade | Chrome | Firefox | Safari | Edge |
|----------------|--------|---------|--------|------|
| PWA Install    | ✅     | ✅      | ✅     | ✅   |
| Push Notifications | ✅  | ✅      | ⚠️     | ✅   |
| Service Worker | ✅     | ✅      | ✅     | ✅   |
| Offline Mode   | ✅     | ✅      | ✅     | ✅   |

*⚠️ Safari: Limitações em notificações push*

## 🚀 Deploy

### Netlify
```bash
npm run build
# Fazer upload da pasta dist/
```

### Vercel
```bash
npm install -g vercel
vercel --prod
```

### GitHub Pages
1. Configure GitHub Actions
2. Build automático na pasta `dist/`
3. Deploy automático

### Servidor próprio
1. Execute `npm run build`
2. Faça upload da pasta `dist/`
3. Configure HTTPS (obrigatório para PWA)

## 🛡️ Segurança

### HTTPS Obrigatório
PWAs requerem HTTPS em produção para:
- Service Workers
- Notificações Push
- Instalação do app

### Permissões
O app solicita apenas:
- **Notificações**: Para exibir alerts
- **Cache**: Para funcionamento offline

## 🐛 Troubleshooting

### Problemas Comuns

#### Notificações não funcionam
1. Verifique se está em HTTPS
2. Confirme permissões do navegador
3. Teste em navegador suportado

#### PWA não instala
1. Verifique manifest.json
2. Confirme Service Worker ativo
3. Use HTTPS

#### Não funciona offline
1. Verifique Service Worker
2. Confirme cache configurado
3. Teste conexão

### Debug

#### Console do Navegador
```javascript
// Verificar Service Worker
navigator.serviceWorker.getRegistrations()

// Verificar Cache
caches.keys()

// Testar notificações
new Notification('Teste')
```

#### DevTools
1. **Application Tab**: Service Workers, Cache, Manifest
2. **Network Tab**: Verificar requisições offline
3. **Console**: Logs de debug

## 📈 Performance

### Otimizações Implementadas
- ⚡ Vite para build rápido
- 📦 Code splitting automático
- 🗜️ Compressão de assets
- 📱 Lazy loading de componentes
- 🎯 Cache inteligente

### Métricas
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.8s
- **Cumulative Layout Shift**: < 0.1

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📄 Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Workbox](https://developers.google.com/web/tools/workbox)
- [MDN Web Docs](https://developer.mozilla.org/)

---

**Desenvolvido com ❤️ para a web mobile**