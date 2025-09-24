#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function main() {
  const argv = require('minimist')(process.argv.slice(2));
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Usage:
  // node setFcmForDevice.cjs --device-token dt_xxx --fcm-token AAA
  // node setFcmForDevice.cjs --map-file ./mapping.json
  // node setFcmForDevice.cjs  (interactive)

  if (argv['map-file']) {
    const mapPath = path.resolve(process.cwd(), argv['map-file']);
    if (!fs.existsSync(mapPath)) {
      console.error('Arquivo de mapeamento não encontrado:', mapPath);
      process.exit(1);
    }

    const raw = fs.readFileSync(mapPath, 'utf8');
    let mapping;
    try {
      mapping = JSON.parse(raw);
    } catch (e) {
      console.error('Erro ao parsear JSON:', e.message);
      process.exit(1);
    }

    // Expected format: { "dt_...": "fcm_token_value", ... }
    const keys = Object.keys(mapping);
    console.log(`Encontrados ${keys.length} entradas no mapeamento. Iniciando updates...`);

    for (const deviceToken of keys) {
      const fcm = mapping[deviceToken];
      await updateDevice(deviceToken, fcm, supabase);
    }

    console.log('Atualizações concluídas.');
    process.exit(0);
  }

  if (argv['device-token'] && argv['fcm-token']) {
    await updateDevice(argv['device-token'], argv['fcm-token'], supabase);
    process.exit(0);
  }

  // Interactive mode: list devices without fcm_token and ask user
  const { data: devices, error } = await supabase
    .from('device_registrations')
    .select('id, device_token, user_agent, platform, last_seen')
    .is('fcm_token', null)
    .order('last_seen', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Erro ao buscar devices sem fcm_token:', error);
    process.exit(1);
  }

  if (!devices || devices.length === 0) {
    console.log('Nenhum device sem fcm_token encontrado. Nada a fazer.');
    process.exit(0);
  }

  console.log('Devices sem fcm_token (últimos 50):');
  devices.forEach((d, i) => {
    console.log(`${i}) id:${d.id} token:${d.device_token} last_seen:${d.last_seen} platform:${d.platform}`);
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const question = (q) => new Promise(resolve => rl.question(q, resolve));

  while (true) {
    const idx = await question('\nDigite o número do device para setar fcm_token (ou "q" para sair): ');
    if (!idx) continue;
    if (idx.trim().toLowerCase() === 'q') break;
    const i = parseInt(idx, 10);
    if (Number.isNaN(i) || i < 0 || i >= devices.length) {
      console.log('Índice inválido');
      continue;
    }

    const device = devices[i];
    const fcm = await question(`Insira o fcm_token para device_token ${device.device_token}: `);
    if (!fcm || fcm.trim().length === 0) {
      console.log('fcm_token inválido, tentando novamente');
      continue;
    }

    await updateDevice(device.device_token, fcm.trim(), supabase);
  }

  rl.close();
  process.exit(0);
}

async function updateDevice(deviceToken, fcmToken, supabase) {
  try {
    console.log(`Atualizando device ${deviceToken} -> fcm_token=${fcmToken.substring(0,20)}...`);
    const { data, error } = await supabase
      .from('device_registrations')
      .update({ fcm_token: fcmToken, updated_at: new Date().toISOString() })
      .eq('device_token', deviceToken)
      .select();

    if (error) {
      console.error('Erro ao atualizar device:', error);
      return false;
    }

    if (!data || data.length === 0) {
      console.warn('Nenhum registro atualizado (device_token não encontrado)');
      return false;
    }

    console.log('✅ Atualizado com sucesso. id:', data[0].id);
    return true;
  } catch (e) {
    console.error('Erro inesperado no updateDevice:', e);
    return false;
  }
}

main();
