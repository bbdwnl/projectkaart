import type { Controlepunt, ControlepuntWijziging, Fase, Financien, Leverancier, NieuweLeverancier, LogRegel, Project, ProjectWijziging, Taak, TaakWijziging, Uitzondering, UitzonderingStatus } from '~/lib/types'
import type { NieuweLead } from '~/lib/leads'

/**
 * Waar de gegevens vandaan komen. Twee uitvoeringen: Supabase (echt) en demo
 * (in het geheugen, met voorbeeldgegevens, zonder backend).
 */
export interface Bron {
  modus: 'demo' | 'supabase'
  projecten(): Promise<Project[]>
  project(slug: string): Promise<Project | null>
  /** Alle taken, of die van één project. */
  taken(projectId?: string): Promise<Taak[]>
  uitzonderingen(): Promise<Uitzondering[]>
  /** null: geen gegevens, of geen rechten (alleen het MT ziet financiën). */
  financien(projectId: string): Promise<Financien | null>
  logboek(projectId: string, limiet?: number): Promise<LogRegel[]>
  bewaarProject(id: string, wijziging: ProjectWijziging): Promise<Project>
  /** Een nieuw project in de fase lead. */
  nieuweLead(invoer: NieuweLead): Promise<Project>
  /** Maakt de taakregel aan als die er nog niet is. */
  bewaarStandaardtaak(projectId: string, lijst: Fase, sleutel: string, wijziging: TaakWijziging): Promise<Taak>
  bewaarTaak(taakId: string, wijziging: TaakWijziging): Promise<Taak>
  voegUitzonderingToe(projectId: string, invoer: NieuweUitzondering): Promise<{ taak: Taak, uitzondering: Uitzondering }>
  verwijderTaak(taakId: string): Promise<void>
  zetUitzonderingStatus(id: string, status: UitzonderingStatus): Promise<void>

  /** De leveranciers die op dit project werken. */
  leveranciers(projectId: string): Promise<Leverancier[]>
  /** De globale lijst: te kiezen op elk project. */
  globaleLeveranciers(): Promise<Leverancier[]>
  /** Maakt een leverancier en zet hem op dit project; met globaal ook in de globale lijst. */
  nieuweLeverancier(projectId: string, invoer: NieuweLeverancier): Promise<Leverancier>
  /** Zet een leverancier uit de globale lijst op dit project. */
  koppelLeverancier(projectId: string, leverancierId: string): Promise<void>
  /** Haalt hem van dit project; een leverancier van alleen dit project is daarna weg. Lukt niet zolang er aandachtspunten naar verwijzen. */
  ontkoppelLeverancier(projectId: string, leverancier: Leverancier): Promise<void>
  /** Zet een leverancier van één project ook in de globale lijst. */
  maakGlobaal(leverancierId: string): Promise<Leverancier>
  controlepunten(projectId: string): Promise<Controlepunt[]>
  /** Adressen waarop de browser de foto's kan tonen, per pad. Tijdelijk geldig. */
  fotoUrls(paden: string[]): Promise<Record<string, string>>
  voegControlepuntToe(projectId: string, invoer: NieuwControlepunt): Promise<Controlepunt>
  /** Opgelost of weer open, of een (andere) leverancier. */
  bewaarControlepunt(id: string, wijziging: ControlepuntWijziging): Promise<Controlepunt>
  verwijderControlepunt(punt: Controlepunt): Promise<void>
}

export interface NieuwControlepunt {
  /** Optioneel: kan ook later in de lijst. */
  leverancierId: string | null
  notitie: string
  /** Al verkleind tot een jpg (utils/foto.ts). */
  foto: Blob
}

export interface NieuweUitzondering {
  /** Een bestaande uit de catalogus, of een nieuwe titel. */
  uitzonderingId?: string
  nieuweTitel?: string
  fase: Fase
  deadline: string | null
}

export class BronFout extends Error {}
