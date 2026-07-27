<template>
  <div class="glass-panel p-5 relative overflow-hidden flex flex-col h-full">
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-sm font-bold text-gray-200 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        Canlı Tarayıcı Görünümü (Live Stream)
      </h4>
      <span class="text-[11px] font-mono bg-gray-900/80 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">
        {{ screenshot ? '1280x800 • Active' : 'Offline' }}
      </span>
    </div>

    <!-- Screenshot Container -->
    <div class="relative flex-1 bg-gray-950 rounded-xl border border-gray-800/80 flex items-center justify-center overflow-hidden min-h-[320px]">
      <img
        v-if="screenshot"
        :src="screenshot"
        alt="Google Automation Browser View"
        class="w-full h-full object-contain transition-opacity duration-300"
      />
      <div v-else class="text-center p-6 text-gray-500">
        <div class="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-3 text-purple-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>
        <p class="text-xs font-medium">Otomasyon başlatıldığında tarayıcı ekranı burada canlı olarak yayınlanacak.</p>
      </div>

      <!-- Live badge -->
      <div v-if="screenshot" class="absolute bottom-3 right-3 bg-gray-900/90 backdrop-blur border border-emerald-500/40 text-emerald-400 text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        CANLI YAYIN
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  screenshot: string | null
}>()
</script>
