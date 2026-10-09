// Domeintypen. Kolomnamen zijn gelijk aan de database (supabase/migrations).

export type Fase = 'lead' | 'haalbaarheid' | 'ontwikkeling' | 'uitvoering' | 'nazorg'
export type Status = 'niet_gestart' | 'loopt' | 'concept' | 'definitief' | 'volgende_fase' | 'nvt'
/** De stand van een taak op de kaart: het stoplicht. */
export type Licht = 'telaat' | 'letop' | 'open' | 'klaar' | 'later'
export type Rol = 'am' | 'po' | 'pm' | 'opzichter'
export type Soort = 'adv' | 'ont' | 'tk'
export type UitzonderingStatus = 'uitzondering' | 'voorgesteld' | 'standaard'
/** Datum als 'YYYY-MM-DD'. */
export type IsoDatum = string

export interface ProjectDatums {
  datum_casco: IsoDatum | null
  datum_voorbereiding: IsoDatum | null
  datum_inkoop: IsoDatum | null
  datum_afbouw: IsoDatum | null
  datum_oplevering: IsoDatum | null
}

export interface Project extends ProjectDatums {
  id: string
  slug: string
  nummer: string | null
  afas_nummer: string | null
  naam: string
  plaats: string | null
  adres: string | null
  fase: Fase
  prio: boolean
  soort: Soort[]
  m2: number | null
  slagingskans: number | null
  am: string | null
  po: string | null
  pm: string | null
  opzichter: string | null
  sharepoint_url: string | null
  extern_url: string | null
  notitieblok_url: string | null
  tekeningen_locatie: string | null
  gewijzigd_op: string | null
}
export type ProjectWijziging = Partial<Omit<Project, 'id' | 'slug' | 'gewijzigd_op'>>

/** De stand van één taak in één project: een standaardtaak (lijst + sleutel) of een uitzondering. */
export interface Taak {
  id: string
  project_id: string
  lijst: Fase | null
  sleutel: string | null
  uitzondering_id: string | null
  fase: Fase
  /** Alleen bij uitzonderingen; standaardtaken rekenen hun deadline uit de projectdatums. */
  deadline: IsoDatum | null
  status: Status
  eigenaar: string | null
  notitie: string | null
  reden_nvt: string | null
  aanleiding: string | null
  klantakkoord: boolean
  klantakkoord_door: string | null
  klantakkoord_op: string | null
  document_url: string | null
  document_naam: string | null
  afgetekend_door: string | null
  afgetekend_op: string | null
  gewijzigd_op: string | null
  gewijzigd_door: string | null
}
export type TaakWijziging = Partial<Pick<Taak,
  'status' | 'eigenaar' | 'notitie' | 'reden_nvt' | 'aanleiding' | 'klantakkoord' | 'document_url' | 'document_naam' | 'deadline'>>

/** Een soort uitzondering uit de gedeelde catalogus. */
export interface Uitzondering {
  id: string
  titel: string
  fase: Fase
  status: UitzonderingStatus
  aangemaakt_op: string | null
}

export interface Financien {
  project_id: string
  prognose_omzet_uren: number | null
  prognose_omzet_turnkey: number | null
  prognose_inkoop: number | null
  opdracht_uren: number | null
  opdracht_turnkey: number | null
  opdracht_inkoop_derden: number | null
  omzet_gefactureerd: number | null
  kosten_uren: number | null
  kosten_onderaanneming: number | null
  bm_werkelijk: number | null
}

export interface LogRegel {
  id: string
  project_id: string
  op: string
  door: string
  tabel: 'projecten' | 'taken'
  taak_id: string | null
  lijst: Fase | null
  sleutel: string | null
  uitzondering_id: string | null
  veld: string
  oud: string | null
  nieuw: string | null
}

export interface Gebruiker {
  naam: string
  email: string | null
  isMt: boolean
}

/**
 * Een leverancier. Globaal: in de lijst die je op elk project kunt kiezen. Anders alleen voor het project
 * waarvoor hij is aangemaakt. Welke leveranciers op een project werken, staat in ProjectLeverancier.
 */
export interface Leverancier {
  id: string
  naam: string
  /** Wat ze doen, bijvoorbeeld "Installateur". */
  vak: string | null
  globaal: boolean
}

export interface ProjectLeverancier {
  project_id: string
  leverancier_id: string
}

export type NieuweLeverancier = Pick<Leverancier, 'naam' | 'vak' | 'globaal'>
export type LeverancierWijziging = Partial<NieuweLeverancier>

/** Een aandachtspunt onder Controle: altijd een foto en een notitie, eventueel een leverancier. */
export interface Controlepunt {
  id: string
  project_id: string
  /** null: nog geen leverancier gekozen. */
  leverancier_id: string | null
  notitie: string
  /** Pad in de opslag: '<project_id>/<naam>.jpg'. */
  foto: string
  opgelost: boolean
  opgelost_door: string | null
  opgelost_op: string | null
  aangemaakt_door: string | null
  aangemaakt_op: string
  /** De plek op een tekening: alle vier, of geen. x en y van 0 tot 1 op het blad. */
  tekening_id: string | null
  tekening_blad: number | null
  tekening_x: number | null
  tekening_y: number | null
}
export type ControlepuntWijziging = Partial<Pick<Controlepunt, 'opgelost' | 'leverancier_id' | PlekVeld>>

/** Een pdf-tekening van een project (plattegrond, gevel). */
export interface Tekening {
  id: string
  project_id: string
  naam: string
  /** Pad in de opslag: '<project_id>/<naam>.pdf'. */
  pad: string
  aangemaakt_door: string | null
  aangemaakt_op: string
}

export type PlekVeld = 'tekening_id' | 'tekening_blad' | 'tekening_x' | 'tekening_y'
/** Een plek op een tekening: blad (vanaf 1) en x, y van 0 tot 1 vanaf linksboven. */
export interface Plek { tekening_id: string, tekening_blad: number, tekening_x: number, tekening_y: number }
export const GEEN_PLEK: Record<PlekVeld, null> = { tekening_id: null, tekening_blad: null, tekening_x: null, tekening_y: null }
