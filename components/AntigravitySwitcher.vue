<template>
  <div class="glass-panel p-6">
    <h3 class="text-xl font-bold text-white mb-2 flex items-center justify-between">
      <span class="flex items-center gap-2">
        <span class="text-purple-400">⚡</span>
        Antigravity & YouTube Entegrasyon İstasyonu
      </span>
      <span v-if="activeAccount" class="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold">
        Aktif Hesap Hazır
      </span>
    </h3>
    <p class="text-sm text-gray-400 mb-6">Yeni satın aldığınız indirimli Gemini Pro hesabını ana Antigravity ve YouTube oturumu olarak güncelleyin.</p>

    <div v-if="activeAccount" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <!-- Antigravity IDE Card -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-purple-500/30">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-purple-400">Antigravity IDE</span>
          <span class="text-[11px] text-gray-400 font-mono">v3.6 Pro</span>
        </div>
        <p class="text-sm font-semibold text-white mb-1 truncate">{{ activeAccount.email }}</p>
        <p class="text-xs text-gray-400 mb-4">{{ activeAccount.geminiPlan }}</p>
        <button
          @click="syncAntigravity"
          :disabled="syncing"
          class="w-full py-2 px-3 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 text-xs font-semibold transition flex items-center justify-center gap-2"
        >
          <span v-if="syncing" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>Antigravity Hesabını Güncelle</span>
        </button>
      </div>

      <!-- YouTube App Card -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-red-500/30">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-red-400">YouTube Mobile & Web</span>
          <span class="text-[11px] text-gray-400">Premium / Active</span>
        </div>
        <p class="text-sm font-semibold text-white mb-1 truncate">{{ activeAccount.email }}</p>
        <p class="text-xs text-gray-400 mb-4">Telefon ve TV uygulamalarında ikincil hesap olarak ekleyin.</p>
        <a
          href="https://accounts.google.com/AddSession"
          target="_blank"
          class="w-full py-2 px-3 rounded-lg bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 text-red-200 text-xs font-semibold transition flex items-center justify-center gap-2 text-center"
        >
          YouTube Hesabı Ekle (Add Session) ↗
        </a>
      </div>
    </div>

    <div v-else class="bg-gray-900/50 rounded-xl p-6 text-center text-gray-400 text-sm border border-gray-800">
      Henüz tanımlı aktif bir Gemini Pro hesabı yok. Yukarıdaki sihirbazı başlatarak 3 aylık indirimli hesabınızı oluşturun.
    </div>

    <!-- Sync Toast Message -->
    <div v-if="toastMessage" class="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  activeAccount: {
    email: string
    geminiPlan: string
    status: string
  } | null
}>()

const syncing = ref(false)
const toastMessage = ref('')

async function syncAntigravity() {
  syncing.value = true
  toastMessage.value = ''
  try {
    const res = await $fetch('/api/antigravity/sync', { method: 'POST' })
    if (res.success) {
      toastMessage.value = res.message || 'Antigravity konfigürasyonu başarıyla güncellendi!'
    } else {
      toastMessage.value = `Hata: ${res.error}`
    }
  } catch (err: any) {
    toastMessage.value = `Hata: ${err?.message || err}`
  } finally {
    syncing.value = false
    setTimeout(() => { toastMessage.value = '' }, 6000)
  }
}
</script>
