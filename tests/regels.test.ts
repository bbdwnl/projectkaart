import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Algemene regels voor de code die een test kunnen bewaken (docs/BESLISSINGEN.md).
const APP = new URL('../app/', import.meta.url).pathname

function bestanden(map: string): string[] {
  return readdirSync(map).flatMap((naam) => {
    const pad = join(map, naam)
    if (statSync(pad).isDirectory()) return bestanden(pad)
    return /\.(vue|ts)$/.test(naam) ? [pad] : []
  })
}

describe('algemene regels', () => {
  it('gebruikt geen alert(), confirm() of prompt() van de browser, maar useBevestig() (beslissing 43)', () => {
    const fout = bestanden(APP).flatMap((pad) => {
      const regels = readFileSync(pad, 'utf8').split('\n')
      return regels.flatMap((r, i) => {
        // Commentaar telt niet: een regel die met * begint (JSDoc), of wat achter // of tussen /* */ staat.
        const code = /^\s*\*/.test(r) ? '' : r.replace(/\/\/.*$|\/\*.*?\*\//g, '')
        return /(?<![\w.$])(window\.)?(alert|confirm|prompt)\s*\(/.test(code) ? [`${pad.slice(APP.length)}:${i + 1}`] : []
      })
    })
    expect(fout).toEqual([])
  })
})
