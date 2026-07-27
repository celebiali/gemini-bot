<template>
  <div class="min-h-screen text-gray-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
    <!-- Navbar Header -->
    <header class="glass-panel border-b border-gray-800/80 sticky top-0 z-50 rounded-none bg-gray-950/80 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white font-black text-xl shadow-glow">
            G
          </div>
          <div>
            <h1 class="text-lg font-extrabold gradient-text tracking-tight">Gemini Bot</h1>
            <p class="text-[11px] text-gray-400 font-medium">3-Month Discount & Account Switcher</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            Antigravity & YouTube Ready
          </div>
          <a
            href="https://github.com/celebiali/gemini-bot"
            target="_blank"
            class="px-3.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-semibold text-gray-300 transition flex items-center gap-2"
          >
            <span>GitHub Repository</span>
            <span>↗</span>
          </a>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <NuxtPage />
    </main>

    <!-- Footer -->
    <footer class="border-t border-gray-800/60 py-6 text-center text-xs text-gray-500">
      <p>Gemini Bot • 3-Month Automated Account & Discount Manager • Nuxt 3 Full-Stack Application</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Main layout setup
</script>
