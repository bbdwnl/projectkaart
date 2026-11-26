// Vanaf /koppelen, met de inlog van de browser: de medewerker staat Copilot toe (of weigert). Geeft het adres terug
// waarmee de browser terug naar Copilot gaat, met de code.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const body = (await readBody<Toestemming>(event).catch(() => null)) ?? {}
  return geefToestemming(event, body)
})
