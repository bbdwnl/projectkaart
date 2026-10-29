<script setup lang="ts">
// Een lijst met namen om te bewerken: hernoemen in het veld, omhoog en omlaag, weghalen, en onderaan toevoegen.
// Wie al op een project staat en uit de lijst gaat, blijft daar staan; je kiest hem alleen niet meer.
const namen = defineModel<string[]>({ required: true })
const props = defineProps<{ label: string, voorbeeld?: string }>()
const nieuw = ref('')

function voegToe() {
  const n = nieuw.value.trim().replace(/\s+/g, ' ')
  if (!n) return
  if (namen.value.some(x => x.toLowerCase() === n.toLowerCase())) {
    nieuw.value = ''
    return
  }
  namen.value = [...namen.value, n]
  nieuw.value = ''
}
function hernoem(i: number, e: Event) {
  const invoer = e.target as HTMLInputElement
  const n = invoer.value.trim().replace(/\s+/g, ' ')
  if (!n || namen.value.some((x, j) => j !== i && x.toLowerCase() === n.toLowerCase())) {
    invoer.value = namen.value[i]!
    return
  }
  namen.value = namen.value.map((x, j) => (j === i ? n : x))
}
function schuif(i: number, d: -1 | 1) {
  const l = [...namen.value]
  ;[l[i], l[i + d]] = [l[i + d]!, l[i]!]
  namen.value = l
}
const weg = (i: number) => { namen.value = namen.value.filter((_, j) => j !== i) }
</script>

<template>
  <div class="inst-lijst">
    <ol v-if="namen.length" class="inst-items">
      <li v-for="(n, i) in namen" :key="`${i}-${n}`">
        <input class="veld" :value="n" :aria-label="`${props.label}: ${n}`" @change="e => hernoem(i, e)">
        <span class="inst-knopjes">
          <button type="button" class="ikoon" :disabled="i === 0" :aria-label="`${n} omhoog`" title="Omhoog" @click="schuif(i, -1)">↑</button>
          <button type="button" class="ikoon" :disabled="i === namen.length - 1" :aria-label="`${n} omlaag`" title="Omlaag" @click="schuif(i, 1)">↓</button>
          <button type="button" class="ikoon" :aria-label="`${n} weghalen`" title="Weghalen" @click="weg(i)">✕</button>
        </span>
      </li>
    </ol>
    <p v-else class="klein">Nog niemand.</p>
    <form class="inst-nieuw" @submit.prevent="voegToe">
      <input v-model="nieuw" class="veld" :placeholder="voorbeeld ?? 'Naam'" :aria-label="`Nieuw bij ${label}`">
      <button type="submit" class="knop klein" :disabled="!nieuw.trim()">Toevoegen</button>
    </form>
  </div>
</template>
