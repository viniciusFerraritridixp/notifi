import FCMDeviceService from '../../services/fcmDeviceService.js'

export async function post(req, res) {
  try {
    const body = req.body || (await new Promise((r) => {
      let data = ''
      req.on('data', chunk => data += chunk)
      req.on('end', () => r(JSON.parse(data)))
    }))

    const {
      device_token,
      fcm_token,
      user_agent,
      platform,
      is_ios,
      is_mobile,
      language,
      timezone,
      screen_resolution,
      url
    } = body

    if (!device_token) {
      return res.status(400).json({ success: false, error: 'device_token is required' })
    }

    console.log(`🔄 [Register Device] Processando: ${device_token}${fcm_token ? ' (com FCM)' : ' (sem FCM)'}`)

    // Usar o novo serviço FCM otimizado
    const deviceData = {
      device_token,
      fcm_token,
      user_agent,
      platform,
      is_ios,
      is_mobile,
      language,
      timezone,
      screen_resolution,
      url
    }

    const result = await FCMDeviceService.upsertDevice(deviceData)

    if (!result) {
      return res.status(500).json({ success: false, error: 'Falha ao registrar dispositivo' })
    }

    console.log(`✅ [Register Device] Dispositivo ${result.was_created ? 'criado' : 'atualizado'}: ${device_token}`)

    return res.status(200).json({ 
      success: true, 
      data: result,
      message: `Dispositivo ${result.was_created ? 'criado' : 'atualizado'} com sucesso`
    })

  } catch (err) {
    console.error('[register-device] error', err)
    return res.status(500).json({ success: false, error: String(err) })
  }
}

export async function handler(req, res) {
  if (req.method === 'POST') return post(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

export default handler
