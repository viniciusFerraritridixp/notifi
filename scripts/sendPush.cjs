const webpush = require('web-push')
const fs = require('fs')

const subscriptionPath = process.argv[2] || 'subscription.json'
const vapidPath = process.argv[3] || 'vapid-keys.json'

if (!fs.existsSync(subscriptionPath)) {
  console.error(`Arquivo de subscription não encontrado: ${subscriptionPath}`)
  console.error('Rode o app, copie a subscription do console (navigator.serviceWorker.ready.then((r)=>r.pushManager.getSubscription())) e salve como subscription.json')
  process.exit(1)
}

if (!fs.existsSync(vapidPath)) {
  console.error(`Arquivo de VAPID keys não encontrado: ${vapidPath}`)
  console.error('Gere as chaves com: npm run vapid:generate')
  process.exit(1)
}

const subscription = JSON.parse(fs.readFileSync(subscriptionPath))
const vapid = JSON.parse(fs.readFileSync(vapidPath))

webpush.setVapidDetails(
  'mailto:dev@example.com',
  vapid.publicKey,
  vapid.privateKey
)

const payload = JSON.stringify({
  title: 'Teste Push',
  body: 'Esta é uma notificação enviada pelo servidor de teste',
  url: '/',
  timestamp: Date.now()
})

webpush.sendNotification(subscription, payload).then(() => {
  console.log('Push enviado com sucesso')
}).catch((err) => {
  console.error('Erro ao enviar push:', err)
})
