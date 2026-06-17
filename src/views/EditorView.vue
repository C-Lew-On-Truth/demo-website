<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { INTERACTION_SCRIPT_JS } from '../interaction-script'
import {
  PhArrowRight,
  PhArrowClockwise,
  PhTrash,
  PhCopy,
  PhCheck,
  PhLink,
  PhCircleNotch,
  PhWarningCircle,
  PhMagnifyingGlass,
  PhCursorClick,
  PhX,
} from '@phosphor-icons/vue'

// ── Types ──────────────────────────────────────────────────────────────────

interface AdSlot {
  selector: string
  label: string
  name: string
  placementId?: string
}

interface AdVariant {
  id: string; label: string; width: number; height: number; url: string; active: boolean
}
interface AdGroup {
  id: string; label: string; active: boolean; children: AdVariant[]
}
interface PlayData {
  advertiserName: string; campaignName: string; ads: AdGroup[]
}

// ── State ──────────────────────────────────────────────────────────────────

const DEFAULT_TAG = `<!-- SeenThis Ad Display Tag -->
<div>
  <script data-pid="YOUR_PID_HERE"
    src="https://cdn.seenthis.net/seenthis.v2.min.js" async><\/script>
</div>`

const url = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const pageHtml = ref<string | null>(null)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const adSlots = ref<AdSlot[]>([])
const slotsLoading = ref(false)
const tagCode = ref(DEFAULT_TAG)
const adSize = ref('300x250')
const generatingPreview = ref(false)
const previewUrl = ref<string | null>(null)
const copied = ref(false)
const pickMode = ref(false)

const inputMode = ref<'tag' | 'preview-url'>('tag')
const previewUrlInput = ref('')
const playData = ref<PlayData | null>(null)
const playLoading = ref(false)
const playError = ref<string | null>(null)
const selectedVariant = ref<(AdVariant & { groupLabel: string }) | null>(null)

const placedCount = computed(() => adSlots.value.filter(s => s.placementId).length)

let slotsTimeout: ReturnType<typeof setTimeout> | null = null

// Pick the closest standard ad size that fits within the given element dimensions.
function closestAdSize(w: number, h: number): string {
  const sizes = [
    { key: '970x250', w: 970, h: 250 },
    { key: '728x90',  w: 728, h: 90  },
    { key: '300x600', w: 300, h: 600 },
    { key: '300x250', w: 300, h: 250 },
    { key: '160x600', w: 160, h: 600 },
    { key: '320x100', w: 320, h: 100 },
    { key: '320x50',  w: 320, h: 50  },
  ]
  let best = 'auto'
  let bestScore = Infinity
  for (const s of sizes) {
    // Only consider sizes that fit inside the element (with a 20% tolerance)
    if (s.w > w * 1.2 || s.h > h * 1.2) continue
    const score = Math.abs(s.w / s.h - w / h) + Math.abs(s.w - w) / Math.max(w, 1)
    if (score < bestScore) { bestScore = score; best = s.key }
  }
  return best
}

// ── Core actions ───────────────────────────────────────────────────────────

