import { buildApp } from './app.js'
import { config } from './config.js'

const app = await buildApp()

await app.listen({ port: config.API_PORT, host: config.API_HOST })
console.log(`API running at http://${config.API_HOST}:${config.API_PORT}`)
