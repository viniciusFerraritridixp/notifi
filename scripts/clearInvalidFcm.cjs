#!/usr/bin/env node
require('dotenv').config();

(async () => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const deviceToken = process.argv[2];
    if (!deviceToken) {
      console.error('Uso: node clearInvalidFcm.cjs <device_token>');
      process.exit(1);
    }

    console.log('Limpando fcm_token para device_token:', deviceToken);
    const { data, error } = await supabase
      .from('device_registrations')
      .update({ fcm_token: null, updated_at: new Date().toISOString() })
      .eq('device_token', deviceToken)
      .select();

    if (error) {
      console.error('Erro ao limpar fcm_token:', error);
      process.exit(2);
    }

    console.log('✅ Atualizado:', data);
    process.exit(0);
  } catch (e) {
    console.error('Erro inesperado:', e);
    process.exit(3);
  }
})();
