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
 */
export const LIJSTEN: Record<Fase, Takengroep[]> = {
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
}

export const UITZONDERINGEN_GROEP = 'Uitzonderingen in dit project'

export function vindStandaardtaak(lijst: Fase, sleutel: string): Standaardtaak | undefined {
  for (const g of LIJSTEN[lijst]) {
    const gevonden = g.taken.find(x => x.sleutel === sleutel)
    if (gevonden) return gevonden
  }
  return undefined
}

export const standaardtaken = (fase: Fase): Standaardtaak[] => LIJSTEN[fase].flatMap(g => g.taken)
