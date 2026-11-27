// Maakt het app-pakket voor Microsoft 365 Copilot (de agent "Projectkaart", beslissing 46) uit de map copilot-agent:
// de iconen (uit de vormen van het BbDW-logo), het OAuth-registratie-ID uit het Teams Developer Portal in ai-plugin.json,
// en de zip die een beheerder uploadt. Zie copilot-agent/README.md.
//
//   npm run copilot:pakket -- --oauth-id=<OAuth client registration ID uit het Teams Developer Portal>
//   npm run copilot:pakket -- --iconen      (alleen de iconen opnieuw tekenen)
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

const map = new URL('../copilot-agent/', import.meta.url)
const pad = naam => new URL(naam, map).pathname
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))

// ---------------------------------------------------------------------------------------------------------------
// Iconen: de vier letters van het logo (public/logo-bbdw.svg) in een vierkant, zoals apple-touch-icon.png.
// Microsoft wil color.png van 192x192 (kleur) en outline.png van 32x32 (wit op transparant).
// ---------------------------------------------------------------------------------------------------------------

const KLEUR = { blauw: [0x6b, 0xa4, 0xb8], salie: [0x6f, 0xa2, 0x87], oker: [0xd6, 0xa4, 0x61], baksteen: [0xc2, 0x6e, 0x60] }
const inCirkel = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
// Elke letter in een vak van 66 bij 66, zoals in het logo.
const B = (x, y) => [0, 39].some(t => (x >= 0 && x <= 52.5 && y >= t && y <= t + 27) || (x >= 52.5 && inCirkel(x, y, 52.5, t + 13.5, 13.5)))
const D = (x, y) => (x >= 0 && x <= 33 && y >= 0 && y <= 66) || (x >= 33 && inCirkel(x, y, 33, 33, 33))
const W = (x, y) => [0, 39].some(l => (x >= l && x <= l + 27 && y >= 0 && y <= 52.5) || (y >= 52.5 && inCirkel(x, y, l + 13.5, 52.5, 13.5)))
const LETTERS = [[B, 0, 0, KLEUR.blauw], [B, 78, 0, KLEUR.salie], [D, 0, 78, KLEUR.oker], [W, 78, 78, KLEUR.baksteen]]

/** RGBA-pixels: per pixel 4x4 monsters, zodat de randen zacht zijn. */
function teken(grootte, rand, achtergrond, kleurVan) {
  const schaal = (grootte - 2 * rand) / 144
  const px = Buffer.alloc(grootte * grootte * 4)
  for (let py = 0; py < grootte; py++) {
    for (let pxl = 0; pxl < grootte; pxl++) {
      const som = [0, 0, 0]
      let raak = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const x = (pxl + (sx + 0.5) / 4 - rand) / schaal
          const y = (py + (sy + 0.5) / 4 - rand) / schaal
          const l = LETTERS.find(([vorm, lx, ly]) => vorm(x - lx, y - ly))
          if (!l) continue
          raak++
          const k = kleurVan(l[3])
          for (let i = 0; i < 3; i++) som[i] += k[i]
        }
      }
      const o = (py * grootte + pxl) * 4
      const dekking = raak / 16
      if (achtergrond) {
        for (let i = 0; i < 3; i++) px[o + i] = Math.round((raak ? som[i] / raak : 0) * dekking + achtergrond[i] * (1 - dekking))
        px[o + 3] = 255
      } else {
        for (let i = 0; i < 3; i++) px[o + i] = raak ? Math.round(som[i] / raak) : 255
        px[o + 3] = Math.round(dekking * 255)
      }
    }
  }
  return px
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function png(grootte, pixels) {
  const stuk = (type, data) => {
    const t = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(t))
    return Buffer.concat([len, t, crc])
  }
  const kop = Buffer.alloc(13)
  kop.writeUInt32BE(grootte, 0)
  kop.writeUInt32BE(grootte, 4)
  kop.set([8, 6, 0, 0, 0], 8) // 8 bits, RGBA
  const rijen = Buffer.alloc(grootte * (grootte * 4 + 1))
  for (let y = 0; y < grootte; y++) pixels.copy(rijen, y * (grootte * 4 + 1) + 1, y * grootte * 4, (y + 1) * grootte * 4)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), stuk('IHDR', kop), stuk('IDAT', deflateSync(rijen)), stuk('IEND', Buffer.alloc(0))])
}

writeFileSync(pad('color.png'), png(192, teken(192, 30, [255, 255, 255], k => k)))
writeFileSync(pad('outline.png'), png(32, teken(32, 3, null, () => [255, 255, 255])))
console.log('copilot-agent/color.png (192x192) en outline.png (32x32) getekend')
if (args.iconen) process.exit(0)

// ---------------------------------------------------------------------------------------------------------------
// Het pakket
// ---------------------------------------------------------------------------------------------------------------

const oauthId = typeof args['oauth-id'] === 'string' ? args['oauth-id'].trim() : ''
if (!oauthId) {
  console.error('Geef het OAuth-registratie-ID uit het Teams Developer Portal mee: npm run copilot:pakket -- --oauth-id=...')
  console.error('Zonder dat ID kan Copilot niet inloggen. Zie copilot-agent/README.md, stap 2.')
  process.exit(1)
}
if (!/^[\w-]{8,200}$/.test(oauthId)) {
  console.error(`Dit ziet er niet uit als een registratie-ID: ${oauthId}`)
  process.exit(1)
}

const werk = mkdtempSync(join(tmpdir(), 'copilot-pakket-'))
try {
  for (const naam of ['manifest.json', 'declarativeAgent.json', 'color.png', 'outline.png']) writeFileSync(join(werk, naam), readFileSync(pad(naam)))
  const plugin = readFileSync(pad('ai-plugin.json'), 'utf8')
  if (!plugin.includes('{{OAUTH_REGISTRATIE_ID}}')) throw new Error('ai-plugin.json mist {{OAUTH_REGISTRATIE_ID}}')
  writeFileSync(join(werk, 'ai-plugin.json'), plugin.replace('{{OAUTH_REGISTRATIE_ID}}', oauthId))
  for (const naam of ['manifest.json', 'declarativeAgent.json', 'ai-plugin.json']) JSON.parse(readFileSync(join(werk, naam), 'utf8'))

  const versie = JSON.parse(readFileSync(pad('manifest.json'), 'utf8')).version
  mkdirSync(pad('dist/'), { recursive: true })
  const zip = pad(`dist/projectkaart-copilot-${versie}.zip`)
  rmSync(zip, { force: true })
  execFileSync('zip', ['-j', '-q', '-X', zip, ...['manifest.json', 'declarativeAgent.json', 'ai-plugin.json', 'color.png', 'outline.png'].map(n => join(werk, n))])
  console.log(`Klaar: ${zip}`)
  console.log('Upload: Microsoft 365-beheercentrum → Agents (of Teams-beheercentrum → Apps beheren → Uploaden). Zie copilot-agent/README.md.')
} finally {
  rmSync(werk, { recursive: true, force: true })
}