async function scrape() {
  const raw = url.value.trim()
  if (!raw) return
  const target = raw.startsWith('http') ? raw : `https://${raw}`

  loading.value = true
  slotsLoading.value = false
  error.value = null
  pageHtml.value = null
  adSlots.value = []
  previewUrl.value = null
  pickMode.value = false
  if (slotsTimeout) clearTimeout(slotsTimeout)

  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`
    const res = await fetch(proxyUrl)
    if (!res.ok) throw new Error(`Proxy error ${res.status} — could not fetch page`)
    const data = await res.json()
    if (!data.contents) throw new Error('Could not load page — the site may block proxy access')

    const parsedUrl = new URL(target)
    const basePath = parsedUrl.pathname.replace(/\/[^/]*$/, '/') || '/'

    const parser = new DOMParser()
    const doc = parser.parseFromString(data.contents as string, 'text/html')

    doc.querySelectorAll('base').forEach(el => el.remove())
    doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"], meta[http-equiv="content-security-policy"]').forEach(el => el.remove())

    const base = doc.createElement('base')
    base.href = `${parsedUrl.origin}${basePath}`
    doc.head.prepend(base)

    doc.querySelectorAll<HTMLElement>('[src^="//"]').forEach(el => {
      el.setAttribute('src', 'https:' + el.getAttribute('src'))
    })
    doc.querySelectorAll<HTMLElement>('[href^="//"]').forEach(el => {
      const rel = el.getAttribute('rel')
      if (rel === 'canonical' || rel === 'alternate') return
      el.setAttribute('href', 'https:' + el.getAttribute('href'))
    })

    const scriptEl = doc.createElement('script')
    scriptEl.id = '__ad-placer__'
    scriptEl.textContent = INTERACTION_SCRIPT_JS
    doc.body.appendChild(scriptEl)

    pageHtml.value = '<!DOCTYPE html>' + doc.documentElement.outerHTML
    slotsLoading.value = true
    slotsTimeout = setTimeout(() => {
      slotsLoading.value = false
      if (adSlots.value.length === 0) startPickMode()
    }, 6000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load page'
  } finally {
    loading.value = false
  }
}

function placeTag(slot: AdSlot) {
  if (slot.placementId) return
  const tag = tagCode.value.trim()
  if (!tag || tag.includes('YOUR_PID_HERE')) {
    error.value = 'Enter your tag code or select a SeenThis variant before placing an ad'
    return
  }
  error.value = null
  const id = Math.random().toString(36).slice(2, 10)
  slot.placementId = id
  const [sw, sh] = adSize.value !== 'auto' ? adSize.value.split('x').map(Number) : [0, 0]
  iframeRef.value?.contentWindow?.postMessage(
    { type: 'ap:insert', id, selector: slot.selector, tagHtml: tag, size: sw ? { w: sw, h: sh } : null },
    '*',
  )
  previewUrl.value = null
}

function removeTag(slot: AdSlot) {
  if (!slot.placementId) return
  const id = slot.placementId
  slot.placementId = undefined
  iframeRef.value?.contentWindow?.postMessage({ type: 'ap:remove', id }, '*')
  previewUrl.value = null
}

function startPickMode() {
  pickMode.value = true
  iframeRef.value?.contentWindow?.postMessage({ type: 'ap:start-pick' }, '*')
}

function cancelPickMode() {
  pickMode.value = false
  iframeRef.value?.contentWindow?.postMessage({ type: 'ap:cancel-pick' }, '*')
}

function rescan() {
  adSlots.value = []
  slotsLoading.value = true
  pickMode.value = false
  if (slotsTimeout) clearTimeout(slotsTimeout)
  slotsTimeout = setTimeout(() => {
    slotsLoading.value = false
    if (adSlots.value.length === 0) startPickMode()
  }, 6000)
  iframeRef.value?.contentWindow?.postMessage({ type: 'ap:rescan' }, '*')
}

// ── Message handler from iframe ────────────────────────────────────────────

function handleMessage(e: MessageEvent) {
  if (!e.data || typeof e.data !== 'object') return

  if (e.data.type === 'ap:slots') {
    if (slotsTimeout) clearTimeout(slotsTimeout)
    slotsLoading.value = false
    const existing = new Map(adSlots.value.map(s => [s.selector, s.placementId]))
    const incoming = (e.data.slots as AdSlot[]).map(s => ({ ...s, placementId: existing.get(s.selector) }))
    // Merge: keep placed slots, add new unplaced ones
    adSlots.value = incoming
    if (adSlots.value.length === 0) startPickMode()
    return
  }

  if (e.data.type === 'ap:slot-added') {
    const slot = e.data.slot as AdSlot
    adSlots.value.push(slot)
    // Auto-size based on the element's actual dimensions, then immediately place
    if (e.data.rect) adSize.value = closestAdSize(e.data.rect.w, e.data.rect.h)
    placeTag(slot)
    return
  }

  if (e.data.type === 'ap:pick-done') {
    pickMode.value = false
    return
  }

  if (e.data.type === 'ap:click') {
    const slot = adSlots.value.find(s => s.selector === e.data.selector)
    if (!slot) return
    if (slot.placementId) removeTag(slot)
    else placeTag(slot)
  }

  if (e.data.type === 'ap:html-result') {
    pendingPreviewHtml = e.data.html as string
  }
}

// ── Generate preview ───────────────────────────────────────────────────────

let pendingPreviewHtml = ''
let previewResolve: ((html: string) => void) | null = null

async function generatePreview() {
  if (!pageHtml.value || placedCount.value === 0) return
  generatingPreview.value = true
  error.value = null
  try {
    const html = await new Promise<string>((resolve, reject) => {
      previewResolve = resolve
      const timeout = setTimeout(() => reject(new Error('Timed out reading page — try again')), 8000)
      const origResolve = resolve
      previewResolve = (h: string) => { clearTimeout(timeout); origResolve(h) }
      iframeRef.value?.contentWindow?.postMessage({ type: 'ap:get-html' }, '*')
    })

    const id = Math.random().toString(36).slice(2, 18)
    localStorage.setItem(`preview-${id}`, html)
    const base = `${window.location.origin}${window.location.pathname}`
    previewUrl.value = `${base}#/preview/${id}`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to generate preview'
  } finally {
    generatingPreview.value = false
  }
}

