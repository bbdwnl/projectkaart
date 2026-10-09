import type { Controlepunt, Fase, Financien, Leverancier, LogRegel, Project, ProjectWijziging, Taak, TaakWijziging, Uitzondering, UitzonderingStatus } from '~/lib/types'
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

  leveranciers(projectId: string): Promise<Leverancier[]>
  voegLeverancierToe(projectId: string, invoer: Pick<Leverancier, 'naam' | 'vak'>): Promise<Leverancier>
  /** Lukt niet zolang de leverancier aandachtspunten heeft. */
  verwijderLeverancier(id: string): Promise<void>
  controlepunten(projectId: string): Promise<Controlepunt[]>
  /** Adressen waarop de browser de foto's kan tonen, per pad. Tijdelijk geldig. */
  fotoUrls(paden: string[]): Promise<Record<string, string>>
  voegControlepuntToe(projectId: string, invoer: NieuwControlepunt): Promise<Controlepunt>
  zetOpgelost(id: string, opgelost: boolean): Promise<Controlepunt>
  verwijderControlepunt(punt: Controlepunt): Promise<void>
}

export interface NieuwControlepunt {
  leverancierId: string
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
