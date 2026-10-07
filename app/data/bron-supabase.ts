import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Bron, NieuweUitzondering } from './bron'
import { BronFout } from './bron'
import type { Financien, LogRegel, Project, Taak, Uitzondering } from '~/lib/types'

function uitkomst<T>(res: { data: T | null, error: PostgrestError | null }, wat: string): T {
  if (res.error) {
    if (res.error.code === '42501' || res.error.code === 'PGRST301') throw new BronFout(`Je hebt geen rechten om ${wat}.`)
    throw new BronFout(`${wat[0]!.toUpperCase()}${wat.slice(1)} is niet gelukt. ${res.error.message}`)
  }
  if (res.data === null) throw new BronFout(`${wat[0]!.toUpperCase()}${wat.slice(1)} is niet gelukt: niets gevonden.`)
  return res.data
}

const UNIEK = '23505'

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
  }
}
