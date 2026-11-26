import { serverMetadata } from '../../../mcp/oauth'

// RFC 8414: waar Copilot inlogt, tokens haalt en zich registreert. Openbaar, zonder inlog.
export default defineEventHandler((event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return serverMetadata(appAdres(event))
})
