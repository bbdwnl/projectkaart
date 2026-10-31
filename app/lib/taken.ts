import { reactive } from 'vue'
import type { Fase } from './types'

/**
 * Hoe de deadline van een standaardtaak uit de projectdatums volgt.
 * - voorbereiding: d dagen vóór start voorbereiding
 * - inkoop: w weken vóór inkoop gereed; casco = vanaf start casco als die tussen
 *   voorbereiding en inkoop valt (regel uit het prototype), nooit vóór start voorbereiding
 * - afbouw: d dagen vóór start afbouw
 * - oplevering: d dagen ná oplevering
 */
export type DeadlineRegel =
  | { type: 'voorbereiding', dagen: number }
  | { type: 'inkoop', weken: number, casco?: boolean }
  | { type: 'afbouw', dagen: number }
  | { type: 'oplevering', dagen: number }

export interface Standaardtaak {
  sleutel: string
  titel: string
  regel?: DeadlineRegel
}

export interface Takengroep {
  titel: string
  uitleg?: string
  taken: Standaardtaak[]
}

const t = (sleutel: string, titel: string, regel?: DeadlineRegel): Standaardtaak => ({ sleutel, titel, regel })
const inkoop = (weken: number, casco = false): DeadlineRegel => ({ type: 'inkoop', weken, casco })
const voorb = (dagen: number): DeadlineRegel => ({ type: 'voorbereiding', dagen })

/**
 * Het standaardpakket: de lijsten uit het prototype (de "live" lijsten), per fase.
 * De sleutels zijn die van het prototype, zodat de bestaande gegevens één op één over kunnen.
 * Dit is de standaard; onder Instellingen past het MT het pakket aan (zie instellingen.ts).
 */
