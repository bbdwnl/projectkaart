// Domeintypen. Kolomnamen zijn gelijk aan de database (supabase/migrations).

export type Fase = 'lead' | 'haalbaarheid' | 'ontwikkeling' | 'uitvoering' | 'nazorg'
export type Status = 'niet_gestart' | 'loopt' | 'concept' | 'definitief' | 'volgende_fase' | 'nvt'
/** De stand van een taak op de kaart: het stoplicht. */
export type Licht = 'telaat' | 'letop' | 'open' | 'klaar' | 'later'
export type Rol = 'am' | 'po' | 'pm' | 'opzichter'
export type Soort = 'adv' | 'ont' | 'tk'
/** De subfase van haalbaarheid: SO of ontwikkeling VO. */
export type Subfase = 'so' | 'vo'
export type Discipline = 'casco' | 'sloop' | 'w' | 'e' | 'klimaat' | 'lift' | 'zon' | 'wanden' | 'vloeren' | 'kozijnen' | 'schilder' | 'sanitair' | 'brand' | 'terrein' | 'overig'
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

/** De verwachting tijdens lead en haalbaarheid, naast de harde datums. */
export interface ProjectPrognose {
  prognose_casco: IsoDatum | null
  prognose_afbouw: IsoDatum | null
  prognose_oplevering: IsoDatum | null
}

export interface Project extends ProjectDatums, ProjectPrognose {
  id: string
  slug: string
  /** Het projectnummer uit AFAS, bijvoorbeeld P20038. */
  nummer: string | null
  naam: string
  postcode: string | null
  huisnummer: string | null
  straat: string | null
  plaats: string | null
  /** Het BAG-object bij postcode en huisnummer; null als het adres (nog) niet in de BAG staat. */
  bag_id: string | null
  fase: Fase
  /** Alleen in haalbaarheid. */
  subfase: Subfase | null
  prio: boolean
  /** Een lead in de wachtkamer: nog niet actief, wel in beeld. */
  wachtkamer: boolean
  /** Nazorg is helemaal klaar: staat onder Projecten niet meer in de kolom (het archief uit het prototype). */
  afgehandeld: boolean
  soort: Soort[]
  m2: number | null
  slagingskans: number | null
  am: string | null
  po: string | null
  pm: string | null
  opzichter: string | null
  /** Kijkt mee; staat licht in het planningsoverzicht en telt daar niet mee. */
  buddy: string | null
  sharepoint_url: string | null
  extern_url: string | null
  notitieblok_url: string | null
  tekeningen_locatie: string | null
  gewijzigd_op: string | null
}
export type ProjectWijziging = Partial<Omit<Project, 'id' | 'slug' | 'gewijzigd_op'>>
/** Een nieuw project: een lead, of een lopend project dat direct in zijn fase begint. De rest vul je op de kaart in. */
export type NieuwProject = Pick<Project, 'slug' | 'naam' | 'fase'> & Partial<Pick<Project, 'nummer' | 'am' | 'po' | 'pm' | 'slagingskans'>>

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
  'status' | 'eigenaar' | 'reden_nvt' | 'aanleiding' | 'klantakkoord' | 'document_url' | 'document_naam' | 'deadline'>>

/** Een opmerking bij een taak. Project, wie en wanneer vult de database in; daarna ligt hij vast. */
export interface Opmerking {
  id: string
  taak_id: string
  project_id: string
  tekst: string
  door: string
  op: string
}

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
  email: string
  isMt: boolean
  /** Nog geen naam opgegeven (een link per mail geeft er geen mee): de loginpagina vraagt hem eerst. */
  naamNodig?: boolean
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
  /** De leverancier meldde het opgelost (op zijn pagina); BbDW moet nog aftekenen (opgelost). */
  gereed_op: string | null
  gereed_door: string | null
  /** BbDW keurde de laatste melding af: weer open voor de leverancier, met de reden. */
  afgekeurd_op: string | null
  afgekeurd_door: string | null
  afgekeurd_reden: string | null
}
/** Afkeuren: gereed_op null, met de reden. Wie en wanneer vult de database in. */
export type ControlepuntWijziging = Partial<Pick<Controlepunt, 'opgelost' | 'leverancier_id' | PlekVeld | 'gereed_op' | 'afgekeurd_reden'>>
export type MeldingVeld = 'gereed_op' | 'gereed_door' | 'afgekeurd_op' | 'afgekeurd_door' | 'afgekeurd_reden'
export const GEEN_MELDING: Record<MeldingVeld, null> = { gereed_op: null, gereed_door: null, afgekeurd_op: null, afgekeurd_door: null, afgekeurd_reden: null }

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

/** Waarom een deellink dicht is. Verlopen staat er niet bij: dat volgt uit geldig_tot. */
export type DeellinkReden = 'opgelost' | 'ingetrokken' | 'geblokkeerd'

/**
 * Een link waarmee een leverancier zonder account zijn open aandachtspunten ziet (/punten/<token>), met een code.
 * Token, code en einddatum (een maand na het maken) komen van de database; een link die dicht is, blijft dicht.
 */
export interface Deellink {
  id: string
  leverancier_id: string
  /** 64 tekens (0-9, a-f): het stuk van de link dat niet te raden is. */
  token: string
  /** Vijf cijfers, alleen 2 tot en met 9. */
  code: string
  geldig_tot: string
  gesloten_op: string | null
  gesloten_door: string | null
  gesloten_reden: DeellinkReden | null
  /** Verkeerde codes op rij; bij tien gaat de link dicht. */
  foute_pogingen: number
  /** Wanneer de leverancier de pagina het laatst opende, met de juiste code. */
  bekeken_op: string | null
  aangemaakt_door: string | null
  aangemaakt_op: string
}

export type PlekVeld = 'tekening_id' | 'tekening_blad' | 'tekening_x' | 'tekening_y'
/** Een plek op een tekening: blad (vanaf 1) en x, y van 0 tot 1 vanaf linksboven. */
export interface Plek { tekening_id: string, tekening_blad: number, tekening_x: number, tekening_y: number }
export const GEEN_PLEK: Record<PlekVeld, null> = { tekening_id: null, tekening_blad: null, tekening_x: null, tekening_y: null }

/** Per project en discipline één leverancier (die ook op het project staat), met contactpersoon of telefoon. */
export interface ProjectDiscipline {
  project_id: string
  discipline: Discipline
  leverancier_id: string | null
  contact: string | null
}
export type DisciplineWijziging = Partial<Pick<ProjectDiscipline, 'leverancier_id' | 'contact'>>

/** Feedback uit de knop rechtsonder: de notitie, de pagina en eventueel de plek (pixels op de pagina). Wie en wanneer vult de database in. */
export interface NieuweFeedback {
  tekst: string
  pad: string
  plek_x: number | null
  plek_y: number | null
  element: string | null
  scherm_breedte: number
  scherm_hoogte: number
  browser: string
}

/** Een actie uit het overleg. Wie hem maakte en wie hem gereed meldde, vult de database in. */
export interface Actie {
  id: string
  project_id: string
  tekst: string
  actiehouder: string | null
  deadline: IsoDatum | null
  gereed: boolean
  gereed_door: string | null
  gereed_op: string | null
  aangemaakt_door: string | null
  aangemaakt_op: string
}
export type ActieWijziging = Partial<Pick<Actie, 'tekst' | 'actiehouder' | 'deadline' | 'gereed'>>

/** Het e-mailadres van een actiehouder, één keer ingevuld. */
export interface Adres {
  naam: string
  email: string | null
}
