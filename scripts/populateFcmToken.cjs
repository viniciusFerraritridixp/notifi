#!/usr/bin/env node
require('dotenv').config();

// Script para popular fcm_token com token válido do Firebase
// Uso: node populateFcmToken.cjs <device_token> [fcm_token]
// Se fcm_token não for fornecido, o script tentará obter automaticamente

async function main() {
  const argv = require('minimist')(process.argv.slice(2));
  const deviceToken = argv['device-token'] || argv['_'][0];
  const fcmToken = argv['fcm-token'] || argv['_'][1];

  if (!deviceToken) {
    console.error('Uso: node populateFcmToken.cjs --device-token <device_token> [--fcm-token <fcm_token>]');
    console.error('  ou: node populateFcmToken.cjs <device_token> [fcm_token]');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log(`🔄 Processando device_token: ${deviceToken}`);

  // Verificar se device existe
  const { data: device, error: deviceError } = await supabase
    .from('device_registrations')
    .select('id, device_token, fcm_token, user_agent, platform, is_ios')
    .eq('device_token', deviceToken)
    .single();

  if (deviceError || !device) {
    console.error('❌ Device não encontrado:', deviceError);
    process.exit(2);
  }

  console.log('📱 Device encontrado:', {
    id: device.id,
    platform: device.platform,
    is_ios: device.is_ios,
    current_fcm: device.fcm_token ? device.fcm_token.substring(0, 20) + '...' : 'null'
  });

  let validFcmToken = fcmToken;

  if (!validFcmToken) {
    console.log('🔄 Tentando gerar/obter FCM token automaticamente...');
    
    // Para automação do servidor, precisamos de um token válido
    // Como não podemos gerar FCM token no servidor (precisa do cliente/browser),
    // vamos solicitar ao usuário
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n📝 Para popular o fcm_token, você precisa:');
    console.log('1. Abrir o PWA/site no dispositivo');
    console.log('2. No console devtools, executar:');
    console.log('   (async () => {');
    console.log('     const { FirebaseNotificationService } = await import("/src/lib/firebase.js");');
    console.log('     const token = await FirebaseNotificationService.requestPermissionAndGetToken();');
    console.log('     console.log("FCM Token:", token);');
    console.log('   })();');
    console.log('3. Copiar o token retornado e colar aqui\n');

    validFcmToken = await question('Cole o FCM token aqui: ');
    rl.close();

    if (!validFcmToken || validFcmToken.trim().length === 0) {
      console.error('❌ Token FCM não fornecido');
      process.exit(3);
    }

    validFcmToken = validFcmToken.trim();
  }

  // Validar formato do token FCM (básico)
  if (validFcmToken.startsWith('dt_') || validFcmToken.length < 20) {
    console.error('❌ Token FCM parece inválido (muito curto ou começa com dt_)');
    process.exit(4);
  }

  console.log(`🔄 Atualizando fcm_token para: ${validFcmToken.substring(0, 20)}...`);

  // Atualizar no banco
  const { data: updated, error: updateError } = await supabase
    .from('device_registrations')
    .update({
      fcm_token: validFcmToken,
      updated_at: new Date().toISOString()
    })
    .eq('device_token', deviceToken)
    .select();

  if (updateError) {
    console.error('❌ Erro ao atualizar fcm_token:', updateError);
    process.exit(5);
  }

  console.log('✅ fcm_token atualizado com sucesso!');
  console.log('📊 Registro atualizado:', {
    id: updated[0].id,
    device_token: updated[0].device_token,
    fcm_token: updated[0].fcm_token.substring(0, 20) + '...'
  });

  // Validar com Firebase Admin (opcional)
  try {
    const FirebaseAdminService = await import('../src/lib/firebase-admin.js');
    const isValid = await FirebaseAdminService.default.validateToken(validFcmToken);
    console.log(`🔍 Validação do token: ${isValid ? '✅ Válido' : '⚠️ Pode ser inválido'}`);
  } catch (e) {
    console.warn('⚠️ Não foi possível validar token com Firebase Admin:', e.message);
  }

  console.log('\n🚀 Próximos passos:');
  console.log('1. Execute: npm run firebase:process:once');
  console.log('2. Verifique se as notificações foram enviadas');

  process.exit(0);
}

main().catch(e => {
  console.error('💥 Erro inesperado:', e);
  process.exit(99);
});