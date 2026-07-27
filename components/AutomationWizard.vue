<template>
  <div class="glass-panel p-6 mb-8">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping"></span>
          Otomasyon Süreci
        </h3>
        <p class="text-sm text-gray-400 mt-1">{{ state.stepDescription }}</p>
      </div>

      <div class="flex items-center gap-3">
        <span class="px-3 py-1 rounded-full text-xs font-semibold border" :class="statusBadgeClass">
          {{ state.stepTitle }}
        </span>
        <button
          v-if="state.step !== 'idle' && state.step !== 'completed'"
          @click="$emit('stop')"
          class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-xs font-semibold transition"
        >
          Durdur
        </button>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="w-full bg-gray-800/80 rounded-full h-2.5 mb-6 overflow-hidden">
      <div
        class="gradient-bg h-full rounded-full transition-all duration-500 ease-out"
        :style="{ width: `${state.progressPercent}%` }"
      ></div>
    </div>

    <!-- Step Grid -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div
        v-for="(stepItem, index) in steps"
        :key="stepItem.id"
        class="p-3.5 rounded-xl border transition-all flex items-center gap-3"
        :class="getStepClass(stepItem.id)"
      >
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
          :class="getStepIconClass(stepItem.id)"
        >
          {{ index + 1 }}
        </div>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-gray-200 truncate">{{ stepItem.title }}</p>
          <p class="text-[11px] text-gray-400 truncate">{{ stepItem.sub }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  state: {
    step: string
    stepTitle: string
    stepDescription: string
    progressPercent: number
  }
}>()

defineEmits(['stop'])

const steps = [
  { id: 'mail', title: '1. Mail Açma', sub: 'Yeni Gmail Hesabı' },
  { id: 'gemini', title: '2. Gemini Pro', sub: 'İndirimli Kampanya' },
  { id: 'payment', title: '3. Ödeme & SMS', sub: 'Kart ve 3DS Onayı' },
  { id: 'sync', title: '4. Aktifleme', sub: 'Antigravity & Youtube' }
]

const statusBadgeClass = computed(() => {
  if (props.state.step === 'completed') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  if (props.state.step === 'error') return 'bg-red-500/20 text-red-400 border-red-500/30'
  if (props.state.step === 'idle') return 'bg-gray-800 text-gray-400 border-gray-700'
  return 'bg-purple-500/20 text-purple-300 border-purple-500/30 animate-pulse'
})

function getStepCategory(stepStr: string): string {
  if (['generating_credentials', 'launching_browser', 'creating_google_account', 'waiting_phone_number', 'waiting_sms_code'].includes(stepStr)) return 'mail'
  if (['navigating_gemini_offer'].includes(stepStr)) return 'gemini'
  if (['waiting_payment_checkout'].includes(stepStr)) return 'payment'
  if (['extracting_tokens', 'synced_antigravity', 'completed'].includes(stepStr)) return 'sync'
  return 'none'
}

function getStepClass(stepId: string) {
  const currentCat = getStepCategory(props.state.step)
  if (currentCat === stepId) {
    return 'bg-purple-500/15 border-purple-500/50 shadow-glow'
  }
  return 'bg-gray-900/40 border-gray-800/80 opacity-70'
}

function getStepIconClass(stepId: string) {
  const currentCat = getStepCategory(props.state.step)
  if (currentCat === stepId) {
    return 'bg-purple-600 text-white shadow-sm'
  }
  return 'bg-gray-800 text-gray-400'
}
</script>
