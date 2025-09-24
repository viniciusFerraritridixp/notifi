#!/usr/bin/env node

// Script para configurar Firebase automaticamente
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Configurador do Firebase Cloud Messaging\n');

// Verificar se o arquivo .env existe
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.firebase.example');

if (!fs.existsSync(envPath)) {
  console.log('📋 Criando arquivo .env a partir do exemplo...');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ Arquivo .env criado\n');
}

// Função para atualizar o service worker do Firebase
function updateFirebaseServiceWorker() {
  const swPath = path.join(__dirname, '..', 'public', 'firebase-messaging-sw.js');
  
  try {
    let swContent = fs.readFileSync(swPath, 'utf8');
    
    console.log('🔄 Configurando service worker do Firebase...');
    
    // Placeholder para configuração dinâmica
    console.log('ℹ️  Para configurar o service worker, você precisa:');
    console.log('   1. Substituir YOUR_API_KEY pela sua chave de API');
    console.log('   2. Substituir YOUR_PROJECT_ID pelo ID do seu projeto');
    console.log('   3. Substituir outros placeholders pela configuração real\n');
    
    console.log('📁 Arquivo do service worker: public/firebase-messaging-sw.js\n');
    
  } catch (error) {
    console.error('❌ Erro ao configurar service worker:', error);
  }
}

// Função para verificar dependências
function checkDependencies() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = packageJson.dependencies || {};
    
    console.log('📦 Verificando dependências...');
    
    const requiredDeps = {
      'firebase': '^10.7.1',
      'firebase-admin': '^12.0.0'
    };
    
    let needsInstall = false;
    
    for (const [dep, version] of Object.entries(requiredDeps)) {
      if (!deps[dep]) {
        console.log(`   ❌ ${dep} não encontrado`);
        needsInstall = true;
      } else {
        console.log(`   ✅ ${dep} encontrado`);
      }
    }
    
    if (needsInstall) {
      console.log('\n🚨 Execute o comando para instalar dependências:');
      console.log('   npm install firebase firebase-admin\n');
    } else {
      console.log('   ✅ Todas as dependências estão instaladas\n');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar dependências:', error);
  }
}

// Função para criar script de inicialização
function createStartupScript() {
  const scriptContent = `#!/usr/bin/env node

// Script de inicialização do processador Firebase
import './processFirebaseNotifications.js';

console.log('🚀 Iniciando processador de notificações Firebase...');
console.log('📱 Verificando notificações pendentes e enviando via FCM');
console.log('🔄 Processamento contínuo ativo');
console.log('');
console.log('Para parar o processamento, pressione Ctrl+C');
`;

  const scriptPath = path.join(__dirname, 'start-firebase-processor.js');
  fs.writeFileSync(scriptPath, scriptContent);
  
  console.log('📝 Script de inicialização criado: scripts/start-firebase-processor.js');
}

// Função para mostrar instruções finais
function showInstructions() {
  console.log('📋 INSTRUÇÕES DE CONFIGURAÇÃO:\n');
  
  console.log('1️⃣  Configure o Firebase:');
  console.log('   • Acesse https://console.firebase.google.com');
  console.log('   • Crie um novo projeto');
  console.log('   • Ative o Firebase Cloud Messaging');
  console.log('   • Vá em Project Settings > General e copie a configuração web');
  console.log('   • Vá em Project Settings > Cloud Messaging e gere uma chave VAPID\n');
  
  console.log('2️⃣  Configure o Service Account:');
  console.log('   • Vá em Project Settings > Service Accounts');
  console.log('   • Clique em "Generate new private key"');
  console.log('   • Baixe o arquivo JSON');
  console.log('   • Extraia as informações para o arquivo .env\n');
  
  console.log('3️⃣  Configure o arquivo .env:');
  console.log('   • Edite o arquivo .env criado');
  console.log('   • Preencha todas as variáveis FIREBASE_ e VITE_FIREBASE_');
  console.log('   • Configure também as variáveis do Supabase\n');
  
  console.log('4️⃣  Execute a migração do banco:');
  console.log('   • supabase migration up (se usando Supabase CLI)');
  console.log('   • Ou execute manualmente: supabase/migrations/004_firebase_integration.sql\n');
  
  console.log('5️⃣  Instale dependências (se necessário):');
  console.log('   npm install\n');
  
  console.log('6️⃣  Inicie o processador:');
  console.log('   npm run firebase:process');
  console.log('   # ou');
  console.log('   node scripts/processFirebaseNotifications.js\n');
  
  console.log('7️⃣  Teste o sistema:');
  console.log('   • Registre um dispositivo no seu PWA');
  console.log('   • Envie uma notificação de teste');
  console.log('   • Verifique os logs do processador\n');
  
  console.log('📚 Documentação adicional disponível em:');
  console.log('   • Firebase Console: https://console.firebase.google.com');
  console.log('   • Firebase Docs: https://firebase.google.com/docs/cloud-messaging');
  console.log('   • Supabase Docs: https://supabase.io/docs\n');
}

// Função para atualizar package.json com scripts
function updatePackageJsonScripts() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    // Adicionar scripts do Firebase
    const firebaseScripts = {
      'firebase:process': 'node scripts/processFirebaseNotifications.js',
      'firebase:process:once': 'node scripts/processFirebaseNotifications.js --once',
      'firebase:setup': 'node scripts/setup-firebase.js'
    };
    
    let updated = false;
    for (const [script, command] of Object.entries(firebaseScripts)) {
      if (!packageJson.scripts[script]) {
        packageJson.scripts[script] = command;
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Scripts do Firebase adicionados ao package.json');
      console.log('   • npm run firebase:process (execução contínua)');
      console.log('   • npm run firebase:process:once (execução única)');
      console.log('   • npm run firebase:setup (configuração)\n');
    }
    
  } catch (error) {
    console.error('❌ Erro ao atualizar package.json:', error);
  }
}

// Executar configuração
async function main() {
  try {
    checkDependencies();
    updatePackageJsonScripts();
    updateFirebaseServiceWorker();
    createStartupScript();
    showInstructions();
    
    console.log('🎉 Configuração concluída!');
    console.log('📝 Próximos passos: Configure as variáveis no arquivo .env');
    
  } catch (error) {
    console.error('❌ Erro durante a configuração:', error);
  }
}

main();