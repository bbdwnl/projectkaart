// De programma's die zich bij de OAuth-server meldden (Instellingen → Copilot, alleen MT): om goed te keuren of weg te halen.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  return alleClients(event)
})
