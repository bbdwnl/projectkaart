import projecten from '../../../app/data/projecten.json'
import { maakDemoGegevens } from '../../../app/data/demo'

// De voorbeeldgegevens van de proefversie, alleen met toegang. Zo staan de projectnamen
// niet in de JavaScript die iedereen kan downloaden.
export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  if (!heeftProefToegang(event)) throw createError({ statusCode: 401, statusMessage: 'Wachtwoord nodig.' })
  return maakDemoGegevens(new Date(), projecten)
})
