const OptimizedProcessor = require('../src/services/optimizedFirebaseProcessor.js');
const FCMDeviceService = require('../src/services/fcmDeviceService.cjs');
require('dotenv').config();

async function testOptimizedProcessor() {
  console.log('🧪 Testando processador otimizado Firebase...\n');

  try {
    // 1. Verificar estatísticas atuais
    console.log('📊 Verificando estatísticas atuais...');
    const stats = await FCMDeviceService.getStats();
    
    if (!stats) {
      console.log('❌ Não foi possível obter estatísticas. Verifique se a migration foi aplicada.');
      return;
    }

    console.log('📈 Estatísticas:');
    console.log(`   Dispositivos ativos: ${stats.active_devices}`);
    console.log(`   Com FCM token: ${stats.devices_with_fcm}`);
    console.log(`   Notificações pendentes: ${stats.total_pending}`);
    console.log(`   Notificações entregues: ${stats.total_delivered}\n`);

    // 2. Listar dispositivos com FCM
    if (stats.devices_with_fcm > 0) {
      console.log('📱 Dispositivos com FCM token:');
      const devices = await FCMDeviceService.getActiveDevicesWithFCM();
      devices.forEach((device, i) => {
        console.log(`   ${i + 1}. ${device.device_token}`);
        console.log(`      FCM: ${device.fcm_token.substring(0, 30)}...`);
        console.log(`      Mobile: ${device.is_mobile ? '📱' : '🖥️'} iOS: ${device.is_ios ? '🍎' : '🤖'}`);
        console.log(`      Atualizado: ${new Date(device.fcm_token_updated_at).toLocaleString()}\n`);
      });
    }

    // 3. Verificar notificações pendentes
    console.log('📬 Buscando notificações pendentes com FCM...');
    const pending = await FCMDeviceService.getPendingNotificationsWithFCM();
    
    if (pending.length === 0) {
      console.log('✅ Nenhuma notificação pendente com FCM token disponível');
      console.log('\n💡 Para testar, você pode:');
      console.log('1. Adicionar uma notificação pendente manualmente');
      console.log('2. Garantir que pelo menos um dispositivo tenha FCM token');
      return;
    }

    console.log(`📋 Encontradas ${pending.length} notificações prontas para envio:`);
    pending.slice(0, 3).forEach((notif, i) => {
      console.log(`   ${i + 1}. ID: ${notif.notification_id}`);
      console.log(`      Dispositivo: ${notif.device_token}`);
      console.log(`      Título: ${notif.title}`);
      console.log(`      FCM: ${notif.fcm_token ? notif.fcm_token.substring(0, 20) + '...' : 'N/A'}`);
    });

    // 4. Executar processamento
    console.log('\n🚀 Executando processamento otimizado...');
    const result = await OptimizedProcessor.processPendingNotifications();

    console.log('\n📊 Resultado do processamento:');
    console.log(`   ✅ Processadas: ${result.processed}`);
    console.log(`   📤 Enviadas: ${result.sent}`);
    console.log(`   ❌ Falharam: ${result.failed}`);
    console.log(`   ⏭️ Ignoradas: ${result.skipped}`);

    // 5. Verificar estatísticas após processamento
    console.log('\n📈 Estatísticas após processamento:');
    const newStats = await FCMDeviceService.getStats();
    console.log(`   Notificações pendentes: ${newStats.total_pending} (antes: ${stats.total_pending})`);
    console.log(`   Notificações entregues: ${newStats.total_delivered} (antes: ${stats.total_delivered})`);

    // 6. Executar manutenção
    console.log('\n🧹 Executando manutenção do sistema...');
    const maintenance = await OptimizedProcessor.runMaintenance();
    console.log(`   Dispositivos ativos: ${maintenance.activeDevices}`);
    console.log(`   Tokens antigos: ${maintenance.oldTokens}`);

    console.log('\n✅ Teste do processador otimizado concluído com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro durante teste:', error.message);
    console.log('\n🔍 Possíveis causas:');
    console.log('1. Migration não foi aplicada corretamente');
    console.log('2. Problemas de configuração Firebase');
    console.log('3. Variáveis de ambiente incorretas');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testOptimizedProcessor();
}

module.exports = { testOptimizedProcessor };