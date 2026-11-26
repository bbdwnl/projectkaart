// Een koppeling met Copilot intrekken: Copilot kan er meteen niets meer mee.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/.test(id)) throw createError({ statusCode: 404, statusMessage: 'Deze koppeling bestaat niet (meer).' })
  await trekKoppelingIn(event, id)
  return { ingetrokken: true }
})
