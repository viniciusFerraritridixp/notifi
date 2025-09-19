const webpush = require('web-push')
const fs = require('fs')

;(async () => {
  try {
    const keys = webpush.generateVAPIDKeys()
    fs.writeFileSync('vapid-keys.json', JSON.stringify(keys, null, 2))
    console.log('VAPID keys geradas e salvas em vapid-keys.json')
    console.log(keys)
  } catch (err) {
    console.error('Erro ao gerar VAPID keys', err)
    process.exit(1)
  }
})()