export const LIJSTEN: Record<Fase, Takengroep[]> = reactive({
  lead: [
    { titel: 'Overdracht naar haalbaarheid', taken: [
      t('betaalde_opdracht', 'Betaalde opdracht'),
      t('risico', 'Analyse risico\'s & kansen'),
    ] },
  ],
  haalbaarheid: [
    { titel: 'Input voor de ontwikkelfase', uitleg: 'compleet 2 weken vóór start voorbereiding', taken: [
      t('demarcatie', 'Demarcatie', voorb(14)),
      t('opleverniveau', 'Opleverniveau', voorb(14)),
      t('stiko_vo', 'STIKO', voorb(14)),
      t('principeverzoek', 'Principeverzoek welstand/parkeren', voorb(14)),
      t('bestemmingsplan', 'Bestemmingsplan haalbaarheid', voorb(14)),
      t('vo_tekening', 'VO tekening', voorb(14)),
      t('m2_verdeelstaat', 'M2 verdeelstaat', voorb(14)),
      t('stakeholders_vo', 'Stakeholders', voorb(14)),
      t('basisopdracht', 'Basisopdracht', voorb(14)),
    ] },
    { titel: 'Overdracht naar ontwikkeling', taken: [
      t('scope', 'Duidelijke scope', voorb(0)),
      t('opdracht', 'Opdracht', voorb(0)),
      t('fin_haalbaar', 'Financieel haalbaar', voorb(0)),
    ] },
  ],
  ontwikkeling: [
    { titel: 'Te realiseren tijdens de fase', uitleg: 'teruggerekend vanaf inkoop gereed', taken: [
      t('demarcatie', 'Demarcatie', inkoop(9)),
      t('principeverzoek', 'Principeverzoek welstand/parkeren', inkoop(9)),
      t('bestemmingsplan', 'Bestemmingsplan haalbaarheid', inkoop(9)),
      t('basisopdracht', 'Basisopdracht', inkoop(9)),
      t('stakeholders_ov', 'Stakeholders overzicht (klant + leveranciers)', inkoop(9)),
      t('overall_planning', 'Overall planning', inkoop(9)),
      t('externe_adviseurs', 'Externe adviseurs t.b.v. vergunning/techniek', inkoop(8)),
      t('look_feel', 'Look en Feel totaal overzicht', inkoop(8)),
      t('do_casco', 'Definitief ontwerp Casco', inkoop(7, true)),
      t('do_installaties', 'Definitief ontwerp Installaties (Klimaat/Lift) incl. gewichten', inkoop(6)),
      t('do_afbouw', 'Definitief ontwerp Afbouw', inkoop(6)),
      t('sloopplan', 'Sloopplan', inkoop(6)),
      t('rioolplan', 'Basis rioolplan', inkoop(6)),
      t('terreinplan', 'Terreinplan', inkoop(6)),
      t('zonnepanelen', 'Zonnepanelen projectie', inkoop(6)),
      t('elektra', 'Elektra basiszaken – verdeelkast, zonering, alarm, BMI', inkoop(6)),
      t('constructie', 'Constructieberekeningen', inkoop(5, true)),
      t('pve_casco', 'Technisch PvE Casco', inkoop(5, true)),
      t('vergunningsset', 'Vergunningsset', inkoop(4)),
      t('brandveiligheid', 'Brandveiligheid', inkoop(4)),
      t('doorsnedes', 'Doorsnedes + detaillering', inkoop(3)),
      t('pve_afbouw', 'Technisch PvE Afbouw', inkoop(3)),
      t('m2_def', 'Definitieve M2 staat (VVO + BVO tekening)', inkoop(3)),
      t('elementenbegroting', 'Elementenbegroting + STIKO', inkoop(1)),
      t('financiering', 'Financieringsgrondslag definitief', inkoop(1)),
      t('huurovereenkomsten', 'Huurovereenkomsten', inkoop(0)),
      t('casco_aanbesteding', 'Casco aanbesteding inclusief gunning', inkoop(0, true)),
      t('energielabel_vl', 'Voorlopige energielabel', inkoop(0)),
    ] },
  ],
  uitvoering: [
    { titel: 'Tijdens uitvoering', taken: [
      t('uitvoeringsset', 'Uitvoeringsset'),
      t('inkoop_afbouw', 'Inkoop afbouw', { type: 'afbouw', dagen: 0 }),
      t('sp_extern', 'Uitvoeringsdocumenten in SharePoint EXTERN'),
      t('meerminder', 'Bewaking meer- en minderwerk'),
    ] },
    // De documentenlijst afbouw heeft (nog) geen deadlines, net als in het prototype.
    { titel: 'Documentenlijst afbouw · Installaties', taken: [
      t('el', 'Elektrische voorzieningen (incl. verdeelkast, MK, alarm, camera\'s, BMI)'),
      t('licht', 'Lichtplan'),
      t('alarm', 'Alarmzonering'),
      t('mvwp', 'MV en WP met opstelplaatsen en roosters'),
      t('zon', 'Zonnepanelen'),
      t('schuif', 'Schuifdeuren'),
      t('lift', 'Liftinstallatie met hijsoog etc.'),
      t('sanitair', 'Sanitaire voorzieningen (+ rioolplan + BSH)'),
      t('dak', 'Dakopstellingstekening (incl. zonnepanelen, klimaatopstelling, beluchting, pluvia)'),
      t('terrein', 'Terreininrichting (straatwerk, beplantingsplan, terreinriool, opstelplaatsen fietsen, berging)'),
    ] },
    { titel: 'Documentenlijst afbouw · Afbouw', taken: [
      t('plattegrond', 'Plattegrond met maatvoering'),
      t('plafond', 'Plafondafwerking'),
      t('kozijnstaat', 'Kozijnenstaat'),
      t('vloersparing', 'Vloersparingen'),
      t('koven', 'Koven en details'),
      t('sluitplan', 'Sluitplan'),
      t('screens', 'Zonnescreens'),
      t('rolluik', 'Rolluiken'),
      t('sloop', 'Sloopplan'),
    ] },
    { titel: 'Documentenlijst afbouw · Inrichting', taken: [
      t('interieur', 'Inrichting (interieur)'),
      t('wand', 'Wandafwerking'),
      t('vloerafw', 'Vloerafwerking'),
      t('signing', 'Signing overzicht'),
      t('plisse', 'Plissés'),
    ] },
    { titel: 'Documentenlijst afbouw · Bouw', taken: [
      t('bouwtek', 'Bouwtekeningen aannemer'),
      t('palen', 'Palenplan'),
      t('fundering', 'Funderingsplan'),
      t('vloeren', 'Vloerenplan'),
      t('dakplan', 'Dakplan'),
      t('kozijntek', 'Kozijnentekeningen'),
      t('details', 'Details'),
      t('lifttek', 'Lifttekening'),
    ] },
    { titel: 'Documentenlijst afbouw · Oplevering', taken: [
      t('energielabel_def', 'Definitieve energielabel'),
    ] },
  ],
  nazorg: [
    { titel: 'Nazorg', taken: [
      t('opleverpunten', 'Opleverpunten opgelost', { type: 'oplevering', dagen: 21 }),
      t('fin_afhandeling', 'Financiële afhandeling', { type: 'oplevering', dagen: 42 }),
    ] },
  ],
})

