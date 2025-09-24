#!/usr/bin/env node
require('dotenv').config();

(async () => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('🔎 Procurando fcm_token que parecem inválidos (ex.: começam com dt_)');

    const { data, error } = await supabase
      .from('device_registrations')
      .select('id, device_token, fcm_token, last_seen')
      .ilike('fcm_token', 'dt_%')
      .order('last_seen', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Erro ao buscar registros:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('✅ Nenhum fcm_token com prefixo dt_ encontrado.');
      process.exit(0);
    }

    console.log(`⚠️ Encontrados ${data.length} registros com fcm_token inválido:`);
    data.forEach(d => console.log(`  id:${d.id} device_token:${d.device_token} fcm_token:${d.fcm_token} last_seen:${d.last_seen}`));

    process.exit(0);
  } catch (e) {
    console.error('Erro inesperado:', e);
    process.exit(2);
  }
})();
