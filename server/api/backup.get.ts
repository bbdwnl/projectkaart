import { BUCKET, bestandVan, maakSql, TABELLEN, teOud } from '../utils/backup'

// Elke nacht door Vercel Cron aangeroepen (nuxt.config, nitro.vercel.config.crons). Vercel stuurt het geheim mee als
// Authorization: Bearer <CRON_SECRET>; zonder dat geheim doet de route niets. Leest alles met de service-rol en zet
// het SQL-bestand in de besloten bucket backups. Daarna gaan bestanden ouder dan 30 dagen weg.
export default defineEventHandler(async (event) => {
  // Vercel zet hetzelfde geheim (CRON_SECRET) in de omgeving en stuurt het mee; daarom geen NUXT_-variabele.
  const geheim = process.env.CRON_SECRET
  if (!geheim || getHeader(event, 'authorization') !== `Bearer ${geheim}`) {
    throw createError({ statusCode: 401, statusMessage: 'Geen toegang.' })
  }
  const sb = serviceDatabase(event)
  const nu = new Date()

  const tabellen: { naam: string, rijen: unknown[] }[] = []
  for (const t of TABELLEN) {
    const rijen: unknown[] = []
    // Per 1000: zoveel geeft de database per keer.
    for (let van = 0; ; van += 1000) {
      let q = sb.from(t.naam).select('*').range(van, van + 999)
      for (const k of t.volgorde.split(',')) q = q.order(k)
      const res = await q
      if (res.error) throw createError({ statusCode: 502, statusMessage: `${t.naam} lezen lukte niet: ${res.error.message}` })
      rijen.push(...res.data)
      if (res.data.length < 1000) break
    }
    tabellen.push({ naam: t.naam, rijen })
  }

  const sql = maakSql(tabellen, nu)
  const naam = bestandVan(nu)
  const upload = await sb.storage.from(BUCKET).upload(naam, new Blob([sql], { type: 'application/sql' }), { upsert: true, contentType: 'application/sql' })
  if (upload.error) throw createError({ statusCode: 502, statusMessage: `Opslaan lukte niet: ${upload.error.message}` })

  const lijst = await sb.storage.from(BUCKET).list('', { limit: 1000 })
  const weg = teOud((lijst.data ?? []).map(f => f.name), nu)
  if (weg.length) await sb.storage.from(BUCKET).remove(weg)

  return { bestand: naam, grootte: sql.length, rijen: Object.fromEntries(tabellen.map(t => [t.naam, t.rijen.length])), verwijderd: weg }
})
