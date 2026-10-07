import type { Fase, ProjectDatums, Rol } from './types'

export interface FaseInfo {
  id: Fase
  naam: string
  rol: Rol
  wat: string
}

/** De procesflow van BBDW, van lead tot nazorg (uit het prototype). */
export const FASEN: FaseInfo[] = [
  { id: 'lead', naam: 'Lead', rol: 'am', wat: 'Kans in beeld' },
  { id: 'haalbaarheid', naam: 'Haalbaarheid', rol: 'am', wat: 'SO / VO' },
  { id: 'ontwikkeling', naam: 'Ontwikkeling', rol: 'po', wat: 'Voorbereiding & inkoop' },
  { id: 'uitvoering', naam: 'Uitvoering', rol: 'pm', wat: 'Bouwvoorbereiding, casco & afbouw' },
  { id: 'nazorg', naam: 'Nazorg', rol: 'pm', wat: 'Actielijst tot afronding' },
]

export const faseInfo = (f: Fase): FaseInfo => FASEN.find(x => x.id === f)!
export const faseIndex = (f: Fase): number => FASEN.findIndex(x => x.id === f)

export const ROLLEN: Record<Rol, { kort: string, naam: string }> = {
  am: { kort: 'AM', naam: 'Accountmanager' },
  po: { kort: 'PO', naam: 'Projectontwikkelaar' },
  pm: { kort: 'PM', naam: 'Projectmanager' },
  opzichter: { kort: 'Opzichter', naam: 'Opzichter' },
}

/** De mensen uit het prototype; later een tabel. */
export const MENSEN: Record<Rol, string[]> = {
  am: ['Benno', 'Jeroen', 'Michiel', 'Peter'],
  po: ['Benno', 'Michiel'],
  pm: ['Benno', 'Carlo', 'Dimitry', 'Michiel', 'Patrick'],
  opzichter: ['Carlo', 'Heino', 'Hugo'],
}
export const EIGENAREN = ['Michiel', 'Benno', 'Jeroen', 'Peter', 'Ad', 'Patrick', 'Dimitry', 'Carlo', 'Heino', 'Hugo', 'Architect', 'Adviseur', 'Aannemer', 'Leverancier']

export const DATUMVELDEN: { veld: keyof ProjectDatums, naam: string, kort: string }[] = [
  { veld: 'datum_casco', naam: 'Start casco', kort: 'Start casco' },
  { veld: 'datum_voorbereiding', naam: 'Start voorbereiding', kort: 'Voorbereiding' },
  { veld: 'datum_inkoop', naam: 'Inkoop gereed', kort: 'Inkoop gereed' },
  { veld: 'datum_afbouw', naam: 'Start afbouw', kort: 'Start afbouw' },
  { veld: 'datum_oplevering', naam: 'Oplevering', kort: 'Oplevering' },
]

/** Waar elke fase naartoe werkt: de mijlpaal in de standzin en de planning. */
export const MIJLPAAL: Record<Fase, { naam: string, veld: keyof ProjectDatums } | null> = {
  lead: null,
  haalbaarheid: { naam: 'start voorbereiding', veld: 'datum_voorbereiding' },
  ontwikkeling: { naam: 'inkoop gereed', veld: 'datum_inkoop' },
  uitvoering: { naam: 'start afbouw', veld: 'datum_afbouw' },
  nazorg: { naam: 'oplevering', veld: 'datum_oplevering' },
}

/**
 * Wat er bij elke overdracht klaar moet zijn (de procesflow van het prototype).
 * Elke eis leidt zijn stand af uit taken ('lijst:sleutel'); er is geen harde gate.
 */
export const EISEN: Record<Fase, { kop: string, items: { titel: string, taken: string[] }[] }> = {
  lead: { kop: 'Overdracht', items: [
    { titel: 'Betaalde opdracht', taken: ['lead:betaalde_opdracht'] },
    { titel: 'Analyse risico\'s & kansen', taken: ['lead:risico'] },
  ] },
  haalbaarheid: { kop: 'Overdracht', items: [
    { titel: 'Duidelijke scope', taken: ['haalbaarheid:scope'] },
    { titel: 'Opdracht', taken: ['haalbaarheid:opdracht'] },
    { titel: 'VO', taken: ['haalbaarheid:vo_tekening'] },
    { titel: 'Stakeholderoverzicht', taken: ['haalbaarheid:stakeholders_vo'] },
    { titel: 'Financieel haalbaar', taken: ['haalbaarheid:fin_haalbaar'] },
  ] },
  ontwikkeling: { kop: 'Overdracht', items: [
    { titel: 'DO', taken: ['ontwikkeling:do_casco', 'ontwikkeling:do_installaties', 'ontwikkeling:do_afbouw'] },
    { titel: 'Vergunning', taken: ['ontwikkeling:vergunningsset'] },
    { titel: 'Opdracht casco aannemer', taken: ['ontwikkeling:casco_aanbesteding'] },
    { titel: 'Definitieve STIKO met onderleggers', taken: ['ontwikkeling:elementenbegroting'] },
  ] },
  uitvoering: { kop: 'Tijdens uitvoering', items: [
    { titel: 'Uitvoeringsset', taken: ['uitvoering:uitvoeringsset'] },
    { titel: 'Inkoop afbouw vóór start afbouw', taken: ['uitvoering:inkoop_afbouw'] },
    { titel: 'Documenten in SharePoint EXTERN', taken: ['uitvoering:sp_extern'] },
    { titel: 'Bewaking meer- en minderwerk', taken: ['uitvoering:meerminder'] },
  ] },
  nazorg: { kop: 'Nazorg', items: [
    { titel: 'Opleverpunten < 3 weken opgelost', taken: ['nazorg:opleverpunten'] },
    { titel: 'Financiële afhandeling < 6 weken', taken: ['nazorg:fin_afhandeling'] },
  ] },
}

export const SOORTEN: { id: 'adv' | 'ont' | 'tk', naam: string }[] = [
  { id: 'adv', naam: 'Alleen adviseur' },
  { id: 'ont', naam: 'Ontwerp & coördinatie' },
  { id: 'tk', naam: 'Turnkey afbouw' },
]
