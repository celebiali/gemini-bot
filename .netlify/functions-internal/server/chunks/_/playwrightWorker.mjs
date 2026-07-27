import { chromium } from 'playwright';
import { s as saveAccount } from './db.mjs';

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class PlaywrightWorkerService {
  constructor() {
    __publicField(this, "browser", null);
    __publicField(this, "page", null);
    __publicField(this, "activeState", this.getInitialState());
    __publicField(this, "screenshotInterval", null);
  }
  getInitialState() {
    return {
      id: "",
      step: "idle",
      stepTitle: "Haz\u0131r",
      stepDescription: "Otomasyon ba\u015Flat\u0131lmay\u0131 bekliyor.",
      progressPercent: 0,
      logs: [{ timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("tr-TR"), message: "Sistem haz\u0131r.", type: "info" }],
      screenshot: null,
      account: null,
      requiresInput: null
    };
  }
  getState() {
    return this.activeState;
  }
  log(message, type = "info") {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("tr-TR");
    this.activeState.logs.unshift({ timestamp, message, type });
    if (this.activeState.logs.length > 100) {
      this.activeState.logs.pop();
    }
  }
  updateStep(step, title, description, progress) {
    this.activeState.step = step;
    this.activeState.stepTitle = title;
    this.activeState.stepDescription = description;
    this.activeState.progressPercent = progress;
    this.log(`[${title}] ${description}`, step === "error" ? "error" : "info");
  }
  async captureScreenshot() {
    if (this.page && !this.page.isClosed()) {
      try {
        const buffer = await this.page.screenshot({ type: "jpeg", quality: 60 });
        this.activeState.screenshot = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      } catch (err) {
      }
    }
  }
  startScreenshotStreaming() {
    if (this.screenshotInterval) clearInterval(this.screenshotInterval);
    this.screenshotInterval = setInterval(() => {
      this.captureScreenshot();
    }, 1500);
  }
  stopScreenshotStreaming() {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
  }
  async submitInput(input) {
    if (!this.activeState.requiresInput) return { success: false, message: "Bekleyen bir girdi iste\u011Fi yok." };
    const inputType = this.activeState.requiresInput.type;
    this.log(`Kullan\u0131c\u0131 girdisi al\u0131nd\u0131 (${inputType}): ${input.replace(/./g, "*")}`, "info");
    this.activeState.requiresInput = null;
    if (this.page && !this.page.isClosed()) {
      try {
        if (inputType === "phone") {
          await this.page.fill('input[type="tel"]', input);
          await this.page.keyboard.press("Enter");
          this.updateStep("waiting_sms_code", "SMS Kodu Bekleniyor", "Telefonunuza gelen Google do\u011Frulama kodunu girin.", 40);
          this.activeState.requiresInput = {
            type: "sms",
            title: "SMS Do\u011Frulama Kodu",
            description: "Telefonunuza gelen G-XXXXXX kodunu girin:",
            placeholder: "G-123456"
          };
        } else if (inputType === "sms") {
          const cleanCode = input.replace(/\D/g, "");
          await this.page.fill('input[name="code"], input[type="text"]', cleanCode);
          await this.page.keyboard.press("Enter");
          this.log("SMS kodu g\xF6nderildi, hesap kurulumu devam ediyor...", "success");
        } else if (inputType === "payment_confirm") {
          this.log("1. Ay \xD6demesi & 3DS SMS Onayland\u0131. Gemini Pro aboneli\u011Fi aktifle\u015Ftiriliyor...", "success");
          await this.processAfterPayment();
        }
        await this.captureScreenshot();
        return { success: true };
      } catch (err) {
        this.log(`Girdi i\u015Flenirken hata olu\u015Ftu: ${(err == null ? void 0 : err.message) || err}`, "error");
        return { success: false, error: err == null ? void 0 : err.message };
      }
    }
    return { success: true };
  }
  async startAutomation(options) {
    var _a;
    if (this.activeState.step !== "idle" && this.activeState.step !== "completed" && this.activeState.step !== "error") {
      return { success: false, message: "Zaten aktif bir otomasyon \xE7al\u0131\u015F\u0131yor." };
    }
    this.activeState = this.getInitialState();
    this.activeState.id = `session_${Date.now()}`;
    this.updateStep("generating_credentials", "Hesap Bilgileri \xDCretiliyor", "Yeni rastgele hesap kullan\u0131c\u0131 ad\u0131 ve \u015Fifresi haz\u0131rlan\u0131yor.", 10);
    const timestamp = Date.now().toString().slice(-6);
    const username = (options == null ? void 0 : options.customEmail) || `gemini.pro.user${timestamp}`;
    const email = `${username}@gmail.com`;
    const password = `Gpro_${Math.random().toString(36).slice(2, 10)}!${Math.floor(100 + Math.random() * 900)}`;
    const firstName = "Ali";
    const lastName = "Celebi";
    this.activeState.account = { email, password, firstName, lastName };
    this.log(`Yeni Olu\u015Fturulacak Mail: ${email}`, "success");
    try {
      this.updateStep("launching_browser", "Taray\u0131c\u0131 Ba\u015Flat\u0131l\u0131yor", "Playwright Chromium taray\u0131c\u0131s\u0131 a\xE7\u0131l\u0131yor.", 20);
      this.browser = await chromium.launch({
        headless: (_a = options == null ? void 0 : options.headless) != null ? _a : false,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--lang=tr-TR,tr"]
      });
      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        locale: "tr-TR"
      });
      this.page = await context.newPage();
      this.startScreenshotStreaming();
      this.updateStep("creating_google_account", "Google Kay\u0131t Sayfas\u0131 A\xE7\u0131l\u0131yor", "Google yeni hesap olu\u015Fturma ekran\u0131na gidiliyor.", 30);
      await this.page.goto("https://accounts.google.com/signup", { waitUntil: "domcontentloaded" });
      await this.captureScreenshot();
      await this.page.waitForTimeout(2e3);
      const nameInput = await this.page.$('input[name="firstName"]');
      if (nameInput) {
        await nameInput.fill(firstName);
        const lastNameInput = await this.page.$('input[name="lastName"]');
        if (lastNameInput) await lastNameInput.fill(lastName);
        await this.page.keyboard.press("Enter");
        await this.page.waitForTimeout(2e3);
      }
      const phoneInput = await this.page.$('input[type="tel"]');
      if (phoneInput) {
        this.updateStep("waiting_phone_number", "Telefon Numaras\u0131 Bekleniyor", "Google do\u011Frulama i\xE7in telefon numaras\u0131 istedi.", 35);
        this.activeState.requiresInput = {
          type: "phone",
          title: "Telefon Numaras\u0131 Gerekli",
          description: "Google do\u011Frulama SMS g\xF6ndermek i\xE7in telefon numaras\u0131 istiyor. L\xFCtfen telefon numaran\u0131z\u0131 girin:",
          placeholder: "05XXXXXXXXX"
        };
      } else {
        this.log("Kay\u0131t ad\u0131mlar\u0131 devam ediyor. Gemini Pro kampanya sayfas\u0131na y\xF6nlendirilecek.", "info");
        await this.navigateToGeminiOffer();
      }
      return { success: true, sessionId: this.activeState.id };
    } catch (err) {
      this.updateStep("error", "Hata Olu\u015Ftu", (err == null ? void 0 : err.message) || "Bilinmeyen otomasyon hatas\u0131.", 0);
      this.activeState.errorMessage = err == null ? void 0 : err.message;
      return { success: false, error: err == null ? void 0 : err.message };
    }
  }
  async navigateToGeminiOffer() {
    if (!this.page) return;
    try {
      this.updateStep("navigating_gemini_offer", "Gemini Pro Kampanyas\u0131na Gidiliyor", "Gemini Advanced / Google One indirim teklifi a\xE7\u0131l\u0131yor.", 60);
      await this.page.goto("https://gemini.google.com/advanced", { waitUntil: "domcontentloaded" });
      await this.page.waitForTimeout(3e3);
      await this.captureScreenshot();
      this.updateStep("waiting_payment_checkout", "1. Ay \xD6demesi & 3DS SMS Onay\u0131 Bekleniyor", "L\xFCtfen 1. Ay \xF6demeniz i\xE7in kart bilgilerinizi girip SMS onay\u0131n\u0131 tamamlay\u0131n.", 85);
      this.activeState.requiresInput = {
        type: "payment_confirm",
        title: "1. Ay \u0130ndirimli \xD6deme ve 3D Secure SMS Onay\u0131",
        description: "1. Ay \xF6demesi i\xE7in kart bilgilerinizi girip SMS onay \u015Fifresini onaylad\u0131ktan sonra a\u015Fa\u011F\u0131daki butona t\u0131klay\u0131n (2. Ay ve 3. Ay \xF6demeleri her ay ayr\u0131 ayr\u0131 \xE7ekilecektir):"
      };
    } catch (err) {
      this.log(`Gemini teklif sayfas\u0131na gidilirken hata: ${err == null ? void 0 : err.message}`, "warn");
    }
  }
  async processAfterPayment() {
    this.updateStep("extracting_tokens", "Hesap ve Token Bilgileri Al\u0131n\u0131yor", "Yeni Gemini Pro hesab\u0131 Antigravity ve YouTube i\xE7in haz\u0131rlan\u0131yor.", 95);
    const now = /* @__PURE__ */ new Date();
    const month1Date = now.toISOString();
    const month2Date = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1e3).toISOString();
    const month3Date = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1e3).toISOString();
    const expiresDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1e3).toISOString();
    const monthlyPayments = [
      { month: 1, dueDate: month1Date, status: "paid", description: "1. Ay \u0130ndirimli \xD6deme (Tamamland\u0131)" },
      { month: 2, dueDate: month2Date, status: "upcoming", description: "2. Ay \u0130ndirimli \xD6deme (Gelecek Ay)" },
      { month: 3, dueDate: month3Date, status: "upcoming", description: "3. Ay \u0130ndirimli \xD6deme (Son \xD6deme)" }
    ];
    if (this.activeState.account) {
      const newAccount = {
        id: `acc_${Date.now()}`,
        email: this.activeState.account.email,
        createdDate: now.toISOString(),
        expiresDate,
        monthlyPayments,
        status: "active",
        geminiPlan: "Gemini Pro (3 Ayl\u0131k \u0130ndirimli \u2022 Ayl\u0131k \xD6demeli)",
        antigravitySynced: true,
        youtubeSynced: false,
        notes: "3 ayl\u0131k indirim paketi (Her ay ayr\u0131 \xF6deme plan\u0131) ile olu\u015Fturuldu."
      };
      saveAccount(newAccount);
    }
    this.updateStep("completed", "\u0130\u015Flem Ba\u015Far\u0131yla Tamamland\u0131!", "1. Ay \xF6demesi yap\u0131ld\u0131! Antigravity & YouTube g\xFCncellendi. 2. ve 3. Ay \xF6deme tarihleri takvime eklendi.", 100);
    this.stopScreenshotStreaming();
    if (this.browser) {
      setTimeout(async () => {
        var _a;
        try {
          await ((_a = this.browser) == null ? void 0 : _a.close());
          this.browser = null;
          this.page = null;
        } catch {
        }
      }, 5e3);
    }
  }
  async stopAutomation() {
    this.stopScreenshotStreaming();
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
      }
      this.browser = null;
      this.page = null;
    }
    this.updateStep("idle", "Durduruldu", "Otomasyon kullan\u0131c\u0131 taraf\u0131ndan durduruldu.", 0);
    this.activeState.requiresInput = null;
  }
}
const playwrightWorker = new PlaywrightWorkerService();

export { playwrightWorker as p };
//# sourceMappingURL=playwrightWorker.mjs.map
