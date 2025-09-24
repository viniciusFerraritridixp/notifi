const fs = require('fs');
const FCMDeviceService = require('../src/services/fcmDeviceService.cjs');
require('dotenv').config();

async function refactorDatabase() {
  console.log('🔧 Refatorando banco de dados FCM...\n');

  try {
    // 1. Ler e mostrar a migration
    console.log('📋 IMPORTANTE: Execute a migration SQL no painel do Supabase:');
    console.log('=' .repeat(80));
    
    const migrationPath = './supabase/migrations/005_refactor_fcm_system.sql';
    
    if (fs.existsSync(migrationPath)) {
      console.log(`📄 Arquivo: ${migrationPath}`);
      console.log('🌐 URL Supabase: https://supabase.com/dashboard/project/[seu-projeto]/sql');
      console.log('\n📝 Copie o conteúdo do arquivo e execute no SQL Editor do Supabase');
    } else {
      console.log('❌ Arquivo de migration não encontrado');
      return;
    }

    console.log('\n' + '=' .repeat(80));
    console.log('⏳ Aguardando aplicação da migration...');
    console.log('📌 Após executar a migration, pressione Enter para continuar os testes');
    
    // Aguardar input do usuário
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });

    console.log('\n🧪 Testando sistema refatorado...\n');

    // 2. Testar as novas funções
    console.log('📊 Verificando estatísticas...');
    const stats = await FCMDeviceService.getStats();
    
    if (stats) {
      console.log('✅ Sistema refatorado funcionando!');
      console.log('📈 Estatísticas atuais:');
      console.log(`   🔢 Total dispositivos: ${stats.total_devices}`);
      console.log(`   ✅ Dispositivos ativos: ${stats.active_devices}`);
      console.log(`   📱 Com FCM token: ${stats.devices_with_fcm}`);
      console.log(`   ⚠️ Sem FCM token: ${stats.devices_without_fcm}`);
      console.log(`   📋 Notificações pendentes: ${stats.total_pending}`);
      console.log(`   ✅ Notificações entregues: ${stats.total_delivered}`);
      console.log(`   ❌ Notificações com falha: ${stats.total_failed}`);
      console.log(`   🆕 FCM tokens atualizados hoje: ${stats.fcm_tokens_updated_today}`);
    } else {
      console.log('❌ Erro ao obter estatísticas - verifique se a migration foi aplicada corretamente');
      return;
    }

    // 3. Testar busca de dispositivos ativos
    console.log('\n📱 Verificando dispositivos ativos com FCM...');
    const activeDevices = await FCMDeviceService.getActiveDevicesWithFCM();
    console.log(`✅ Encontrados ${activeDevices.length} dispositivos ativos com FCM token`);
    
    if (activeDevices.length > 0) {
      console.log('📋 Primeiros dispositivos:');
      activeDevices.slice(0, 3).forEach((device, i) => {
        console.log(`   ${i + 1}. ${device.device_token} (FCM: ${device.fcm_token.substring(0, 20)}...)`);
      });
    }

    // 4. Testar busca de notificações pendentes
    console.log('\n📬 Verificando notificações pendentes...');
    const pendingNotifications = await FCMDeviceService.getPendingNotificationsWithFCM();
    console.log(`✅ Encontradas ${pendingNotifications.length} notificações pendentes com FCM token`);

    // 5. Testar processamento (se houver notificações)
    if (pendingNotifications.length > 0) {
      console.log('\n🚀 Iniciando teste de processamento...');
      const OptimizedProcessor = require('../src/services/optimizedFirebaseProcessor.js');
      
      const result = await OptimizedProcessor.processPendingNotifications();
      console.log('📊 Resultado do processamento:', result);
    } else {
      console.log('⚠️ Nenhuma notificação pendente para processar');
    }

    console.log('\n🎉 Sistema FCM refatorado e testado com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Teste o auto-registro acessando http://localhost:5173/');
    console.log('2. Permita notificações quando solicitado');
    console.log('3. Verifique se o FCM token foi capturado automaticamente');
    console.log('4. Execute o processador: npm run firebase:process:once');

  } catch (error) {
    console.error('❌ Erro durante refatoração:', error.message);
    console.log('\n🔍 Dicas para resolver:');
    console.log('1. Verifique se as variáveis de ambiente estão corretas');
    console.log('2. Confirme que a migration foi aplicada no Supabase');
    console.log('3. Verifique se o SUPABASE_SERVICE_ROLE_KEY está configurado');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  refactorDatabase();
}

module.exports = { refactorDatabase };