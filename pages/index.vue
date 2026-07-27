<template>
  <div class="space-y-8">
    <!-- Top Action Banner -->
    <div class="glass-panel p-6 border border-purple-500/30 relative overflow-hidden">
      <div class="absolute -top-24 -right-24 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div>
          <h2 class="text-2xl font-extrabold text-white mb-2">
            3 Aylık İndirimli Gemini Pro Hesabı Oluştur & Aktifleştir
          </h2>
          <p class="text-sm text-gray-300 max-w-2xl">
            Yeni Google/Gmail hesabını otomatik açar, indirimli Gemini Pro kampanyasına yönlendirir, kart & SMS onayının ardından Antigravity ve YouTube hesaplarınızı 3 aylık yeni hesaba günceller.
          </p>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <button
            @click="startAutomation"
            :disabled="starting || (automationState.step !== 'idle' && automationState.step !== 'completed' && automationState.step !== 'error')"
            class="px-6 py-3 rounded-xl gradient-bg hover:opacity-90 font-bold text-sm text-white shadow-glow flex items-center gap-2 transition disabled:opacity-50"
          >
            <span v-if="starting" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            <span>⚡ Yeni Hesap Otomasyonunu Başlat</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Active Step Wizard -->
    <AutomationWizard
      :state="automationState"
      @stop="stopAutomation"
    />

    <!-- Interactive Prompt Action Station (SMS / Phone / Payment) -->
    <div
      v-if="automationState.requiresInput || automationState.step === 'waiting_phone_number' || automationState.step === 'waiting_sms_code'"
      class="glass-panel p-6 border-2 border-purple-500/50 shadow-glow animate-pulse-glow"
    >
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0 text-xl font-bold">
          ⚡
        </div>
        <div class="flex-1">
          <h4 class="text-lg font-bold text-white mb-1">
            {{ automationState.requiresInput?.title || (automationState.step === 'waiting_phone_number' ? 'Telefon Numarası Gerekli' : 'SMS Doğrulama Kodu Gerekli') }}
          </h4>
          <p class="text-sm text-gray-300 mb-3">
            {{ automationState.requiresInput?.description || 'Google doğrulaması için bilgiyi girip onaylayın:' }}
          </p>

          <div v-if="automationState.account" class="mb-4 p-3 rounded-xl bg-gray-900/90 border border-purple-500/30 text-xs flex flex-wrap items-center justify-between gap-3 font-mono">
            <span class="text-purple-200">📧 Mail: <strong class="text-white">{{ automationState.account.email }}</strong></span>
            <span v-if="automationState.account.password" class="text-emerald-300">🔑 Şifre: <strong class="text-emerald-200">{{ automationState.account.password }}</strong></span>
          </div>

          <form @submit.prevent="submitDirectInput" class="flex flex-col sm:flex-row gap-3">
            <input
              v-if="automationState.requiresInput?.type !== 'payment_confirm' && automationState.requiresInput?.type !== 'manual_action'"
              v-model="directInputValue"
              type="text"
              :placeholder="automationState.step === 'waiting_phone_number' ? '05XXXXXXXXX' : (automationState.requiresInput?.placeholder || 'Girdi girin...')"
              required
              class="flex-1 bg-gray-900/90 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
            />

            <button
              type="submit"
              :disabled="inputSubmitting"
              class="px-6 py-2.5 rounded-xl gradient-bg hover:opacity-90 font-semibold text-sm text-white shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <span v-if="inputSubmitting" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>
                {{
                  automationState.requiresInput?.type === 'payment_confirm'
                    ? 'Ödeme ve SMS Tamamlandı, Devam Et'
                    : automationState.requiresInput?.type === 'manual_action'
                    ? 'İşlem Tamamlandı, İlerle'
                    : 'Gönder ve İlerle'
                }}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- Main Grid: Live Browser Stream + Log Stream -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <LiveBrowserStream :screenshot="automationState.screenshot" />
      </div>

      <!-- Live Terminal / Logs Panel -->
      <div class="glass-panel p-5 flex flex-col h-full">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-bold text-gray-200 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-purple-400"></span>
            İşlem Günlükleri (Logs)
          </h4>
          <span class="text-[10px] text-gray-500 font-mono">{{ automationState.logs.length }} Kayıt</span>
        </div>

        <div class="flex-1 bg-gray-950/90 rounded-xl p-3 border border-gray-800 font-mono text-xs overflow-y-auto max-h-[340px] space-y-2">
          <div
            v-for="(log, idx) in automationState.logs"
            :key="idx"
            class="flex items-start gap-2"
          >
            <span class="text-gray-500 shrink-0 text-[10px]">{{ log.timestamp }}</span>
            <span :class="getLogTypeClass(log.type)">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Antigravity & YouTube Switcher Station -->
    <AntigravitySwitcher :active-account="activeAccount" />

    <!-- Account History & 3-Month Reminders -->
    <AccountHistory :accounts="accounts" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AutomationWizard from '~/components/AutomationWizard.vue'
