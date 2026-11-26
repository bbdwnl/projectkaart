// Voor de pagina /koppelen: wie er toegang vraagt. Alleen een bekende client met een geregistreerd terugadres.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  return clientVoorPagina(event, q.client_id, q.redirect_uri)
})
