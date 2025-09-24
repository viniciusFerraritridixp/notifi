#!/usr/bin/env node

// Script para executar o processador de notificações pendentes
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Verificar variáveis de ambiente necessárias
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Variáveis de ambiente faltando:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('\nConfigure as variáveis de ambiente antes de executar o script.');
  process.exit(1);
}

// Configurar handler para encerramento gracioso
let processor = null;
let isShuttingDown = false;

process.on('SIGINT', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('\n🛑 Recebido sinal de interrupção. Encerrando graciosamente...');
  
  // Dar tempo para completar processamento atual
  setTimeout(() => {
    console.log('✅ Processador encerrado.');
    process.exit(0);
  }, 5000);
});

process.on('SIGTERM', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('\n🛑 Recebido sinal de término. Encerrando...');
  process.exit(0);
});

// Função principal
async function main() {
  try {
    console.log('🚀 Iniciando processador de notificações Firebase...');
    console.log('📊 Configurações:');
    console.log(`   - Supabase URL: ${process.env.VITE_SUPABASE_URL}`);
    console.log(`   - Firebase Project: ${process.env.FIREBASE_PROJECT_ID}`);
    console.log(`   - Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('');

      // Criar instância do processador (importar a classe)
      // Import dinamicamente para manter compatibilidade de carga
      const { default: PendingNotificationsProcessor } = await import('../src/services/firebasePendingProcessor.js');
      processor = new PendingNotificationsProcessor();

    // Verificar se deve executar uma vez ou continuamente
    const runOnce = process.argv.includes('--once');
    const interval = process.argv.includes('--interval') 
      ? parseInt(process.argv[process.argv.indexOf('--interval') + 1]) || 5
      : 5;

    if (runOnce) {
      console.log('🔄 Executando processamento único...');
      await processor.processPendingNotifications();
      console.log('✅ Processamento único concluído.');
    } else {
      console.log(`🔄 Iniciando processamento contínuo (${interval} minutos)...`);
      processor.startContinuousProcessing(interval);
      
      // Manter o processo ativo
      console.log('✅ Processador rodando. Pressione Ctrl+C para parar.');
      
      // Manter processo vivo
      setInterval(() => {
        if (!isShuttingDown) {
          console.log(`💓 Processador ativo - ${new Date().toISOString()}`);
        }
      }, 60000); // Heartbeat a cada minuto
    }

  } catch (error) {
    console.error('❌ Erro fatal no processador:', error);
    process.exit(1);
  }
}

// Mostrar ajuda
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
📱 Processador de Notificações Firebase

Uso:
  node scripts/processFirebaseNotifications.js [opções]

Opções:
  --once                 Executa o processamento apenas uma vez
  --interval <minutos>   Intervalo entre processamentos (padrão: 5 minutos)
  --help, -h            Mostra esta ajuda

Variáveis de ambiente necessárias:
  VITE_SUPABASE_URL          URL do projeto Supabase
  SUPABASE_SERVICE_ROLE_KEY  Chave de service role do Supabase
  FIREBASE_PROJECT_ID        ID do projeto Firebase
  FIREBASE_PRIVATE_KEY       Chave privada do service account
  FIREBASE_CLIENT_EMAIL      Email do service account

Exemplos:
  # Executar continuamente (padrão)
  node scripts/processFirebaseNotifications.js

  # Executar uma vez apenas
  node scripts/processFirebaseNotifications.js --once

  # Executar a cada 2 minutos
  node scripts/processFirebaseNotifications.js --interval 2
  `);
  process.exit(0);
}

// Executar função principal
main().catch(error => {
  console.error('❌ Erro não tratado:', error);
  process.exit(1);
});