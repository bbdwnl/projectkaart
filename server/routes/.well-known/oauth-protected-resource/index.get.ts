import { resourceMetadata } from '../../../mcp/oauth'

// RFC 9728: bij welke autorisatieserver /api/mcp hoort. Openbaar, zonder inlog.
export default defineEventHandler((event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return resourceMetadata(appAdres(event))
})
