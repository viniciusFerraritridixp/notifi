// Script para configurar automaticamente as chaves VAPID no .env
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

try {
  // Ler as chaves VAPID existentes
  const vapidKeysPath = join(process.cwd(), 'vapid-keys.json')
  const vapidKeys = JSON.parse(readFileSync(vapidKeysPath, 'utf-8'))
  
  // Ler o arquivo .env atual
  const envPath = join(process.cwd(), '.env')
  let envContent = ''
  
  try {
    envContent = readFileSync(envPath, 'utf-8')
  } catch (error) {
    console.log('.env não encontrado, criando novo arquivo...')
  }
  
  // Atualizar as chaves VAPID no .env
  const lines = envContent.split('\n')
  let updatedLines = []
  let foundPublicKey = false
  let foundPrivateKey = false
  
  for (const line of lines) {
    if (line.startsWith('VITE_VAPID_PUBLIC_KEY=')) {
      updatedLines.push(`VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
      foundPublicKey = true
    } else if (line.startsWith('VAPID_PRIVATE_KEY=')) {
      updatedLines.push(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
      foundPrivateKey = true
    } else if (line.trim() !== '') {
      updatedLines.push(line)
    }
  }
  
  // Adicionar chaves se não foram encontradas
  if (!foundPublicKey) {
    updatedLines.push(`VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
  }
  if (!foundPrivateKey) {
    updatedLines.push(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
  }
  
  // Adicionar outras variáveis de ambiente necessárias se não existirem
  const requiredVars = [
    'VITE_SUPABASE_URL=your_supabase_url_here',
    'VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here',
    'VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here'
  ]
  
  for (const envVar of requiredVars) {
    const varName = envVar.split('=')[0]
    const exists = updatedLines.some(line => line.startsWith(varName + '='))
    if (!exists) {
      updatedLines.push(envVar)
    }
  }
  
  // Escrever o arquivo .env atualizado
  writeFileSync(envPath, updatedLines.join('\n') + '\n')
  
  console.log('✅ Arquivo .env atualizado com sucesso!')
  console.log('📋 Próximos passos:')
  console.log('1. Configure suas variáveis do Supabase no arquivo .env')
  console.log('2. Execute as migrations SQL no seu projeto Supabase')
  console.log('3. Faça deploy da Edge Function no Supabase')
  console.log('4. Teste o sistema de notificações')
  
} catch (error) {
  console.error('❌ Erro ao configurar .env:', error.message)
  process.exit(1)
}