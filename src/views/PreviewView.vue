<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhArrowLeft, PhCircleNotch, PhWarningCircle } from '@phosphor-icons/vue'

const route = useRoute()
const router = useRouter()
const html = ref<string | null>(null)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await fetch(`/api/preview/${route.params.id}`)
    if (!res.ok) throw new Error('Preview not found or expired')
    const data = await res.json()
    html.value = data.html
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load preview'
  }
})
</script>

<template>
  <div class="flex flex-col h-screen bg-white overflow-hidden" style="font-family:system-ui,sans-serif">

    <!-- Preview header bar -->
    <div class="shrink-0 flex items-center justify-between px-4 h-10 border-b" style="background:#fcfbfa;border-color:#e3dacf">
      <div class="flex items-center gap-3">
        <button
          class="flex items-center gap-1.5 text-xs font-medium transition hover:opacity-70"
          style="color:#1572ed"
          @click="router.push('/')"
        >
          <PhArrowLeft :size="13" />
          Back to editor
        </button>
        <span style="color:#e3dacf">|</span>
        <div class="flex items-center gap-1.5">
          <div class="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold" style="background:#ff5500">ST</div>
          <span class="text-xs font-medium" style="color:#1b1813">Ad Preview</span>
        </div>
      </div>
      <span class="text-[11px]" style="color:#767471">
        Ads are live — share this URL with your client
      </span>
    </div>

    <!-- States -->
    <div v-if="error" class="flex-1 flex flex-col items-center justify-center gap-2" style="color:#f43009">
      <PhWarningCircle :size="32" weight="fill" class="opacity-60" />
      <p class="text-sm font-medium">{{ error }}</p>
      <button class="text-xs underline mt-1" style="color:#1572ed" @click="router.push('/')">Back to editor</button>
    </div>

    <div v-else-if="!html" class="flex-1 flex items-center justify-center" style="color:#767471">
      <PhCircleNotch :size="28" class="animate-spin" style="color:#1572ed" />
    </div>

    <!-- The preview iframe — ad scripts run here -->
    <iframe
      v-else
      :srcdoc="html"
      class="flex-1 w-full border-0"
      title="Ad preview"
      allow="scripts"
    />
  </div>
</template>
