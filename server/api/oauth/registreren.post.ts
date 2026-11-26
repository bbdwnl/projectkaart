// OAuth: een client registreert zich (RFC 7591). Copilot Studio ("Dynamic discovery") en VS Code doen dit zelf.
export default defineEventHandler(async (event) => {
  try {
    return await registreer(event)
  } catch (e) {
    return oauthAntwoord(event, e)
  }
})
