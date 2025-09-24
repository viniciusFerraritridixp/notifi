#!/usr/bin/env node

// Versão CommonJS do processador Firebase
require('dotenv').config();

console.log('🚀 Testando configuração Firebase...\n');

// Verificar variáveis de ambiente necessárias
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL'
];

console.log('📋 Verificando variáveis de ambiente...');

const missingEnvVars = requiredEnvVars.filter(envVar => {
  const hasVar = !!process.env[envVar];
  console.log(`   ${hasVar ? '✅' : '❌'} ${envVar}: ${hasVar ? 'OK' : 'MISSING'}`);
  return !hasVar;
});

if (missingEnvVars.length > 0) {
  console.error('\n❌ Variáveis de ambiente faltando:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('\n💡 Configure as variáveis no arquivo .env');
  console.error('📖 Veja: FIREBASE_SETUP.md para instruções completas');
  process.exit(1);
}

console.log('\n✅ Todas as variáveis de ambiente estão configuradas!');

// Testar conexão com Supabase
async function testSupabaseConnection() {
  try {
    console.log('\n🔄 Testando conexão com Supabase...');
    
    // Usar dynamic import para @supabase/supabase-js
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Testar query simples (mais compatível)
    const { data, error, status } = await supabase
      .from('device_registrations')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Erro ao conectar com Supabase:');
      console.error(error);
      try {
        // tentar imprimir detalhes estruturados
        console.error('Detalhes (JSON):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        // ignora
      }
      // --- fallback debug: tentar chamada HTTP direta ao REST API do Supabase ---
      try {
        console.log('\n🔎 Tentando fallback: chamada direta ao endpoint REST do Supabase...');
        const fetch = globalThis.fetch || (await import('node:fetch')).default;
        const url = process.env.VITE_SUPABASE_URL.replace(/\/$/, '');
        const endpoint = `${url}/rest/v1/device_registrations?select=id&limit=1`;
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            Accept: 'application/json'
          },
          // timeout is not standard in fetch; rely on default
        });
        const body = await res.text();
        console.log(`   Fallback HTTP status: ${res.status}`);
        console.log('   Fallback response body:', body);
      } catch (e) {
        console.error('   Fallback falhou:', e && e.message ? e.message : e);
      }

      return false;
    }

    console.log('✅ Conexão com Supabase OK');
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão Supabase:');
    console.error(error);
    try {
      console.error('Detalhes (JSON):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {}
    return false;
  }
}

// Testar configuração Firebase Admin
async function testFirebaseConfig() {
  try {
    console.log('\n🔄 Testando configuração Firebase Admin...');
    
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };

    // Verificar se as configurações básicas estão presentes
    if (!serviceAccount.project_id) {
      throw new Error('FIREBASE_PROJECT_ID não configurado');
    }
    
    if (!serviceAccount.private_key) {
      throw new Error('FIREBASE_PRIVATE_KEY não configurado');
    }
    
    if (!serviceAccount.client_email) {
      throw new Error('FIREBASE_CLIENT_EMAIL não configurado');
    }

    console.log('✅ Configuração Firebase OK');
    console.log(`   📱 Projeto: ${serviceAccount.project_id}`);
    console.log(`   📧 Email: ${serviceAccount.client_email}`);
    
    return true;
  } catch (error) {
    console.error('❌ Erro na configuração Firebase:', error.message);
    return false;
  }
}

// Simular processamento de notificações
async function simulateProcessing() {
  try {
    console.log('\n🔄 Simulando processamento de notificações...');
    
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Buscar notificações pendentes
    const { data: pendingNotifications, error } = await supabase
      .from('pending_notifications')
      .select('id, device_token, notification_data, delivery_attempts')
      .eq('delivered', false)
      .lt('delivery_attempts', 3)
      .limit(5);

    if (error) {
      console.error('❌ Erro ao buscar notificações:', error.message);
      return false;
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('ℹ️  Nenhuma notificação pendente encontrada');
      
      // Verificar se a tabela existe
      const { data: stats } = await supabase
        .from('device_registrations')
        .select('count(*)', { count: 'exact', head: true });
        
      console.log('📊 Para testar, adicione algumas notificações pendentes');
      console.log('💡 Use o componente FirebaseNotificationManager no seu app');
      return true;
    }

    console.log(`📊 Encontradas ${pendingNotifications.length} notificações pendentes:`);
    
    pendingNotifications.forEach((notification, index) => {
      console.log(`   ${index + 1}. ID: ${notification.id} | Device: ${notification.device_token?.substring(0, 10)}... | Tentativas: ${notification.delivery_attempts}`);
    });

    console.log('\n✅ Sistema pronto para processar notificações!');
    console.log('🚀 Para usar em produção:');
    console.log('   1. Configure as credenciais Firebase completas');
    console.log('   2. Execute: npm run firebase:process');
    console.log('   3. O processador rodará continuamente');
    
    return true;
  } catch (error) {
    console.error('❌ Erro na simulação:', error.message);
    return false;
  }
}

// Função principal
async function main() {
  try {
    console.log('📱 Verificador de Configuração Firebase\n');
    
    const supabaseOK = await testSupabaseConnection();
    const firebaseOK = await testFirebaseConfig();
    
    if (supabaseOK && firebaseOK) {
      await simulateProcessing();
      
      console.log('\n🎉 Configuração verificada com sucesso!');
      console.log('\n📖 Próximos passos:');
      console.log('   1. Configure o Frontend: src/components/FirebaseNotificationManager.jsx');
      console.log('   2. Execute: npm run dev');
      console.log('   3. Registre um dispositivo no PWA');
      console.log('   4. Inicie o processador: npm run firebase:process');
      console.log('\n📚 Documentação: FIREBASE_SETUP.md');
    } else {
      console.log('\n❌ Configuração incompleta. Verifique os erros acima.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

// Executar
main();