import { buildApp } from './app.js'
import { config } from './config.js'
import { notificationWorker, domainWorker, startReconciliation } from './queues/worker.js'

const app = await buildApp()

await app.listen({ port: config.API_PORT, host: config.API_HOST })
console.log(`API running at http://${config.API_HOST}:${config.API_PORT}`)

// Start BullMQ workers
notificationWorker.on('ready', () => app.log.info('Notification worker ready'))
domainWorker.on('ready', () => app.log.info('Domain jobs worker ready'))
startReconciliation()

// Graceful shutdown
const stop = async () => {
  await Promise.all([notificationWorker.close(), domainWorker.close()])
  await app.close()
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
