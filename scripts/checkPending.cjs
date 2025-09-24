#!/usr/bin/env node

require('dotenv').config();

(async () => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('🔎 Consultando pending_notifications (últimos 10) ...\n');

    const { data, error } = await supabase
      .from('pending_notifications')
      .select('id, delivered, delivery_attempts, error_message, notification_data')
      .order('id', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erro ao buscar pending_notifications:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('ℹ️  Nenhuma notificação encontrada.');
      process.exit(0);
    }

    data.forEach((row) => {
      console.log(`ID: ${row.id} | delivered: ${row.delivered} | attempts: ${row.delivery_attempts} | error: ${row.error_message || '-'}\n    data: ${JSON.stringify(row.notification_data).substring(0,200)}\n`);
    });

    process.exit(0);
  } catch (e) {
    console.error('Erro inesperado:', e);
    process.exit(2);
  }
})();