// Patch handleMessage to resolve the preview promise
const _origHandle = handleMessage
function handleMessagePatched(e: MessageEvent) {
  _origHandle(e)
  if (e.data?.type === 'ap:html-result' && previewResolve) {
    const resolve = previewResolve
    previewResolve = null
    resolve(e.data.html as string)
  }
}

async function copyPreviewUrl() {
  if (!previewUrl.value) return
  await navigator.clipboard.writeText(previewUrl.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// ── Preview URL mode ───────────────────────────────────────────────────────

function selectVariant(group: AdGroup, variant: AdVariant) {
  selectedVariant.value = { ...variant, groupLabel: group.label }
  tagCode.value = `<iframe src="${variant.url}" width="${variant.width}" height="${variant.height}" frameborder="0" scrolling="no" style="border:0;display:block;"></iframe>`
  adSize.value = `${variant.width}x${variant.height}`
}

function setInputMode(mode: 'tag' | 'preview-url') {
  inputMode.value = mode
  if (mode === 'tag') {
    previewUrlInput.value = ''
    playData.value = null
    playError.value = null
    selectedVariant.value = null
    tagCode.value = DEFAULT_TAG
    adSize.value = '300x250'
  }
}

async function fetchPlayInfo(u: string) {
  playLoading.value = true
  playError.value = null
  playData.value = null
  try {
    const match = typeof u === 'string' && u.match(/ad-previews\.seenthis\.co\/play\/([^?#\s]+)/)
    if (!match) throw new Error('Not a valid SeenThis preview URL')
    const playId = match[1]

    let data: PlayData
    try {
      const res = await fetch(`https://play-backend.seenthis.co/preview/${playId}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error('Preview not found or access denied')
      data = await res.json()
    } catch {
      // Direct fetch blocked (CORS) — route through allorigins proxy
      const proxyRes = await fetch(
        `https://api.allorigins.win/get?url=${encodeURIComponent(`https://play-backend.seenthis.co/preview/${playId}`)}`,
        { signal: AbortSignal.timeout(15_000) },
      )
      if (!proxyRes.ok) throw new Error('Could not reach SeenThis backend')
      const proxyData = await proxyRes.json()
      data = JSON.parse(proxyData.contents as string) as PlayData
    }

    playData.value = data
  } catch (e) {
    playError.value = e instanceof Error ? e.message : 'Failed to load preview'
  } finally {
    playLoading.value = false
  }
}

let _playTimer: ReturnType<typeof setTimeout> | null = null
watch(previewUrlInput, (val) => {
  if (_playTimer) clearTimeout(_playTimer)
  playData.value = null
  playError.value = null
  selectedVariant.value = null
  if (!val.includes('ad-previews.seenthis.co/play/')) return
  _playTimer = setTimeout(() => fetchPlayInfo(val), 600)
})

onMounted(() => window.addEventListener('message', handleMessagePatched))
onUnmounted(() => {
  window.removeEventListener('message', handleMessagePatched)
  if (slotsTimeout) clearTimeout(slotsTimeout)
})
</script>

<template>
  <div class="flex flex-col h-screen bg-white overflow-hidden" style="font-family:system-ui,sans-serif;color:#1b1813;">

    <!-- Header -->
    <header class="shrink-0 flex items-center gap-4 px-4 py-2.5 border-b bg-[#fcfbfa]" style="border-color:#e3dacf">
      <div class="flex items-center gap-2 shrink-0">
        <div class="w-7 h-7 rounded flex items-center justify-center text-white text-[11px] font-bold" style="background:#ff5500">ST</div>
        <span class="text-sm font-semibold tracking-tight">Ad Placer</span>
      </div>
      <form class="flex flex-1 items-center gap-2 max-w-2xl" @submit.prevent="scrape">
        <input
          v-model="url"
          type="url"
          placeholder="https://example.com"
          class="flex-1 h-9 rounded-md border px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition"
          style="border-color:#e3dacf;color:#1b1813;"
        />
        <button
          type="submit"
          :disabled="loading"
          class="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition shrink-0"
          style="background:#1572ed"
        >
          <PhCircleNotch v-if="loading" :size="14" class="animate-spin" />
          <PhMagnifyingGlass v-else :size="14" />
          {{ loading ? 'Loading…' : 'Load Page' }}
        </button>
      </form>
    </header>

    <!-- Error banner -->
    <div v-if="error" class="shrink-0 flex items-center gap-2 px-4 py-2 text-sm border-b" style="background:#fff0ee;border-color:#fcc;color:#f43009;">
      <PhWarningCircle :size="14" weight="fill" />{{ error }}
    </div>

    <!-- Body -->
    <div class="flex flex-1 overflow-hidden">

      <!-- Page iframe panel -->
      <div class="relative flex-1 overflow-hidden" style="background:#e8e4df">

        <!-- Empty state -->
        <div v-if="!pageHtml && !loading" class="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none" style="color:#767471">
          <PhMagnifyingGlass :size="48" class="opacity-20" />
          <p class="text-sm">Enter any URL above to load a page</p>
          <p class="text-xs" style="color:#a09c98">Ad slots on the page will be highlighted automatically</p>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10" style="background:rgba(255,255,255,0.88)">
          <PhCircleNotch :size="34" class="animate-spin" style="color:#1572ed" />
          <p class="text-sm" style="color:#767471">Loading page…</p>
          <p class="text-xs" style="color:#a09c98">Fetching via proxy — JS-rendered content may not appear</p>
        </div>

        <!-- Status badge -->
        <div v-if="pageHtml && !loading" class="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <span v-if="pickMode" class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white shadow" style="background:rgba(255,85,0,0.92)">
            <PhCursorClick :size="11" />
            Click any element on the page to mark it as an ad slot — Esc to cancel
          </span>
          <span v-else-if="slotsLoading" class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white shadow" style="background:rgba(27,24,19,0.72)">
            <PhCircleNotch :size="11" class="animate-spin" />
            Scanning for ad slots…
          </span>
          <span v-else-if="adSlots.length" class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white shadow" style="background:rgba(27,24,19,0.72)">
            {{ adSlots.length }} slot{{ adSlots.length !== 1 ? 's' : '' }} detected — click a highlighted area to select
          </span>
        </div>

        <iframe
          v-if="pageHtml"
          ref="iframeRef"
          :srcdoc="pageHtml"
          class="w-full h-full border-0"
          title="Page preview"
        />
      </div>

      <!-- Sidebar -->
      <aside class="w-80 shrink-0 flex flex-col border-l overflow-hidden" style="border-color:#e3dacf;background:#fcfbfa">

        <!-- Ad tag / preview URL input -->
        <div class="p-4 border-b" style="border-color:#e3dacf">
          <!-- Mode toggle -->
          <div class="flex rounded-md overflow-hidden border mb-3 text-[11px] font-medium" style="border-color:#e3dacf">
            <button
              class="flex-1 py-1 transition"
              :style="inputMode === 'tag' ? 'background:#1572ed;color:white' : 'background:white;color:#767471'"
              @click="setInputMode('tag')"
            >Tag Code</button>
            <button
              class="flex-1 py-1 transition"
              :style="inputMode === 'preview-url' ? 'background:#1572ed;color:white;border-left-color:#1572ed' : 'background:white;color:#767471;border-left:1px solid #e3dacf'"
              @click="setInputMode('preview-url')"
            >Preview URL</button>
          </div>

          <!-- Tag mode -->
          <template v-if="inputMode === 'tag'">
            <textarea
              v-model="tagCode"
              rows="5"
              spellcheck="false"
              class="w-full text-[11px] font-mono rounded-md border p-2.5 bg-white resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              style="border-color:#e3dacf;color:#1b1813"
              placeholder="Paste your SeenThis tag code here…"
            />
            <div class="flex items-center gap-2 mt-2.5">
              <label class="text-[10px] font-semibold uppercase tracking-widest shrink-0" style="color:#767471">Size</label>
              <select
                v-model="adSize"
                class="flex-1 h-7 text-[11px] rounded border px-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none"
                style="border-color:#e3dacf;color:#1b1813"
              >
                <option value="auto">Auto — fit slot</option>
                <option value="300x250">300×250 — MREC</option>
                <option value="728x90">728×90 — Leaderboard</option>
                <option value="320x50">320×50 — Mobile Banner</option>
                <option value="320x100">320×100 — Large Mobile</option>
                <option value="160x600">160×600 — Skyscraper</option>
                <option value="300x600">300×600 — Half Page</option>
                <option value="970x250">970×250 — Billboard</option>
              </select>
            </div>
          </template>

          <!-- Preview URL mode -->
          <template v-else>
            <input
              v-model="previewUrlInput"
              type="url"
              placeholder="https://ad-previews.seenthis.co/play/…"
              class="w-full h-9 rounded-md border px-3 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              style="border-color:#e3dacf;color:#1b1813"
            />
            <div v-if="playLoading" class="flex items-center gap-1.5 mt-3 text-[11px]" style="color:#767471">
              <PhCircleNotch :size="12" class="animate-spin" style="color:#1572ed" />
              Fetching ad sizes…
            </div>
            <div v-else-if="playError" class="mt-3 text-[11px] rounded-md px-2.5 py-2" style="background:#fff0ee;color:#f43009">{{ playError }}</div>
            <div v-else-if="playData" class="mt-3 max-h-44 overflow-y-auto">
              <p class="text-[10px] mb-2 font-medium truncate" style="color:#1b1813" :title="`${playData.advertiserName} · ${playData.campaignName}`">
                {{ playData.advertiserName }} · {{ playData.campaignName }}
              </p>
              <div v-for="group in playData.ads.filter(g => g.active)" :key="group.id" class="mb-3">
                <p class="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style="color:#767471">{{ group.label }}</p>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="variant in group.children.filter(c => c.active)"
                    :key="variant.id"
                    class="text-[10px] font-medium rounded px-2 py-0.5 border transition"
                    :style="selectedVariant?.id === variant.id
                      ? 'background:#ff5500;color:white;border-color:#ff5500'
                      : 'background:white;color:#1b1813;border-color:#e3dacf'"
                    @click="selectVariant(group, variant)"
                  >{{ variant.label }}</button>
                </div>
              </div>
              <p v-if="!selectedVariant" class="text-[11px] mt-1" style="color:#a09c98">Select a size above</p>
              <div v-else class="text-[11px] mt-2 rounded-md px-2.5 py-2" style="background:rgba(255,85,0,0.06);color:#ff5500">
                ✓ {{ selectedVariant.groupLabel }} · {{ selectedVariant.label }}
              </div>
            </div>
            <p v-else class="mt-2 text-[11px]" style="color:#a09c98">Paste a SeenThis preview URL above</p>
          </template>
        </div>

        <!-- Slots list -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-4 pt-3 pb-2">
            <span class="text-[10px] font-semibold uppercase tracking-widest" style="color:#767471">Ad Slots</span>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                :style="adSlots.length ? 'background:#1572ed;color:white' : 'background:#e3dacf;color:#767471'"
              >{{ adSlots.length }}</span>
              <template v-if="pageHtml">
                <button
                  :disabled="slotsLoading || pickMode"
                  class="flex items-center gap-1 text-[11px] font-medium transition disabled:opacity-40"
                  style="color:#767471"
                  @click="rescan"
                >
                  <PhArrowClockwise :size="12" :class="slotsLoading ? 'animate-spin' : ''" />
                  Rescan
                </button>
                <button
                  v-if="!pickMode"
                  :disabled="slotsLoading"
                  class="flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5 disabled:opacity-40"
                  style="color:#ff5500;background:rgba(255,85,0,0.08)"
                  @click="startPickMode"
                >
                  <PhCursorClick :size="12" />
                  Pick
                </button>
                <button
                  v-else
                  class="flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5"
                  style="color:#f43009;background:rgba(244,48,9,0.08)"
                  @click="cancelPickMode"
                >
                  <PhX :size="12" />
                  Cancel
                </button>
              </template>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-4 pb-2">

            <div v-if="slotsLoading" class="flex items-center gap-2 py-6 justify-center" style="color:#767471">
              <PhCircleNotch :size="16" class="animate-spin" style="color:#1572ed" />
              <span class="text-xs">Scanning page for ad slots…</span>
            </div>

            <div v-else-if="!pageHtml" class="text-center py-8 px-2" style="color:#767471">
              <PhMagnifyingGlass :size="28" class="mx-auto mb-2 opacity-20" />
              <p class="text-xs">Load a page to find ad slots</p>
            </div>

            <div v-else-if="pickMode && !adSlots.length" class="py-6 text-center px-2" style="color:#767471">
              <PhCursorClick :size="24" class="mx-auto mb-2 opacity-30" />
              <p class="text-xs font-medium">Click any element on the page</p>
              <p class="text-[11px] mt-1" style="color:#a09c98">Hover to highlight, click to select it as an ad slot</p>
            </div>

            <ul v-else-if="adSlots.length" class="space-y-2">
              <li
                v-for="slot in adSlots"
                :key="slot.selector"
                class="rounded-lg border p-3"
                :style="slot.placementId
                  ? 'border-color:#ff5500;background:rgba(255,85,0,0.04)'
                  : 'border-color:#e3dacf;background:white'"
              >
                <div class="flex items-start gap-2 mb-2">
                  <span class="w-2 h-2 rounded-full mt-1 shrink-0" :style="slot.placementId ? 'background:#ff5500' : 'background:#1572ed'" />
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-semibold">{{ slot.label }}</p>
                    <code class="text-[10px] truncate block mt-0.5" style="color:#767471">{{ slot.name }}</code>
                  </div>
                  <span v-if="slot.placementId" class="shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 mt-0.5" style="background:rgba(255,85,0,0.12);color:#ff5500">
                    Placed
                  </span>
                </div>

                <button
                  v-if="!slot.placementId"
                  class="w-full flex items-center justify-center gap-1.5 h-7 rounded text-xs font-medium text-white transition"
                  style="background:#ff5500"
                  @click="placeTag(slot)"
                >
                  Place SeenThis Ad
                </button>

                <div v-else class="flex items-center gap-2">
                  <span class="flex-1 text-[11px]" style="color:#767471">✓ SeenThis ad active</span>
                  <button class="flex items-center gap-1 text-[11px] font-medium" style="color:#f43009" @click="removeTag(slot)">
                    <PhTrash :size="12" />Remove
                  </button>
                </div>
              </li>
            </ul>

            <div v-else class="text-center py-8 px-2" style="color:#767471">
              <PhCursorClick :size="28" class="mx-auto mb-2 opacity-30" />
              <p class="text-xs font-medium">No ad slots detected</p>
              <p class="text-[11px] mt-1" style="color:#a09c98">Use Pick mode to manually select any element</p>
            </div>
          </div>
        </div>

        <!-- Generate preview -->
        <div class="p-4 border-t shrink-0" style="border-color:#e3dacf">
          <button
            :disabled="!pageHtml || placedCount === 0 || generatingPreview"
            class="w-full inline-flex items-center justify-center gap-2 h-9 rounded-md text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
            style="background:#1572ed"
            @click="generatePreview"
          >
            <PhCircleNotch v-if="generatingPreview" :size="14" class="animate-spin" />
            <PhLink v-else :size="14" />
            {{ generatingPreview ? 'Generating…' : `Generate Preview${placedCount ? ` (${placedCount})` : ''}` }}
          </button>

          <p v-if="placedCount === 0 && pageHtml" class="mt-1.5 text-center text-[11px]" style="color:#a09c98">
            Place at least one ad to generate a link
          </p>

          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
          >
            <div v-if="previewUrl" class="mt-3">
              <div class="flex items-center gap-1.5 rounded-md border px-2.5 py-2 bg-white" style="border-color:#e3dacf">
                <span class="flex-1 text-[11px] font-mono truncate">{{ previewUrl }}</span>
                <button class="shrink-0 p-0.5 transition-colors" :style="copied ? 'color:#27be51' : 'color:#767471'" @click="copyPreviewUrl">
                  <PhCheck v-if="copied" :size="13" />
                  <PhCopy v-else :size="13" />
                </button>
              </div>
              <a :href="previewUrl" target="_blank" rel="noopener" class="mt-1.5 inline-flex items-center gap-1 text-[11px] hover:underline" style="color:#1572ed">
                Open preview <PhArrowRight :size="11" />
              </a>
            </div>
          </Transition>
        </div>

      </aside>
    </div>
  </div>
</template>
