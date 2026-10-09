import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Bron, NieuwControlepunt, NieuweUitzondering } from './bron'
import { BronFout } from './bron'
import type { Controlepunt, Financien, Leverancier, LogRegel, Project, ProjectLeverancier, Taak, Uitzondering } from '~/lib/types'
import { fotoPad } from '~/lib/controle'

function uitkomst<T>(res: { data: T | null, error: PostgrestError | null }, wat: string): T {
  if (res.error) {
    if (res.error.code === '42501' || res.error.code === 'PGRST301') throw new BronFout(`Je hebt geen rechten om ${wat}.`)
    throw new BronFout(`${wat[0]!.toUpperCase()}${wat.slice(1)} is niet gelukt. ${res.error.message}`)
  }
  if (res.data === null) throw new BronFout(`${wat[0]!.toUpperCase()}${wat.slice(1)} is niet gelukt: niets gevonden.`)
  return res.data
}

const UNIEK = '23505'
const IN_GEBRUIK = '23503'
const FOTOS = 'controle'

/** De echte bron: Supabase in Frankfurt. Wat iemand mag, regelt RLS in de database. */
export function maakSupabaseBron(sb: SupabaseClient): Bron {
  return {
    modus: 'supabase',

    async projecten() {
      return uitkomst(await sb.from('projecten').select('*').order('naam'), 'projecten laden') as Project[]
    },
    async project(slug) {
      const res = await sb.from('projecten').select('*').eq('slug', slug).maybeSingle()
      if (res.error) uitkomst(res, 'het project laden')
      return res.data as Project | null
    },
    async taken(projectId) {
      let q = sb.from('taken').select('*').order('aangemaakt_op')
      if (projectId) q = q.eq('project_id', projectId)
      return uitkomst(await q, 'taken laden') as Taak[]
    },
    async uitzonderingen() {
      return uitkomst(await sb.from('uitzonderingen').select('*').order('titel'), 'de uitzonderingen laden') as Uitzondering[]
    },
    async financien(projectId) {
      const res = await sb.from('financien').select('*').eq('project_id', projectId).maybeSingle()
      return res.error ? null : res.data as Financien | null
    },
    async logboek(projectId, limiet = 40) {
      return uitkomst(await sb.from('logboek').select('*').eq('project_id', projectId).order('op', { ascending: false }).limit(limiet), 'het logboek laden')
        .map(r => ({ ...r, id: String(r.id) })) as LogRegel[]
    },

    async bewaarProject(id, wijziging) {
      return uitkomst(await sb.from('projecten').update(wijziging).eq('id', id).select().single(), 'opslaan') as Project
    },
    async nieuweLead(invoer) {
      const res = await sb.from('projecten').insert({ ...invoer, fase: 'lead' }).select().single()
      if (res.error?.code === UNIEK) {
        throw new BronFout(res.error.message.includes('afas_nummer')
          ? `Er is al een project met AFAS-nummer ${invoer.afas_nummer}.`
          : 'Er bestaat al een project met deze naam. Kies een andere naam.')
      }
      return uitkomst(res, 'de lead opslaan') as Project
    },
    async bewaarStandaardtaak(projectId, lijst, sleutel, wijziging) {
      return uitkomst(await sb.from('taken')
        .upsert({ project_id: projectId, lijst, sleutel, fase: lijst, ...wijziging }, { onConflict: 'project_id,lijst,sleutel' })
        .select().single(), 'opslaan') as Taak
    },
    async bewaarTaak(taakId, wijziging) {
      return uitkomst(await sb.from('taken').update(wijziging).eq('id', taakId).select().single(), 'opslaan') as Taak
    },

    async voegUitzonderingToe(projectId, invoer: NieuweUitzondering) {
      let uitzondering: Uitzondering
      if (invoer.uitzonderingId) {
        uitzondering = uitkomst(await sb.from('uitzonderingen').select('*').eq('id', invoer.uitzonderingId).single(), 'de uitzondering laden') as Uitzondering
      } else {
        const titel = (invoer.nieuweTitel ?? '').trim()
        if (titel.length < 2) throw new BronFout('Typ een omschrijving van minstens twee letters.')
        const res = await sb.from('uitzonderingen').insert({ titel, fase: invoer.fase }).select().single()
        if (res.error?.code === UNIEK) {
          // Bestaat al, met andere hoofdletters of spaties: gebruik die.
          const zoek = titel.replace(/[\\%_]/g, m => `\\${m}`)
          uitzondering = uitkomst(await sb.from('uitzonderingen').select('*').ilike('titel', zoek).limit(1).single(), 'de uitzondering laden') as Uitzondering
        } else {
          uitzondering = uitkomst(res, 'de uitzondering toevoegen') as Uitzondering
        }
      }
      const res = await sb.from('taken').insert({ project_id: projectId, uitzondering_id: uitzondering.id, fase: invoer.fase, deadline: invoer.deadline }).select().single()
      if (res.error?.code === UNIEK) throw new BronFout('Deze uitzondering staat al in dit project.')
      return { taak: uitkomst(res, 'de uitzondering toevoegen') as Taak, uitzondering }
    },

    async verwijderTaak(taakId) {
      const res = await sb.from('taken').delete().eq('id', taakId)
      if (res.error) uitkomst(res, 'verwijderen')
    },
    async zetUitzonderingStatus(id, status) {
      uitkomst(await sb.from('uitzonderingen').update({ status }).eq('id', id).select().single(), 'de catalogus bijwerken')
    },

    async leveranciers(projectId) {
      if (!projectId) return uitkomst(await sb.from('leveranciers').select('*').order('naam'), 'de leveranciers laden') as Leverancier[]
      const rijen = uitkomst(await sb.from('project_leveranciers').select('leverancier:leveranciers(*)').eq('project_id', projectId), 'de leveranciers laden')
      return (rijen as unknown as { leverancier: Leverancier }[]).map(r => r.leverancier).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
    },
    async globaleLeveranciers() {
      return uitkomst(await sb.from('leveranciers').select('*').eq('globaal', true).order('naam'), 'de globale lijst laden') as Leverancier[]
    },
    async koppelingen() {
      return uitkomst(await sb.from('project_leveranciers').select('project_id, leverancier_id'), 'de leveranciers laden') as ProjectLeverancier[]
    },
    async nieuweLeverancier(projectId, invoer) {
      const res = await sb.from('leveranciers').insert(invoer).select().single()
      if (res.error?.code === UNIEK) throw new BronFout(`${invoer.naam} staat al in de globale lijst. Kies hem daar.`)
      const l = uitkomst(res, 'de leverancier toevoegen') as Leverancier
      if (!projectId) return l
      const koppeling = await sb.from('project_leveranciers').insert({ project_id: projectId, leverancier_id: l.id })
      if (koppeling.error) {
        if (!l.globaal) await sb.from('leveranciers').delete().eq('id', l.id)
        throw new BronFout(`De leverancier toevoegen is niet gelukt. ${koppeling.error.message}`)
      }
      return l
    },
    async koppelLeverancier(projectId, leverancierId) {
      const res = await sb.from('project_leveranciers').insert({ project_id: projectId, leverancier_id: leverancierId })
      if (res.error?.code === UNIEK) throw new BronFout('Deze leverancier staat al bij dit project.')
      if (res.error) throw new BronFout(`De leverancier toevoegen is niet gelukt. ${res.error.message}`)
    },
    async ontkoppelLeverancier(projectId, leverancier) {
      const res = await sb.from('project_leveranciers').delete().eq('project_id', projectId).eq('leverancier_id', leverancier.id)
      if (res.error?.code === IN_GEBRUIK) throw new BronFout('Deze leverancier heeft aandachtspunten onder Controle. Haal die eerst weg, of kies er een andere leverancier bij.')
      if (res.error) throw new BronFout(`De leverancier weghalen is niet gelukt. ${res.error.message}`)
      // Niet in de globale lijst en op geen project meer: dan hoeft hij nergens meer te staan.
      if (!leverancier.globaal) {
        const rest = await sb.from('project_leveranciers').select('project_id', { count: 'exact', head: true }).eq('leverancier_id', leverancier.id)
        if (!rest.error && rest.count === 0) await sb.from('leveranciers').delete().eq('id', leverancier.id)
      }
    },
    async wijzigLeverancier(id, wijziging) {
      const res = await sb.from('leveranciers').update(wijziging).eq('id', id).select().single()
      if (res.error?.code === UNIEK) throw new BronFout('Er staat al een leverancier met deze naam in de globale lijst.')
      return uitkomst(res, 'de leverancier opslaan') as Leverancier
    },
    async verwijderLeverancier(id) {
      const res = await sb.from('leveranciers').delete().eq('id', id)
      if (res.error?.code === IN_GEBRUIK) throw new BronFout('Deze leverancier staat nog op een project. Haal hem alleen uit de globale lijst, of eerst van die projecten af.')
      if (res.error) throw new BronFout(`De leverancier weghalen is niet gelukt. ${res.error.message}`)
    },
    async controlepunten(projectId) {
      let q = sb.from('controlepunten').select('*').order('aangemaakt_op', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      return uitkomst(await q, 'de aandachtspunten laden') as Controlepunt[]
    },
    async fotoUrls(paden) {
      if (!paden.length) return {}
      const res = await sb.storage.from(FOTOS).createSignedUrls(paden, 60 * 60)
      if (res.error) throw new BronFout(`De foto's laden is niet gelukt. ${res.error.message}`)
      const urls: Record<string, string> = {}
      for (const f of res.data) if (f.path && f.signedUrl) urls[f.path] = f.signedUrl
      return urls
    },
    async voegControlepuntToe(projectId, invoer: NieuwControlepunt) {
      const pad = fotoPad(projectId, crypto.randomUUID())
      const upload = await sb.storage.from(FOTOS).upload(pad, invoer.foto, { contentType: 'image/jpeg', upsert: false })
      if (upload.error) throw new BronFout(`De foto opslaan is niet gelukt. ${upload.error.message}`)
      const res = await sb.from('controlepunten')
        .insert({ project_id: projectId, leverancier_id: invoer.leverancierId, notitie: invoer.notitie, foto: pad }).select().single()
      if (res.error) await sb.storage.from(FOTOS).remove([pad])
      return uitkomst(res, 'het aandachtspunt opslaan') as Controlepunt
    },
    async bewaarControlepunt(id, wijziging) {
      return uitkomst(await sb.from('controlepunten').update(wijziging).eq('id', id).select().single(), 'opslaan') as Controlepunt
    },
    async verwijderControlepunt(punt) {
      const res = await sb.from('controlepunten').delete().eq('id', punt.id)
      if (res.error) uitkomst(res, 'het aandachtspunt weghalen')
      await sb.storage.from(FOTOS).remove([punt.foto]) // lukt dit niet, dan blijft alleen een losse foto achter
    },
  }
}