import ManualInputModal from '~/components/ManualInputModal.vue'
import LiveBrowserStream from '~/components/LiveBrowserStream.vue'
import AntigravitySwitcher from '~/components/AntigravitySwitcher.vue'
import AccountHistory from '~/components/AccountHistory.vue'

const starting = ref(false)
const accounts = ref<any[]>([])
const activeAccount = ref<any>(null)

const automationState = ref<any>({
  id: '',
  step: 'idle',
  stepTitle: 'Hazır',
  stepDescription: 'Otomasyon başlatılmayı bekliyor.',
  progressPercent: 0,
  logs: [],
  screenshot: null,
  account: null,
  requiresInput: null,
})

let pollInterval: any = null

async function fetchStatus() {
  try {
    const data: any = await $fetch('/api/automation/status')
    if (data) {
      automationState.value = data
    }
  } catch (err) {
    // Status polling error handled silently
  }
}

async function fetchAccounts() {
  try {
    const data: any = await $fetch('/api/accounts')
    if (data) {
      accounts.value = data.accounts || []
      activeAccount.value = data.activeAccount || null
    }
  } catch (err) {
    // Accounts fetch error handled silently
  }
}

async function startAutomation() {
  starting.value = true
  try {
    await $fetch('/api/automation/start', {
      method: 'POST',
      body: { headless: false },
    })
    await fetchStatus()
  } catch (err: any) {
    alert(`Otomasyon başlatılamadı: ${err?.message || err}`)
  } finally {
    starting.value = false
  }
}

async function stopAutomation() {
  try {
    await $fetch('/api/automation/stop', { method: 'POST' })
    await fetchStatus()
  } catch (err: any) {
    // Stop error handled silently
  }
}

const directInputValue = ref('')
const inputSubmitting = ref(false)

async function submitDirectInput() {
  inputSubmitting.value = true
  try {
    await handleInputSubmit(directInputValue.value)
    directInputValue.value = ''
  } finally {
    inputSubmitting.value = false
  }
}

async function handleInputSubmit(inputVal: string) {
  try {
    await $fetch('/api/automation/input', {
      method: 'POST',
      body: { input: inputVal },
    })
    await fetchStatus()
  } catch (err: any) {
    alert(`Girdi gönderilemedi: ${err?.message || err}`)
  }
}

function getLogTypeClass(type: string) {
  if (type === 'error') return 'text-red-400 font-semibold'
  if (type === 'success') return 'text-emerald-400 font-semibold'
  if (type === 'warn') return 'text-amber-400'
  return 'text-gray-300'
}

onMounted(() => {
  fetchStatus()
  fetchAccounts()
  pollInterval = setInterval(() => {
    fetchStatus()
    fetchAccounts()
  }, 1500)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>
