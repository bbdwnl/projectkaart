/**
 * Een vraag in een eigen venster (AppBevestig in app.vue), in plaats van confirm() of prompt() van de browser.
 * Die zijn niet in de stijl van de app en blokkeren alles; ze komen er niet meer in (beslissing 43).
 *
 *   if (!(await bevestig({ titel: 'Weghalen?', tekst: '…', ja: 'Weghalen' }))) return
 *   const reden = await vraagTekst({ titel: 'Afkeuren', tekst: '…', ja: 'Afkeuren', label: 'Wat klopt er niet?' })
 */
export interface Vraag {
  titel: string
  tekst?: string
  /** De knop die het doet, bijvoorbeeld "Weghalen". */
  ja?: string
  nee?: string
  /** Iets dat niet terug te draaien is: de knop in baksteen. */
  gevaar?: boolean
  /** Met een tekstveld: het antwoord is dan de getypte tekst (verplicht), of null bij annuleren. */
  label?: string
  placeholder?: string
}

interface Open extends Vraag { id: number, invoer: boolean, klaar: (antwoord: string | boolean | null) => void }

export function useBevestig() {
  const open = useState<Open | null>('bevestig', () => null)

  function stel(v: Vraag, invoer: boolean) {
    // Een vraag die nog openstaat, telt als geannuleerd.
    open.value?.klaar(invoer ? null : false)
    return new Promise<string | boolean | null>((klaar) => {
      open.value = { ...v, id: Date.now(), invoer, klaar }
    })
  }

  /** Ja of nee. Annuleren, Escape of naast het venster klikken is nee. */
  const bevestig = (v: Vraag) => stel(v, false) as Promise<boolean>
  /** Een korte tekst; null bij annuleren. */
  const vraagTekst = (v: Vraag) => stel(v, true) as Promise<string | null>

  return { open, bevestig, vraagTekst }
}
