// OAuth: tokens voor Copilot, met een code (na Toestaan op /koppelen, met PKCE) of met het refresh token.
export default defineEventHandler(async (event) => {
  try {
    const antwoord = await geefToken(event)
    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'Pragma', 'no-cache')
    return antwoord
  } catch (e) {
    return oauthAntwoord(event, e)
  }
})
