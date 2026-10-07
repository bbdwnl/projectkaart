<script setup lang="ts">
import { MENSEN, ROLLEN, SOORTEN } from '~/lib/fasen'
import type { Project, ProjectWijziging, Rol, Soort } from '~/lib/types'

const { project, wijzigProject } = useKaart()
const { toon } = useToast()
const ROLVOLGORDE: Rol[] = ['am', 'po', 'pm', 'opzichter']
const KANTOOR = 'Veemarktkade 8, \'s-Hertogenbosch'

const opties = (rol: Rol) => {
  const huidig = project.value?.[rol]
  return huidig && !MENSEN[rol].includes(huidig) ? [...MENSEN[rol], huidig] : MENSEN[rol]
}
const route = computed(() => project.value?.adres
  ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(KANTOOR)}&destination=${encodeURIComponent(project.value.adres)}`
  : null)
const isLink = (v: string | null | undefined) => !!v && /^https?:\/\//i.test(v)

function tekst(veld: keyof ProjectWijziging, e: Event) {
  const waarde = (e.target as HTMLInputElement).value.trim() || null
  if (waarde === (project.value?.[veld as keyof Project] ?? null)) return
  wijzigProject({ [veld]: waarde })
}
function link(veld: 'sharepoint_url' | 'extern_url' | 'notitieblok_url', e: Event) {
  const waarde = (e.target as HTMLInputElement).value.trim() || null
  if (waarde && !isLink(waarde)) {
    toon('Plak een link die begint met https://, bijvoorbeeld uit SharePoint.', 'fout')
    return
  }
  if (waarde !== project.value?.[veld]) wijzigProject({ [veld]: waarde })
}
function getal(e: Event) {
  const v = (e.target as HTMLInputElement).value.replace(/\./g, '').replace(',', '.').trim()
  const m2 = v ? Number(v) : null
  if (m2 !== null && Number.isNaN(m2)) return toon('Vul de oppervlakte in als getal, bijvoorbeeld 1850.', 'fout')
  if (m2 !== project.value?.m2) wijzigProject({ m2 })
}
function soort(id: Soort, aan: boolean) {
  const huidig = new Set(project.value?.soort ?? [])
  if (aan) huidig.add(id)
  else huidig.delete(id)
  wijzigProject({ soort: SOORTEN.map(s => s.id).filter(s => huidig.has(s)) })
}
async function kopieer() {
  if (!project.value?.tekeningen_locatie) return
  await navigator.clipboard?.writeText(project.value.tekeningen_locatie)
  toon('Pad gekopieerd')
}
</script>

<template>
  <section v-if="project" id="gegevens" class="blok">
    <div class="blokkop">
      <div>
        <h2>Projectgegevens</h2>
        <p class="klein">Wie, wat en waar. Elke wijziging komt in het logboek.</p>
      </div>
    </div>
    <div class="gegevens">
      <div class="kaart">
        <span class="tab">Mensen</span>
        <dl class="velden">
          <div v-for="rol in ROLVOLGORDE" :key="rol">
            <dt><label :for="`rol-${rol}`">{{ ROLLEN[rol].kort }}<template v-if="rol !== 'opzichter'"> · {{ ROLLEN[rol].naam.toLowerCase() }}</template></label></dt>
            <dd>
              <select :id="`rol-${rol}`" class="veld" :value="project[rol] ?? ''" @change="e => tekst(rol, e)">
                <option value="">nog niet gekozen</option>
                <option v-for="m in opties(rol)" :key="m" :value="m">{{ m }}</option>
              </select>
            </dd>
          </div>
        </dl>
      </div>

      <div class="kaart">
        <span class="tab">Project</span>
        <dl class="velden">
          <div class="naast">
            <div><dt><label for="g-nummer">Projectnummer</label></dt><dd><input id="g-nummer" class="veld" :value="project.nummer ?? ''" placeholder="P26001" @change="e => tekst('nummer', e)"></dd></div>
            <div><dt><label for="g-afas">AFAS-nummer</label></dt><dd><input id="g-afas" class="veld" :value="project.afas_nummer ?? ''" placeholder="Nummer in AFAS" @change="e => tekst('afas_nummer', e)"></dd></div>
          </div>
          <div>
            <dt><label for="g-adres">Adres</label></dt>
            <dd class="met-link">
              <input id="g-adres" class="veld" :value="project.adres ?? ''" placeholder="Straat, huisnummer, plaats" @change="e => tekst('adres', e)">
              <a v-if="route" :href="route" target="_blank" rel="noopener">Route ↗</a>
            </dd>
          </div>
          <div><dt><label for="g-m2">Oppervlakte (m²)</label></dt><dd><input id="g-m2" class="veld" inputmode="decimal" :value="project.m2 ?? ''" placeholder="bijvoorbeeld 1850" @change="getal"></dd></div>
          <div>
            <dt>Soort project</dt>
            <dd class="kolpillen">
              <label v-for="s in SOORTEN" :key="s.id" class="kolpil"><input type="checkbox" :checked="project.soort.includes(s.id)" @change="e => soort(s.id, (e.target as HTMLInputElement).checked)"><span>{{ s.naam }}</span></label>
            </dd>
          </div>
          <div><label class="schakel"><input type="checkbox" :checked="project.prio" @change="e => wijzigProject({ prio: (e.target as HTMLInputElement).checked })"><span />Prio</label></div>
        </dl>
      </div>

      <div class="kaart">
        <span class="tab">Documenten</span>
        <dl class="velden">
          <div v-for="[veld, naam, uitleg] in ([['sharepoint_url', 'Projectmap in SharePoint', '01 Haalbaarheid tot en met 99 Extern gedeeld'], ['extern_url', 'Extern gedeeld', 'Alleen wat externe partijen mogen zien'], ['notitieblok_url', 'Notitieblok', 'Notities uit het projectoverleg']] as const)" :key="veld">
            <dt><label :for="`g-${veld}`">{{ naam }}</label></dt>
            <dd class="met-link">
              <input :id="`g-${veld}`" class="veld" :value="project[veld] ?? ''" placeholder="Plak de link" @change="e => link(veld, e)">
              <a v-if="isLink(project[veld])" :href="project[veld]!" target="_blank" rel="noopener">Open ↗</a>
            </dd>
            <dd class="klein">{{ uitleg }}</dd>
          </div>
          <div>
            <dt><label for="g-tekeningen">Tekeningen (op aanvraag)</label></dt>
            <dd class="met-link">
              <input id="g-tekeningen" class="veld mono" :value="project.tekeningen_locatie ?? ''" placeholder="Pad op de server" @change="e => tekst('tekeningen_locatie', e)">
              <button v-if="project.tekeningen_locatie" type="button" class="link" @click="kopieer">Kopieer</button>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
