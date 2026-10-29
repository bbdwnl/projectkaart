import type { Bron, InstellingRij } from '~/data/bron'
import { pasToe } from '~/lib/instellingen'

/**
 * De keuzelijsten uit Instellingen: na het inloggen geladen en over de standaard in de code gezet (pasToe), en live
 * bijgewerkt als iemand ze wijzigt. Lukt laden niet, dan blijft de standaard staan; de app werkt dan gewoon.
 */
export function useInstellingen() {
  const rijen = useState<InstellingRij[]>('instellingen', () => [])
  const geladen = useState('instellingen-geladen', () => false)

  /** De bron mag je meegeven: de plugin laadt al voordat useBron() bestaat. */
  async function laad(bron: Bron = useBron()) {
    try {
      zet(await bron.instellingen())
    } catch {
      // Geen rechten of geen verbinding: de standaard uit de code blijft staan.
    }
  }
  function zet(nieuw: InstellingRij[]) {
    rijen.value = nieuw
    pasToe(nieuw)
    geladen.value = true
  }
  /** Na opslaan of terugzetten: meteen toepassen, zonder op de live melding te wachten. */
  function bijgewerkt(rij: InstellingRij | { sleutel: string, weg: true }) {
    zet('weg' in rij ? rijen.value.filter(r => r.sleutel !== rij.sleutel) : [...rijen.value.filter(r => r.sleutel !== rij.sleutel), rij])
  }
  const rij = (sleutel: string) => rijen.value.find(r => r.sleutel === sleutel) ?? null
  return { rijen, geladen, laad, zet, bijgewerkt, rij }
}
