const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applySqlFix() {
  console.log('🔧 Aplicando correção SQL usando queries individuais...\n');
  
  try {
    // 1. Primeiro, vamos remover o trigger atual (se existir)
    console.log('1. Removendo trigger atual...');
    
    // Como não temos exec_sql, vamos usar uma abordagem diferente
    // Vamos tentar atualizar uma notificação e ver se dá erro
    
    console.log('🧪 Testando o trigger atual...');
    
    // Buscar uma notificação para testar
    const { data: testPending } = await supabase
      .from('pending_notifications')
      .select('*')
      .eq('delivered', false)
      .limit(1);
    
    if (testPending && testPending.length > 0) {
      const notification = testPending[0];
      console.log(`📝 Testando com notificação ID: ${notification.id}`);
      
      // Tentar marcar como delivered para ver se o trigger atual dá erro
      const { error: triggerError } = await supabase
        .from('pending_notifications')
        .update({ 
          delivered: true, 
          delivered_at: new Date().toISOString(),
          // Forçar um update mesmo se já estiver delivered
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      
      if (triggerError) {
        console.log('❌ Erro do trigger atual (esperado):', triggerError.message);
        console.log('   Isso confirma que precisamos corrigir o trigger.\n');
        
        // Reverter a mudança
        await supabase
          .from('pending_notifications')
          .update({ delivered: false, delivered_at: null })
          .eq('id', notification.id);
          
        console.log('✅ Revertido para continuar teste');
      } else {
        console.log('✅ Trigger atual funcionou ou não existe');
        
        // Verificar se criou log
        const { data: logs } = await supabase
          .from('notification_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        
        console.log('📝 Últimos logs:', logs);
      }
    }
    
    // 2. Como não podemos executar DDL via supabase-js, vamos documentar os comandos
    console.log('\n📋 IMPORTANTE: Execute os seguintes comandos SQL no painel do Supabase:');
    console.log('=' .repeat(80));
    
    const sqlCommands = [
      "DROP TRIGGER IF EXISTS trigger_log_notification_delivery ON pending_notifications;",
      "DROP FUNCTION IF EXISTS log_notification_delivery();",
      `CREATE OR REPLACE FUNCTION log_notification_delivery()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.delivered = true AND (OLD.delivered IS NULL OR OLD.delivered = false) THEN
        INSERT INTO notification_logs (
            sale_id, tipo, subscriptions_enviadas, sucessos, falhas, payload, created_at
        )
        VALUES (
            COALESCE(NEW.sale_id, 0),
            'firebase_delivered',
            1, 1, 0,
            jsonb_build_object(
                'notification_id', NEW.id,
                'device_token', NEW.device_token,
                'fcm_token', NEW.fcm_token,
                'title', NEW.title,
                'body', NEW.body,
                'delivered_at', now(),
                'method', 'firebase_admin'
            ),
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`,
      "CREATE TRIGGER trigger_log_notification_delivery AFTER UPDATE ON pending_notifications FOR EACH ROW EXECUTE FUNCTION log_notification_delivery();"
    ];
    
    sqlCommands.forEach((cmd, i) => {
      console.log(`\n-- Comando ${i + 1}:`);
      console.log(cmd);
    });
    
    console.log('\n=' .repeat(80));
    console.log('📝 Copie e cole esses comandos no SQL Editor do Supabase Dashboard');
    console.log('🌐 URL: https://supabase.com/dashboard/project/[seu-projeto]/sql');
    console.log('\nApós executar, rode novamente o processamento das notificações.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

applySqlFix();