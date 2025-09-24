#!/usr/bin/env node
require('dotenv').config();

(async () => {
  try {
    const argv = require('minimist')(process.argv.slice(2));
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const src = argv['src'] || argv['_'][0];
    const dst = argv['dst'] || argv['_'][1];

    if (!src || !dst) {
      console.error('Uso: node duplicatePendingToDevice.cjs --src <source_device_token> --dst <target_device_token>');
      process.exit(1);
    }

    console.log(`Duplicando pending_notifications de ${src} -> ${dst} ...`);

    const { data: pendings, error } = await supabase
      .from('pending_notifications')
      .select('*')
      .eq('device_token', src)
      .eq('delivered', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar pendings:', error);
      process.exit(2);
    }

    if (!pendings || pendings.length === 0) {
      console.log('Nenhuma pending notification encontrada para duplicar.');
      process.exit(0);
    }

    const inserts = pendings.map(p => ({
      device_token: dst,
      notification_data: p.notification_data,
      delivery_method: p.delivery_method || 'firebase_fcm',
      created_at: new Date().toISOString(),
      delivery_attempts: 0,
      delivered: false
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('pending_notifications')
      .insert(inserts)
      .select();

    if (insertErr) {
      console.error('Erro ao inserir duplicatas:', insertErr);
      process.exit(3);
    }

    console.log(`✅ Inseridas ${inserted.length} duplicatas para ${dst}`);
    inserted.forEach(i => console.log(`  id:${i.id}`));

    process.exit(0);
  } catch (e) {
    console.error('Erro inesperado:', e);
    process.exit(4);
  }
})();
