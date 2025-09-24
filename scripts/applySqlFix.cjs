const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applySqlFix() {
  console.log('🔧 Aplicando correção SQL para o trigger...\n');
  
  try {
    // Ler o arquivo SQL
    const sqlContent = fs.readFileSync('./fix-trigger-sql-error.sql', 'utf8');
    
    // Dividir em comandos separados
    const sqlCommands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--') && cmd !== '');
    
    console.log(`📝 Executando ${sqlCommands.length} comandos SQL...\n`);
    
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      console.log(`[${i + 1}/${sqlCommands.length}] Executando: ${command.substring(0, 50)}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: command
        });
        
        if (error) {
          console.log(`❌ Erro no comando ${i + 1}:`, error.message);
        } else {
          console.log(`✅ Comando ${i + 1} executado com sucesso`);
          if (data && data.length > 0) {
            console.log('   Resultado:', data);
          }
        }
      } catch (err) {
        console.log(`❌ Exceção no comando ${i + 1}:`, err.message);
      }
      
      console.log('');
    }
    
    console.log('🎉 Correção SQL aplicada!\n');
    
    // Testar se o trigger funciona agora
    console.log('🧪 Testando o trigger...');
    
    // Buscar uma notificação pending para testar
    const { data: pending } = await supabase
      .from('pending_notifications')
      .select('*')
      .eq('delivered', false)
      .limit(1);
    
    if (pending && pending.length > 0) {
      const testNotification = pending[0];
      console.log(`📝 Testando com notificação ID: ${testNotification.id}`);
      
      // Marcar como delivered para testar o trigger
      const { error: updateError } = await supabase
        .from('pending_notifications')
        .update({ delivered: true, delivered_at: new Date().toISOString() })
        .eq('id', testNotification.id);
      
      if (updateError) {
        console.log('❌ Erro ao testar trigger:', updateError.message);
      } else {
        console.log('✅ Trigger testado com sucesso! Verificando log...');
        
        // Verificar se foi criado um log
        const { data: logs } = await supabase
          .from('notification_logs')
          .select('*')
          .eq('tipo', 'firebase_delivered')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (logs && logs.length > 0) {
          console.log('✅ Log criado com sucesso:', logs[0]);
        } else {
          console.log('⚠️ Nenhum log encontrado (pode ser normal se não houve trigger)');
        }
      }
    } else {
      console.log('⚠️ Nenhuma notificação pending encontrada para testar');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

applySqlFix();