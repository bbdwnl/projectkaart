// De koppelingen met Copilot van de ingelogde medewerker (Instellingen → Copilot).
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  return mijnKoppelingen(event)
})
