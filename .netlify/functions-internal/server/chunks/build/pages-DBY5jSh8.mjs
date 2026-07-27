import { $ as $fetch$1 } from '../virtual/entry.mjs';
import { defineComponent, ref, resolveComponent, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrIncludeBooleanAttr, ssrRenderComponent, ssrInterpolate, ssrRenderList, ssrRenderClass } from 'vue/server-renderer';
import 'nostics';
import 'nostics/formatters/ansi';
import '../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import '../routes/renderer.mjs';
import 'unhead/server';
import 'unhead/legacy';
import 'unhead/plugins';
import 'vue-bundle-renderer/runtime';
import 'devalue';
import 'vue-router';
import 'unhead/utils';

//#region app/pages/index.vue?vue&type=script&setup=true&lang.ts
var index_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "index",
	__ssrInlineRender: true,
	setup(__props) {
		const starting = ref(false);
		const accounts = ref([]);
		const activeAccount = ref(null);
		const automationState = ref({
			id: "",
			step: "idle",
			stepTitle: "Hazır",
			stepDescription: "Otomasyon başlatılmayı bekliyor.",
			progressPercent: 0,
			logs: [],
			screenshot: null,
			account: null,
			requiresInput: null
		});
		async function fetchStatus() {
			try {
				const data = await $fetch$1("/api/automation/status");
				if (data) automationState.value = data;
			} catch (err) {}
		}
		async function stopAutomation() {
			try {
				await $fetch$1("/api/automation/stop", { method: "POST" });
				await fetchStatus();
			} catch (err) {}
		}
		async function handleInputSubmit(inputVal) {
			try {
				await $fetch$1("/api/automation/input", {
					method: "POST",
					body: { input: inputVal }
				});
				await fetchStatus();
			} catch (err) {
				alert(`Girdi gönderilemedi: ${err?.message || err}`);
			}
		}
		function getLogTypeClass(type) {
			if (type === "error") return "text-red-400 font-semibold";
			if (type === "success") return "text-emerald-400 font-semibold";
			if (type === "warn") return "text-amber-400";
			return "text-gray-300";
		}
		return (_ctx, _push, _parent, _attrs) => {
			const _component_AutomationWizard = resolveComponent("AutomationWizard");
			const _component_ManualInputModal = resolveComponent("ManualInputModal");
			const _component_LiveBrowserStream = resolveComponent("LiveBrowserStream");
			const _component_AntigravitySwitcher = resolveComponent("AntigravitySwitcher");
			const _component_AccountHistory = resolveComponent("AccountHistory");
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "space-y-8" }, _attrs))}><div class="glass-panel p-6 border border-purple-500/30 relative overflow-hidden"><div class="absolute -top-24 -right-24 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div><div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10"><div><h2 class="text-2xl font-extrabold text-white mb-2"> 3 Aylık İndirimli Gemini Pro Hesabı Oluştur &amp; Aktifleştir </h2><p class="text-sm text-gray-300 max-w-2xl"> Yeni Google/Gmail hesabını otomatik açar, indirimli Gemini Pro kampanyasına yönlendirir, kart &amp; SMS onayının ardından Antigravity ve YouTube hesaplarınızı 3 aylık yeni hesaba günceller. </p></div><div class="flex items-center gap-3 shrink-0"><button${ssrIncludeBooleanAttr(starting.value || automationState.value.step !== "idle" && automationState.value.step !== "completed" && automationState.value.step !== "error") ? " disabled" : ""} class="px-6 py-3 rounded-xl gradient-bg hover:opacity-90 font-bold text-sm text-white shadow-glow flex items-center gap-2 transition disabled:opacity-50">`);
			if (starting.value) _push(`<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>`);
			else _push(`<!---->`);
			_push(`<span>⚡ Yeni Hesap Otomasyonunu Başlat</span></button></div></div></div>`);
			_push(ssrRenderComponent(_component_AutomationWizard, {
				state: automationState.value,
				onStop: stopAutomation
			}, null, _parent));
			if (automationState.value.requiresInput) _push(ssrRenderComponent(_component_ManualInputModal, {
				"requires-input": automationState.value.requiresInput,
				onSubmitInput: handleInputSubmit
			}, null, _parent));
			else _push(`<!---->`);
			_push(`<div class="grid grid-cols-1 lg:grid-cols-3 gap-6"><div class="lg:col-span-2">`);
			_push(ssrRenderComponent(_component_LiveBrowserStream, { screenshot: automationState.value.screenshot }, null, _parent));
			_push(`</div><div class="glass-panel p-5 flex flex-col h-full"><div class="flex items-center justify-between mb-3"><h4 class="text-sm font-bold text-gray-200 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-purple-400"></span> İşlem Günlükleri (Logs) </h4><span class="text-[10px] text-gray-500 font-mono">${ssrInterpolate(automationState.value.logs.length)} Kayıt</span></div><div class="flex-1 bg-gray-950/90 rounded-xl p-3 border border-gray-800 font-mono text-xs overflow-y-auto max-h-[340px] space-y-2"><!--[-->`);
			ssrRenderList(automationState.value.logs, (log, idx) => {
				_push(`<div class="flex items-start gap-2"><span class="text-gray-500 shrink-0 text-[10px]">${ssrInterpolate(log.timestamp)}</span><span class="${ssrRenderClass(getLogTypeClass(log.type))}">${ssrInterpolate(log.message)}</span></div>`);
			});
			_push(`<!--]--></div></div></div>`);
			_push(ssrRenderComponent(_component_AntigravitySwitcher, { "active-account": activeAccount.value }, null, _parent));
			_push(ssrRenderComponent(_component_AccountHistory, { accounts: accounts.value }, null, _parent));
			_push(`</div>`);
		};
	}
});
//#endregion
//#region app/pages/index.vue
var _sfc_setup = index_vue_vue_type_script_setup_true_lang_default.setup;
index_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/index.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var pages_default = index_vue_vue_type_script_setup_true_lang_default;

export { pages_default as default };
//# sourceMappingURL=pages-DBY5jSh8.mjs.map
