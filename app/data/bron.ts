import type { Fase, Financien, LogRegel, Project, ProjectWijziging, Taak, TaakWijziging, Uitzondering, UitzonderingStatus } from '~/lib/types'

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
  /** Maakt de taakregel aan als die er nog niet is. */
  bewaarStandaardtaak(projectId: string, lijst: Fase, sleutel: string, wijziging: TaakWijziging): Promise<Taak>
  bewaarTaak(taakId: string, wijziging: TaakWijziging): Promise<Taak>
  voegUitzonderingToe(projectId: string, invoer: NieuweUitzondering): Promise<{ taak: Taak, uitzondering: Uitzondering }>
  verwijderTaak(taakId: string): Promise<void>
  zetUitzonderingStatus(id: string, status: UitzonderingStatus): Promise<void>
}

export interface NieuweUitzondering {
  /** Een bestaande uit de catalogus, of een nieuwe titel. */
  uitzonderingId?: string
  nieuweTitel?: string
  fase: Fase
  deadline: string | null
}

export class BronFout extends Error {}
