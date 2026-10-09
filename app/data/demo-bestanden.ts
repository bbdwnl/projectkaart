// Proefversie: geüploade tekeningen in de browser van de tester (IndexedDB). Een pdf is te groot
// voor localStorage, waar de rest van de voorbeeldgegevens staat.

const DATABASE = 'projectkaart_proefbestanden'
const LADE = 'bestanden'

function open(): Promise<IDBDatabase> {
  return new Promise((klaar, mis) => {
    const verzoek = indexedDB.open(DATABASE, 1)
    verzoek.onupgradeneeded = () => verzoek.result.createObjectStore(LADE)
    verzoek.onsuccess = () => klaar(verzoek.result)
    verzoek.onerror = () => mis(verzoek.error)
  })
}

async function lade<T>(modus: IDBTransactionMode, actie: (l: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((klaar, mis) => {
      const verzoek = actie(db.transaction(LADE, modus).objectStore(LADE))
      verzoek.onsuccess = () => klaar(verzoek.result)
      verzoek.onerror = () => mis(verzoek.error)
    })
  } finally {
    db.close()
  }
}

export const bewaarBestand = (pad: string, bestand: Blob) => lade('readwrite', l => l.put(bestand, pad)).then(() => undefined)
export const leesBestand = (pad: string) => lade<Blob | undefined>('readonly', l => l.get(pad)).then(b => b ?? null)
export const wisBestand = (pad: string) => lade('readwrite', l => l.delete(pad)).then(() => undefined)
export const wisAlleBestanden = () => lade('readwrite', l => l.clear()).then(() => undefined)
