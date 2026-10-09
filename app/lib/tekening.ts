// De rekensom achter de tekeningviewer, zonder DOM: waar staat een punt van het blad op het scherm,
// en andersom, bij een bepaalde verschuiving (tx, ty) en zoom (z).
//
// Het blad wordt eerst passend in het vlak gezet: dat is "basis" (basisB × basisH schermpixels bij z = 1).
// Daarna: scherm = (tx, ty) + z × (x × basisB, y × basisH), met x en y van 0 tot 1 vanaf linksboven.

export interface Beeld { tx: number, ty: number, z: number }
export interface Maat { vlakB: number, vlakH: number, basisB: number, basisH: number }
export interface BladPlek { blad: number, x: number, y: number }

/** Een aandachtspunt als pin op de tekening. */
export interface Pin {
  id: string
  tekening_id: string
  blad: number
  x: number
  y: number
  label: string
  opgelost?: boolean
  /** Wat er onderin de viewer staat als je de pin aantikt. */
  tekst?: string
}

/** De aandachtspunten met een plek als pins, genummerd zoals in de lijst. */
export function pinsVan<P extends { id: string, opgelost: boolean, notitie: string, tekening_id: string | null, tekening_blad: number | null, tekening_x: number | null, tekening_y: number | null }>(
  punten: P[], nummer: (p: P) => number | string, extra: (p: P) => string = () => '',
): Pin[] {
  return punten.filter(p => p.tekening_id && p.tekening_blad && p.tekening_x !== null && p.tekening_y !== null).map(p => ({
    id: p.id, tekening_id: p.tekening_id!, blad: p.tekening_blad!, x: p.tekening_x!, y: p.tekening_y!,
    label: String(nummer(p)), opgelost: p.opgelost, tekst: [p.notitie, extra(p)].filter(Boolean).join(' · '),
  }))
}

export const Z_MIN = 0.5
export const Z_MAX = 16

/** Hoe groot het blad wordt als het passend in het vlak staat, met een rand eromheen. */
export function passend(vlakB: number, vlakH: number, bladB: number, bladH: number, rand = 16): { schaal: number, basisB: number, basisH: number, beeld: Beeld } {
  const schaal = Math.max(0.01, Math.min((vlakB - 2 * rand) / bladB, (vlakH - 2 * rand) / bladH))
  const basisB = bladB * schaal
  const basisH = bladH * schaal
  return { schaal, basisB, basisH, beeld: { tx: (vlakB - basisB) / 2, ty: (vlakH - basisH) / 2, z: 1 } }
}

export const naarScherm = (b: Beeld, m: Maat, x: number, y: number) => ({ sx: b.tx + b.z * x * m.basisB, sy: b.ty + b.z * y * m.basisH })
export const naarBlad = (b: Beeld, m: Maat, sx: number, sy: number) => ({ x: (sx - b.tx) / (b.z * m.basisB), y: (sy - b.ty) / (b.z * m.basisH) })
export const opBlad = (x: number, y: number) => x >= 0 && x <= 1 && y >= 0 && y <= 1

/** Zoomen met een factor, zodat het punt (px, py) op het scherm op zijn plek blijft. */
export function zoomRond(b: Beeld, factor: number, px: number, py: number): Beeld {
  const z = Math.min(Z_MAX, Math.max(Z_MIN, b.z * factor))
  const f = z / b.z
  return { z, tx: px - (px - b.tx) * f, ty: py - (py - b.ty) * f }
}

/** Een plek van het blad midden in beeld, op zoom z. */
export function centreer(m: Maat, x: number, y: number, z: number): Beeld {
  return { z, tx: m.vlakB / 2 - z * x * m.basisB, ty: m.vlakH / 2 - z * y * m.basisH }
}

/** Het blad mag niet uit beeld raken: er blijft altijd een rand van het blad zichtbaar. */
export function begrens(b: Beeld, m: Maat, rand = 48): Beeld {
  const klem = (v: number, bladMaat: number, vlakMaat: number) => {
    const laag = Math.min(rand, vlakMaat - bladMaat - rand)
    const hoog = Math.max(rand, vlakMaat - bladMaat - rand)
    return Math.min(hoog, Math.max(laag, v))
  }
  return { z: b.z, tx: klem(b.tx, b.z * m.basisB, m.vlakB), ty: klem(b.ty, b.z * m.basisH, m.vlakH) }
}

/** Welk deel van het blad in beeld is (0 tot 1), of null als het blad helemaal buiten beeld staat. */
export function zichtbaarDeel(b: Beeld, m: Maat): { x0: number, y0: number, x1: number, y1: number } | null {
  const a = naarBlad(b, m, 0, 0)
  const c = naarBlad(b, m, m.vlakB, m.vlakH)
  const x0 = Math.max(0, a.x), y0 = Math.max(0, a.y), x1 = Math.min(1, c.x), y1 = Math.min(1, c.y)
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null
}
