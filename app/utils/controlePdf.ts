import type { Controlepunt } from '~/lib/types'
import { fmt } from '~/lib/datum'
import { naarDataUrl, verkleinFoto } from '~/utils/foto'

// De pdf van het Controle-overzicht: A4, per groep (een leverancier of een project) de punten met foto.
// jsPDF wordt pas geladen als iemand op de knop drukt.

export interface PdfPunt {
  punt: Controlepunt
  fotoUrl: string | null
  /** De andere kant van de indeling: de leverancier (bij een project) of het project (bij een leverancier). */
  bij: string
}

export interface PdfInvoer {
  titel: string
  ondertitel: string
  /** Bijvoorbeeld "Open aandachtspunten". */
  selectie: string
  /** "Leverancier" of "Project": wat er in `bij` staat. */
  bijLabel: string
  groepen: { titel: string, punten: PdfPunt[] }[]
  bestandsnaam: string
}

interface Foto { data: string, b: number, h: number }

const MM = { marge: 18, pagina: 210, hoogte: 297, foto: 58, fotoHoog: 44 }
const KLEUR = { zwart: [17, 17, 17], stil: [107, 107, 107], lijn: [214, 214, 208], open: [138, 90, 23], klaar: [63, 107, 85] } as const
const datum = (iso: string | null) => (iso ? fmt(new Date(iso)) : '')

/** Haalt een foto op en maakt hem klein genoeg voor een pdf die nog te mailen is. */
async function laadFoto(url: string): Promise<Foto | null> {
  try {
    const blob = await verkleinFoto(await (await fetch(url)).blob(), 1000, 0.75)
    const beeld = await createImageBitmap(blob)
    const foto = { data: await naarDataUrl(blob), b: beeld.width, h: beeld.height }
    beeld.close()
    return foto
  } catch {
    return null
  }
}

export async function maakControlePdf(invoer: PdfInvoer): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const breed = MM.pagina - 2 * MM.marge
  const onder = MM.hoogte - MM.marge - 8
  const kleur = (k: readonly number[]) => doc.setTextColor(k[0]!, k[1]!, k[2]!)

  // Elke foto één keer ophalen, ook als punten dezelfde delen.
  const fotos = new Map<string, Promise<Foto | null>>()
  for (const p of invoer.groepen.flatMap(g => g.punten)) {
    if (p.fotoUrl && !fotos.has(p.fotoUrl)) fotos.set(p.fotoUrl, laadFoto(p.fotoUrl))
  }

  // Kop
  let y = MM.marge
  doc.setFont('helvetica', 'bold').setFontSize(9)
  kleur(KLEUR.stil)
  doc.text('BBDW · CONTROLE', MM.marge, y + 3)
  y += 12
  doc.setFontSize(22)
  kleur(KLEUR.zwart)
  for (const regel of doc.splitTextToSize(invoer.titel, breed) as string[]) {
    doc.text(regel, MM.marge, y)
    y += 9
  }
  doc.setFont('helvetica', 'normal').setFontSize(13)
  doc.text(invoer.ondertitel, MM.marge, y)
  y += 7
  const aantal = invoer.groepen.reduce((n, g) => n + g.punten.length, 0)
  doc.setFontSize(9)
  kleur(KLEUR.stil)
  doc.text(`${invoer.selectie} · ${aantal} ${aantal === 1 ? 'punt' : 'punten'} · ${fmt(new Date())}`, MM.marge, y)
  y += 10

  const nieuwePagina = () => {
    doc.addPage()
    y = MM.marge
  }

  for (const groep of invoer.groepen) {
    if (y + 12 + MM.fotoHoog > onder) nieuwePagina()
    doc.setDrawColor(KLEUR.zwart[0], KLEUR.zwart[1], KLEUR.zwart[2]).setLineWidth(0.6)
    doc.line(MM.marge, y, MM.marge + breed, y)
    y += 7
    doc.setFont('helvetica', 'bold').setFontSize(13)
    kleur(KLEUR.zwart)
    doc.text(groep.titel, MM.marge, y)
    doc.setFont('helvetica', 'normal').setFontSize(9)
    kleur(KLEUR.stil)
    doc.text(`${groep.punten.length} ${groep.punten.length === 1 ? 'punt' : 'punten'}`, MM.marge + breed, y, { align: 'right' })
    y += 6

    for (const { punt, fotoUrl, bij } of groep.punten) {
      const tekstX = MM.marge + MM.foto + 6
      const tekstBreed = breed - MM.foto - 6
      doc.setFont('helvetica', 'normal').setFontSize(11)
      const notitie = doc.splitTextToSize(punt.notitie, tekstBreed) as string[]
      const tekstHoog = notitie.length * 5 + 4 * 4.5
      const blok = Math.max(MM.fotoHoog, tekstHoog) + 6
      if (y + blok > onder) nieuwePagina()

      // Foto, passend in het vak, of een leeg vak met uitleg.
      const foto = fotoUrl ? await fotos.get(fotoUrl) : null
      if (foto) {
        const schaal = Math.min(MM.foto / foto.b, MM.fotoHoog / foto.h)
        doc.addImage(foto.data, 'JPEG', MM.marge, y, foto.b * schaal, foto.h * schaal)
      } else {
        doc.setDrawColor(KLEUR.lijn[0], KLEUR.lijn[1], KLEUR.lijn[2]).setLineWidth(0.3)
        doc.rect(MM.marge, y, MM.foto, MM.fotoHoog)
        doc.setFontSize(8)
        kleur(KLEUR.stil)
        doc.text('Foto niet beschikbaar', MM.marge + MM.foto / 2, y + MM.fotoHoog / 2, { align: 'center' })
      }

      let ty = y + 4
      doc.setFont('helvetica', 'normal').setFontSize(11)
      kleur(KLEUR.zwart)
      for (const regel of notitie) {
        doc.text(regel, tekstX, ty)
        ty += 5
      }
      ty += 1
      doc.setFontSize(9)
      kleur(KLEUR.stil)
      doc.text(`${invoer.bijLabel}: ${bij}`, tekstX, ty)
      ty += 4.5
      doc.text(`Gemeld door ${punt.aangemaakt_door ?? 'onbekend'} op ${datum(punt.aangemaakt_op)}`, tekstX, ty)
      ty += 4.5
      doc.setFont('helvetica', 'bold')
      kleur(punt.opgelost ? KLEUR.klaar : KLEUR.open)
      doc.text(punt.opgelost ? `Opgelost${punt.opgelost_door ? ` door ${punt.opgelost_door}` : ''}${punt.opgelost_op ? ` op ${datum(punt.opgelost_op)}` : ''}` : 'Open', tekstX, ty)

      y += blok
      doc.setDrawColor(KLEUR.lijn[0], KLEUR.lijn[1], KLEUR.lijn[2]).setLineWidth(0.2)
      doc.line(MM.marge, y - 3, MM.marge + breed, y - 3)
    }
    y += 4
  }

  // Voet op elke pagina.
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(8)
    kleur(KLEUR.stil)
    doc.text(`Projectkaart BbDW · ${invoer.titel} · ${invoer.ondertitel}`, MM.marge, MM.hoogte - 10)
    doc.text(`Pagina ${i} van ${paginas}`, MM.pagina - MM.marge, MM.hoogte - 10, { align: 'right' })
  }

  doc.save(invoer.bestandsnaam)
}
