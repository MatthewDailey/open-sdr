/**
 * @fileoverview Initializes and starts the main application server, listening on a specified port.
 */

import { createApp } from './app'
import { getToolsLazy } from './singleton_mcp_server'

const app = await createApp()

const port = process.env.PORT || 3000

setTimeout(async () => {
  await getToolsLazy()
  console.log('Tools loaded on server start')
}, 2000)

app.listen(port, () => {
  console.log(`Listening on port http://localhost:${port}`)
})
