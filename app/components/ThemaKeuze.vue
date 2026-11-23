<script setup lang="ts">
import { THEMAS } from '~/lib/thema'

// Kaarten of Zakelijk: de vormgeving van de hele app. Bovenin de balk, en op mobiel in het menu.
const { thema, zet } = useThema()
</script>

<template>
  <div class="seg themakeuze" role="group" aria-label="Weergave">
    <button v-for="t in THEMAS" :key="t.id" type="button" :aria-pressed="thema === t.id" :title="t.uitleg" @click="zet(t.id)">{{ t.naam }}</button>
  </div>
</template>