/** Een standaardtaak die uit het pakket is gehaald. De projecten die er toen al waren, houden hem. */
export interface VervallenTaak extends Standaardtaak {
  /** De groep waar hij in stond: op een bestaande kaart komt hij daar terug. */
  groep: string
  /** Wanneer hij uit het pakket ging (ISO). */
  weg: string
}

/** Per fase de taken die uit het pakket zijn gehaald; onder Instellingen bijgehouden bij het opslaan van het pakket. */
export const VERVALLEN: Record<Fase, VervallenTaak[]> = reactive({ lead: [], haalbaarheid: [], ontwikkeling: [], uitvoering: [], nazorg: [] })

/** Of een project een vervallen taak houdt: het bestond al toen de taak uit het pakket ging. */
export const houdtTaak = (v: Pick<VervallenTaak, 'weg'>, aangemaakt: string | null | undefined) =>
  !!aangemaakt && Date.parse(aangemaakt) < Date.parse(v.weg)

/**
 * De standaardtaken van één project in een fase, in groepen: het pakket zoals het nu is, plus de taken die eruit gingen
 * nadat het project er al was. Die staan in hun oude groep, of (als die er niet meer is) in een eigen groep erachter.
 */
export function groepenVoor(fase: Fase, aangemaakt: string | null | undefined): Takengroep[] {
  const nu = new Set(LIJSTEN[fase].flatMap(g => g.taken.map(t => t.sleutel)))
  const blijven = VERVALLEN[fase].filter(v => !nu.has(v.sleutel) && houdtTaak(v, aangemaakt))
  if (!blijven.length) return LIJSTEN[fase]
  const taak = ({ sleutel, titel, regel }: VervallenTaak): Standaardtaak => ({ sleutel, titel, ...(regel ? { regel } : {}) })
  const groepen = LIJSTEN[fase].map(g => ({ ...g, taken: [...g.taken, ...blijven.filter(v => v.groep === g.titel).map(taak)] }))
  for (const v of blijven) {
    if (LIJSTEN[fase].some(g => g.titel === v.groep)) continue
    const eigen = groepen.find(g => g.titel === v.groep)
    if (eigen) eigen.taken.push(taak(v))
    else groepen.push({ titel: v.groep, taken: [taak(v)] })
  }
  return groepen
}

export const UITZONDERINGEN_GROEP = 'Uitzonderingen in dit project'

/** Een standaardtaak uit het pakket, of anders een die eruit is gehaald (voor de naam in het logboek en de analyses). */
export function vindStandaardtaak(lijst: Fase, sleutel: string): Standaardtaak | undefined {
  for (const g of LIJSTEN[lijst]) {
    const gevonden = g.taken.find(x => x.sleutel === sleutel)
    if (gevonden) return gevonden
  }
  return VERVALLEN[lijst].find(v => v.sleutel === sleutel)
}

/** De standaardtaak zoals hij voor één project geldt: uit het pakket, of eruit gehaald nadat het project er al was. */
export const standaardtaakVoor = (lijst: Fase, sleutel: string, aangemaakt: string | null | undefined): Standaardtaak | undefined =>
  groepenVoor(lijst, aangemaakt).flatMap(g => g.taken).find(t => t.sleutel === sleutel)

export const standaardtaken = (fase: Fase): Standaardtaak[] => LIJSTEN[fase].flatMap(g => g.taken)
