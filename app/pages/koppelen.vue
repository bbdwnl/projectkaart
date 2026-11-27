<script setup lang="ts">
// Copilot koppelen (OAuth, beslissing 46): hier komt een medewerker vanuit Copilot terecht, ingelogd zoals altijd (de
// middleware stuurt eerst naar /login en daarna terug, met alles in de adresbalk). Na Toestaan gaat de browser terug
// naar Copilot met een code; Copilot werkt daarna namens deze medewerker zolang hij het gebruikt (30 dagen zonder
// gebruik, of een jaar na toestaan: opnieuw toestaan). Wie er vraagt, zegt de pagina op grond
// van het terugadres (Microsoft, VS Code), niet alleen op de naam die de client zichzelf gaf. Een programma dat zich
// voor het eerst meldt, moet eerst door iemand van het MT zijn goedgekeurd (beslissing 47): een MT'er doet dat hier in
// één keer met Toestaan, een collega vraagt het MT (Instellingen → Copilot).
useHead({ title: 'Copilot koppelen · Projectkaart' })
const route = useRoute()
const { gebruiker } = useGebruiker()
const metInlog = useMetInlog()

const q = computed(() => Object.fromEntries(Object.entries(route.query).map(([k, v]) => [k, typeof v === 'string' ? v : undefined])))
const stand = ref<'laden' | 'vraag' | 'fout' | 'onderweg'>('laden')
const fout = ref('')
const client = ref<{ naam: string, soort: string, adres: string, goedgekeurd: boolean } | null>(null)

onMounted(async () => {
  if (!q.value.client_id || !q.value.redirect_uri) {
    fout.value = 'Deze link is niet compleet. Begin opnieuw vanuit Copilot.'
    stand.value = 'fout'
    return
  }
  try {
    client.value = await metInlog('/api/oauth/client', { query: { client_id: q.value.client_id, redirect_uri: q.value.redirect_uri } })
    stand.value = 'vraag'
  } catch (e) {
    fout.value = foutTekst(e)
    stand.value = 'fout'
  }
})

async function antwoord(toestaan: boolean) {
  stand.value = 'onderweg'
  try {
    const { url } = await metInlog<{ url: string }>('/api/oauth/toestaan', {
      method: 'POST',
      body: {
        toestaan,
        // Een MT'er keurt een nieuw programma hiermee ook goed voor alle collega's (de pagina zegt dat erbij).
        goedkeuren: toestaan && client.value?.goedgekeurd === false,
        client_id: q.value.client_id,
        redirect_uri: q.value.redirect_uri,
        response_type: q.value.response_type,
        code_challenge: q.value.code_challenge,
        code_challenge_method: q.value.code_challenge_method,
        state: q.value.state,
      },
    })
    window.location.assign(url)
  } catch (e) {
    fout.value = foutTekst(e)
    stand.value = 'fout'
  }
}
</script>

<template>
  <main class="wrap koppelen">
    <section class="kaart koppelen-kaart">
      <span class="tab">Copilot koppelen</span>
      <div v-if="stand === 'laden'" class="laden" aria-busy="true"><span class="laden-regel" /><span class="laden-regel" /></div>
      <template v-else-if="stand === 'fout'">
        <h1>Dit lukte niet</h1>
        <p>{{ fout }}</p>
        <NuxtLink to="/" class="link">Naar de projectkaart</NuxtLink>
      </template>
      <template v-else-if="client && !client.goedgekeurd && !gebruiker?.isMt">
        <h1>{{ client.soort }} wil namens jou in de projectkaart werken</h1>
        <p class="klein">Het noemt zich <strong>{{ client.naam }}</strong> en gaat na toestaan terug naar <strong>{{ client.adres }}</strong>.</p>
        <p><strong>Dit programma is nog niet goedgekeurd door het MT.</strong> Dat moet eerst, zodat niemand met een eigen "Copilot" jouw toegang kan krijgen. Vraag iemand van het MT het goed te keuren onder Instellingen → Copilot, en begin daarna opnieuw vanuit Copilot.</p>
        <p class="klein">Heb je dit niet zelf vanuit Copilot gestart? Kies dan Weigeren.</p>
        <div class="koppelen-knoppen">
          <button type="button" class="link" :disabled="stand === 'onderweg'" @click="antwoord(false)">Weigeren</button>
          <NuxtLink to="/" class="link">Naar de projectkaart</NuxtLink>
        </div>
      </template>
      <template v-else-if="client">
        <h1>{{ client.soort }} wil namens jou in de projectkaart werken</h1>
        <p class="klein">Het noemt zich <strong>{{ client.naam }}</strong> en gaat na toestaan terug naar <strong>{{ client.adres }}</strong>.</p>
        <p v-if="!client.goedgekeurd" class="koppelen-nieuw"><strong>Dit programma is nieuw.</strong> Met Toestaan keur je het als MT ook goed voor alle collega's. Doe dat alleen als jullie dit zelf hebben ingesteld (de agent in Copilot Studio) of als je het zelf vanuit VS Code startte; twijfel je, kies dan Weigeren.</p>
        <p>Als je toestaat, kan Copilot <strong>als {{ gebruiker?.naam }}</strong>:</p>
        <ul>
          <li>projecten opzoeken en de stand, taken, acties en het logboek lezen;</li>
          <li>taken bijwerken en aftekenen, opmerkingen plaatsen, acties toevoegen en gereed melden, en projectgegevens zoals datums en rollen aanpassen.</li>
        </ul>
        <p>Copilot mag niet meer dan jij, en alles wat het wijzigt of aftekent staat <strong>op jouw naam</strong> in het logboek. Verwijderen, financiën en instellingen kan het niet. Het blijft werken zolang je Copilot gebruikt; na 30 dagen zonder gebruik, of na een jaar, vraagt Copilot opnieuw. Ontkoppelen kan altijd onder Instellingen → Copilot.</p>
        <p class="klein">Heb je dit niet zelf vanuit Copilot gestart? Kies dan Weigeren.</p>
        <div class="koppelen-knoppen">
          <button type="button" class="knop" :disabled="stand === 'onderweg'" @click="antwoord(true)">{{ client.goedgekeurd ? 'Toestaan' : 'Goedkeuren en toestaan' }}</button>
          <button type="button" class="link" :disabled="stand === 'onderweg'" @click="antwoord(false)">Weigeren</button>
        </div>
      </template>
    </section>
  </main>
</template>
