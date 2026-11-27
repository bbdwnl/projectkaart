// Een programma weghalen (MT): weigeren wat zich meldde, of een goedkeuring intrekken. Alle koppelingen eraan stoppen meteen.
export default defineEventHandler(async (event) => {
  await verwijderClient(event, getRouterParam(event, 'id') ?? '')
  return { verwijderd: true }
})
