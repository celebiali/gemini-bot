<template>
  <div class="glass-panel p-6">
    <h3 class="text-xl font-bold text-white mb-2 flex items-center justify-between">
      <span class="flex items-center gap-2">
        <span>📜</span>
        3 Aylık Hesap Geçmişi & Aylık Ödeme Takvimi
      </span>
      <span class="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-medium">
        Aylık Ödeme Modeli (1. Ay - 2. Ay - 3. Ay)
      </span>
    </h3>
    <p class="text-sm text-gray-400 mb-6">Açılan Gemini Pro hesaplarınız, her aya ait 3 ayrı ödeme tarihi ve 3. ay sonunda yeni hesaba geçiş takvimi.</p>

    <div v-if="accounts && accounts.length > 0" class="space-y-4">
      <div
        v-for="acc in accounts"
        :key="acc.id"
        class="bg-gray-900/70 border border-gray-800 rounded-xl p-5 space-y-4 glass-card-interactive"
      >
        <!-- Header Info -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center font-bold text-sm shrink-0">
              G
            </div>
            <div>
              <p class="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                {{ acc.email }}
                <span v-if="acc.status === 'active'" class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  AKTİF HESAP
                </span>
              </p>
              <div v-if="acc.password" class="flex items-center gap-2 mt-1">
                <span class="text-xs text-purple-300 font-mono bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/30">
                  🔑 {{ acc.password }}
                </span>
                <button
                  @click="copyToClipboard(acc.password)"
                  class="text-[11px] text-gray-400 hover:text-white underline transition"
                >
                  Kopyala
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-0.5">{{ acc.geminiPlan }} • Kayıt: {{ formatDate(acc.createdDate) }}</p>
            </div>
          </div>

          <div class="flex items-center gap-4 shrink-0">
            <div class="text-right">
              <span class="text-xs font-semibold" :class="getDaysRemainingClass(acc.expiresDate)">
                {{ getRemainingDaysText(acc.expiresDate) }}
              </span>
              <p class="text-[11px] text-gray-500">3 Aylık Döngü Bitişi: {{ formatDate(acc.expiresDate) }}</p>
            </div>
          </div>
        </div>

        <!-- 3 Monthly Payments Breakdown -->
        <div class="border-t border-gray-800/80 pt-3">
          <p class="text-xs font-semibold text-gray-400 mb-2.5">Aylık Ödeme Çekim Takvimi (3 Ay = 3 Ayrı Ödeme):</p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div
              v-for="p in acc.monthlyPayments || defaultMonthlyPayments(acc)"
              :key="p.month"
              class="p-2.5 rounded-lg border flex flex-col justify-between"
              :class="getMonthlyPaymentCardClass(p)"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-bold uppercase tracking-wider">{{ p.month }}. Ay Ödemesi</span>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded" :class="getPaymentStatusBadgeClass(p)">
                  {{ p.status === 'paid' ? 'ÖDENDİ' : 'GELECEK ÖDEME' }}
                </span>
              </div>
              <p class="text-xs font-medium text-gray-300">{{ formatDate(p.dueDate) }}</p>
              <p class="text-[10px] text-gray-500 mt-1">{{ p.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="bg-gray-900/50 rounded-xl p-8 text-center text-gray-500 text-sm border border-gray-800">
      Henüz kayıtlı hesap geçmişi bulunmuyor. İlk 3 aylık hesabınızı oluşturmak için yukarıdaki otomasyonu başlatın.
    </div>
  </div>
</template>

<script setup lang="ts">
interface MonthlyPaymentSchedule {
  month: number
  dueDate: string
  status: 'paid' | 'upcoming' | 'due'
  description: string
}

interface GeminiAccount {
  id: string
  email: string
  password?: string
  createdDate: string
  expiresDate: string
  monthlyPayments?: MonthlyPaymentSchedule[]
  status: string
  geminiPlan: string
}

defineProps<{
  accounts: GeminiAccount[]
}>()

function copyToClipboard(text: string) {
  if (navigator?.clipboard) {
    navigator.clipboard.writeText(text)
  }
}

function formatDate(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return isoStr
  }
}

function defaultMonthlyPayments(acc: GeminiAccount): MonthlyPaymentSchedule[] {
  const created = new Date(acc.createdDate || Date.now()).getTime()
  return [
    { month: 1, dueDate: new Date(created).toISOString(), status: 'paid', description: '1. Ay Çekildi' },
    { month: 2, dueDate: new Date(created + 30 * 24 * 3600 * 1000).toISOString(), status: 'upcoming', description: '2. Ay Karttan Çekilecek' },
    { month: 3, dueDate: new Date(created + 60 * 24 * 3600 * 1000).toISOString(), status: 'upcoming', description: '3. Ay Karttan Çekilecek' }
  ]
}

function getRemainingDays(isoStr: string) {
  try {
    const expires = new Date(isoStr).getTime()
    const now = new Date().getTime()
    return Math.ceil((expires - now) / (1000 * 60 * 60 * 24))
  } catch {
    return 0
  }
}

function getRemainingDaysText(isoStr: string) {
  const days = getRemainingDays(isoStr)
  if (days <= 0) return '3 Aylık Süre Doldu (Yeni Hesap Zamanı)'
  return `${days} Gün Sonra Yeni Hesap`
}

function getDaysRemainingClass(isoStr: string) {
  const days = getRemainingDays(isoStr)
  if (days <= 0) return 'text-red-400 font-bold'
  if (days <= 10) return 'text-amber-400 font-bold'
  return 'text-emerald-400 font-bold'
}

function getMonthlyPaymentCardClass(p: MonthlyPaymentSchedule) {
  if (p.status === 'paid') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
  return 'bg-gray-950/80 border-gray-800 text-gray-300'
}

function getPaymentStatusBadgeClass(p: MonthlyPaymentSchedule) {
  if (p.status === 'paid') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
  return 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
}
</script>
