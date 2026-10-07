// Controleert het wachtwoord van de proefversie en zet dan een cookie (30 dagen).
export default defineEventHandler(async (event) => {
  const wachtwoord = useRuntimeConfig(event).proefWachtwoord
  if (!wachtwoord) return { ok: true }
  const body = await readBody<{ wachtwoord?: unknown }>(event).catch(() => null)
  const poging = typeof body?.wachtwoord === 'string' ? body.wachtwoord : ''
  if (!poging || !gelijk(poging, wachtwoord)) {
    await new Promise(r => setTimeout(r, 600)) // raden kost tijd
    throw createError({ statusCode: 401, statusMessage: 'Dat wachtwoord klopt niet.' })
  }
  setCookie(event, PROEF_COOKIE, proefToken(wachtwoord), {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return { ok: true }
})
