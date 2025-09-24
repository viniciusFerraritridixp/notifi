#!/usr/bin/env node
require('dotenv').config();

(async () => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('🔎 Debug pending_notifications -> device_registrations');

    const { data: pending, error: pendErr } = await supabase
      .from('pending_notifications')
      .select('id, device_token, delivered, delivery_attempts, error_message, notification_data')
      .eq('delivered', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (pendErr) {
      console.error('Erro ao buscar pending_notifications:', pendErr);
      process.exit(1);
    }

    if (!pending || pending.length === 0) {
      console.log('Nenhuma pending_notifications encontrada');
      process.exit(0);
    }

    for (const p of pending) {
      const { data: deviceRows, error: devErr } = await supabase
        .from('device_registrations')
        .select('id, device_token, fcm_token, is_active, last_seen')
        .eq('device_token', p.device_token)
        .limit(1);

      const device = (devErr || !deviceRows || deviceRows.length === 0) ? null : deviceRows[0];

      console.log(`ID:${p.id} device_token:${p.device_token} delivered:${p.delivered} attempts:${p.delivery_attempts} error:${p.error_message || '-'}\n  notification: ${JSON.stringify(p.notification_data)}\n  device: ${device ? JSON.stringify(device) : 'NÃO ENCONTRADO'}\n`);
    }

    process.exit(0);
  } catch (e) {
    console.error('Erro inesperado:', e);
    process.exit(2);
  }
})();
