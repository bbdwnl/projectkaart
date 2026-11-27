// Een programma goedkeuren (MT): daarna kan elke collega het toestaan op /koppelen.
export default defineEventHandler(async (event) => {
  await keurClientGoed(event, getRouterParam(event, 'id') ?? '')
  return { goedgekeurd: true }
})
