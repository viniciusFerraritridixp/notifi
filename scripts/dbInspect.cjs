#!/usr/bin/env node
require('dotenv').config();

(async () => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('🔎 Inspecting Supabase: get_notification_stats RPC (if exists) and fcm_token summary\n');

    // Try RPC
    try {
      const { data: stats, error: rpcError } = await supabase.rpc('get_notification_stats');
      if (rpcError) {
        console.log('ℹ️  get_notification_stats RPC not available or errored:');
        console.error(rpcError);
      } else {
        console.log('📊 get_notification_stats result:');
        console.log(JSON.stringify(stats, null, 2));
      }
    } catch (e) {
      console.error('Erro ao chamar RPC get_notification_stats:', e.message || e);
    }

    // Count device_registrations with/without fcm_token
    const { data: counts, error: countErr } = await supabase
      .from('device_registrations')
      .select('count:fcm_non_null, total:count(*)', { count: 'exact', head: true });

    // Fallback: run two queries
    const { count: nonNullCount } = await supabase
      .from('device_registrations')
      .select('fcm_token', { count: 'exact', head: true })
      .neq('fcm_token', null);

    const { count: totalCount } = await supabase
      .from('device_registrations')
      .select('id', { count: 'exact', head: true });

    console.log('\n📌 device_registrations counts:');
    console.log(`   total: ${totalCount}`);
    console.log(`   with fcm_token (non-null): ${nonNullCount}`);

    // Show up to 5 devices with fcm_token
    const { data: devices, error: devErr } = await supabase
      .from('device_registrations')
      .select('id, device_token, fcm_token, is_active, last_seen')
      .neq('fcm_token', null)
      .limit(5);

    if (devErr) {
      console.error('Erro ao buscar devices com fcm_token:', devErr);
    } else if (devices && devices.length > 0) {
      console.log('\n🔎 Exemplos de device_registrations com fcm_token:');
      devices.forEach(d => console.log(`   id:${d.id} token:${d.device_token} fcm:${d.fcm_token.substring(0,20)}... active:${d.is_active}`));
    } else {
      console.log('\nℹ️  Nenhum device com fcm_token encontrado.');
    }

    process.exit(0);
  } catch (e) {
    console.error('Erro inesperado:', e);
    process.exit(2);
  }
})();
