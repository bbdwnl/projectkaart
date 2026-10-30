import { vanDomein } from '../../app/lib/inlog'

// Alleen voor het ontwikkelen: de browser kan een echt magisch token voor een adres ophalen en inloggen
// zonder de link per mail. Het blijft echt inloggen (zelfde sessie, RLS en periode van een week); de route
// werkt uitsluitend als de app in dev draait op localhost en doet ze alleszins als 404 alsof ze er niet is.

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]'])

export default defineEventHandler(async (event) => {
  const gastheer = (event.node.req.headers.host ?? '').split(':')[0] ?? ''
  if (import.meta.dev !== true || !LOCAL.has(gastheer)) {
    throw createError({ statusCode: 404, statusMessage: 'Niet gevonden' })
  }
  const config = useRuntimeConfig(event)
  const body = await readBody<{ email?: unknown }>(event).catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !vanDomein(email, config.public.emailDomein)) {
    throw createError({ statusCode: 400, statusMessage: 'Dit adres kan hier niet inloggen.' })
  }
  if (!config.supabaseServiceKey) {
    throw createError({ statusCode: 503, statusMessage: 'Dev-inloggen is niet ingesteld (geen service-sleutel).' })
  }
  const antwoord = await $fetch<{ email_otp?: string }>(`${config.public.supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: config.supabaseServiceKey, Authorization: `Bearer ${config.supabaseServiceKey}` },
    body: { type: 'magiclink', email },
  }).catch(() => null)
  if (!antwoord?.email_otp) {
    throw createError({ statusCode: 502, statusMessage: 'Dev-inloggen lukte niet.' })
  }
  return { token: antwoord.email_otp }
})
