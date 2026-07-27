<template>
  <div v-if="requiresInput" class="glass-panel p-6 border-2 border-purple-500/50 shadow-glow animate-pulse-glow">
    <div class="flex items-start gap-4">
      <div class="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0 text-xl font-bold">
        ⚡
      </div>
      <div class="flex-1">
        <h4 class="text-lg font-bold text-white mb-1">{{ requiresInput.title }}</h4>
        <p class="text-sm text-gray-300 mb-4">{{ requiresInput.description }}</p>

        <form @submit.prevent="handleSubmit" class="flex flex-col sm:flex-row gap-3">
          <input
            v-if="requiresInput.type !== 'payment_confirm'"
            v-model="inputValue"
            type="text"
            :placeholder="requiresInput.placeholder || 'Girdi girin...'"
            required
            class="flex-1 bg-gray-900/90 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
          />

          <button
            type="submit"
            :disabled="loading"
            class="px-6 py-2.5 rounded-xl gradient-bg hover:opacity-90 font-semibold text-sm text-white shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <span v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            <span>{{ requiresInput.type === 'payment_confirm' ? 'Ödeme ve SMS Tamamlandı, Devam Et' : 'Gönder ve İlerle' }}</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  requiresInput: {
    type: 'phone' | 'sms' | 'payment_confirm' | 'manual_action'
    title: string
    description: string
    placeholder?: string
  } | null
}>()

const emit = defineEmits(['submit-input'])

const inputValue = ref('')
const loading = ref(false)

async function handleSubmit() {
  loading.value = true
  await emit('submit-input', inputValue.value)
  inputValue.value = ''
  loading.value = false
}
</script>
