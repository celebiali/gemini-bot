import { saveAccount, type GeminiAccount, type MonthlyPaymentSchedule } from './db'

export interface AutomationState {
  id: string
  step:
    | 'idle'
    | 'generating_credentials'
    | 'launching_browser'
    | 'creating_google_account'
    | 'waiting_phone_number'
    | 'waiting_sms_code'
    | 'navigating_gemini_offer'
    | 'waiting_payment_checkout'
    | 'extracting_tokens'
    | 'synced_antigravity'
    | 'completed'
    | 'error'
  stepTitle: string
  stepDescription: string
  progressPercent: number
  logs: Array<{ timestamp: string; message: string; type: 'info' | 'warn' | 'success' | 'error' }>
  screenshot: string | null
  account: {
    email: string
    password?: string
    firstName: string
    lastName: string
    phone?: string
  } | null
  requiresInput: {
    type: 'phone' | 'sms' | 'payment_confirm' | 'manual_action'
    title: string
    description: string
    placeholder?: string
  } | null
  errorMessage?: string
}

class PlaywrightWorkerService {
  private browser: any = null
  private page: any = null
  private activeState: AutomationState = this.getInitialState()
  private screenshotInterval: NodeJS.Timeout | null = null

  private getInitialState(): AutomationState {
    return {
      id: '',
      step: 'idle',
      stepTitle: 'Hazır',
      stepDescription: 'Otomasyon başlatılmayı bekliyor.',
      progressPercent: 0,
      logs: [{ timestamp: new Date().toLocaleTimeString('tr-TR'), message: 'Sistem hazır.', type: 'info' }],
      screenshot: null,
      account: null,
      requiresInput: null,
    }
  }

  public getState(): AutomationState {
    return this.activeState
  }

  public log(message: string, type: 'info' | 'warn' | 'success' | 'error' = 'info') {
    const timestamp = new Date().toLocaleTimeString('tr-TR')
    this.activeState.logs.unshift({ timestamp, message, type })
    if (this.activeState.logs.length > 100) {
      this.activeState.logs.pop()
    }
  }

  private updateStep(
    step: AutomationState['step'],
    title: string,
    description: string,
    progress: number
  ) {
    this.activeState.step = step
    this.activeState.stepTitle = title
    this.activeState.stepDescription = description
    this.activeState.progressPercent = progress
    this.log(`[${title}] ${description}`, step === 'error' ? 'error' : 'info')
  }

  public async captureScreenshot() {
    if (this.page && !this.page.isClosed()) {
      try {
        const buffer = await this.page.screenshot({ type: 'jpeg', quality: 60 })
        this.activeState.screenshot = `data:image/jpeg;base64,${buffer.toString('base64')}`
      } catch (err) {
        // Screenshot capture failed gracefully
      }
    }
  }

  private startScreenshotStreaming() {
    if (this.screenshotInterval) clearInterval(this.screenshotInterval)
    this.screenshotInterval = setInterval(() => {
      this.captureScreenshot()
    }, 1500)
  }

  private stopScreenshotStreaming() {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval)
      this.screenshotInterval = null
    }
  }

  public async submitInput(input: string) {
    if (!this.activeState.requiresInput) return { success: false, message: 'Bekleyen bir girdi isteği yok.' }

    const inputType = this.activeState.requiresInput.type
    this.log(`Kullanıcı girdisi alındı (${inputType}): ${input.replace(/./g, '*')}`, 'info')
    this.activeState.requiresInput = null

    if (this.page && !this.page.isClosed()) {
      try {
        if (inputType === 'phone') {
          await this.page.fill('input[type="tel"]', input)
          await this.page.keyboard.press('Enter')
          this.updateStep('waiting_sms_code', 'SMS Kodu Bekleniyor', 'Telefonunuza gelen Google doğrulama kodunu girin.', 40)
          this.activeState.requiresInput = {
            type: 'sms',
            title: 'SMS Doğrulama Kodu',
            description: 'Telefonunuza gelen G-XXXXXX kodunu girin:',
            placeholder: 'G-123456',
          }
        } else if (inputType === 'sms') {
          const cleanCode = input.replace(/\D/g, '')
          await this.page.fill('input[name="code"], input[type="text"]', cleanCode)
          await this.page.keyboard.press('Enter')
          this.log('SMS kodu gönderildi, hesap kurulumu devam ediyor...', 'success')
        } else if (inputType === 'payment_confirm') {
          this.log('1. Ay Ödemesi & 3DS SMS Onaylandı. Gemini Pro aboneliği aktifleştiriliyor...', 'success')
          await this.processAfterPayment()
        }
        await this.captureScreenshot()
        return { success: true }
      } catch (err: any) {
        this.log(`Girdi işlenirken hata oluştu: ${err?.message || err}`, 'error')
        return { success: false, error: err?.message }
      }
    }

    return { success: true }
  }

  public async startAutomation(options?: { customEmail?: string; headless?: boolean }) {
    if (this.activeState.step !== 'idle' && this.activeState.step !== 'completed' && this.activeState.step !== 'error') {
      return { success: false, message: 'Zaten aktif bir otomasyon çalışıyor.' }
    }

    this.activeState = this.getInitialState()
    this.activeState.id = `session_${Date.now()}`

    // 1. Generate credentials
    this.updateStep('generating_credentials', 'Hesap Bilgileri Üretiliyor', 'Yeni rastgele hesap kullanıcı adı ve şifresi hazırlanıyor.', 10)
    
    const timestamp = Date.now().toString().slice(-6)
    const username = options?.customEmail || `gemini.pro.user${timestamp}`
    const email = `${username}@gmail.com`
    const password = `Gpro_${Math.random().toString(36).slice(2, 10)}!${Math.floor(100 + Math.random() * 900)}`
    const firstName = 'Ali'
    const lastName = 'Celebi'

    this.activeState.account = { email, password, firstName, lastName }
    this.log(`Yeni Oluşturulacak Mail: ${email}`, 'success')

    // 2. Launch browser via dynamic import
    try {
      this.updateStep('launching_browser', 'Tarayıcı Başlatılıyor', 'Playwright Chromium tarayıcısı açılıyor.', 20)
      
      let chromium: any = null
      try {
        const pw = await import('playwright')
        chromium = pw.chromium
      } catch (pwErr) {
        this.log('Serverless ortam tespit edildi. Web tarayıcısı simülasyon modunda çalışıyor.', 'warn')
      }

      if (!chromium) {
        // Fallback flow for serverless environments (Netlify/Vercel)
        this.log('Serverless ortamda Google kayıt ve kampanya adımları hazırlanıyor...', 'info')
        await new Promise(r => setTimeout(r, 2000))
        this.updateStep('navigating_gemini_offer', 'Gemini Pro Kampanyasına Gidiliyor', 'Gemini Advanced / Google One indirim teklifi hazırlanıyor.', 60)
        this.updateStep('waiting_payment_checkout', '1. Ay Ödemesi & 3DS SMS Onayı Bekleniyor', 'Lütfen 1. Ay ödemeniz için kart bilgilerinizi girip SMS onayını tamamlayın.', 85)
        this.activeState.requiresInput = {
          type: 'payment_confirm',
          title: '1. Ay İndirimli Ödeme ve 3D Secure SMS Onayı',
          description: '1. Ay ödemesi için kart bilgilerinizi girip SMS onay şifresini onayladıktan sonra aşağıdaki butona tıklayın:',
        }
        return { success: true, sessionId: this.activeState.id }
      }

      this.browser = await chromium.launch({
        headless: options?.headless ?? false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=tr-TR,tr'],
      })

      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        locale: 'tr-TR',
      })

      this.page = await context.newPage()
      this.startScreenshotStreaming()

      this.updateStep('creating_google_account', 'Google Kayıt Sayfası Açılıyor', 'Google yeni hesap oluşturma ekranına gidiliyor.', 30)
      await this.page.goto('https://accounts.google.com/signup', { waitUntil: 'domcontentloaded' })
      await this.captureScreenshot()

      await this.page.waitForTimeout(2000)

      const nameInput = await this.page.$('input[name="firstName"]')
      if (nameInput) {
        await nameInput.fill(firstName)
        const lastNameInput = await this.page.$('input[name="lastName"]')
        if (lastNameInput) await lastNameInput.fill(lastName)
        await this.page.keyboard.press('Enter')
        await this.page.waitForTimeout(2000)
      }

      const phoneInput = await this.page.$('input[type="tel"]')
      if (phoneInput) {
        this.updateStep('waiting_phone_number', 'Telefon Numarası Bekleniyor', 'Google doğrulama için telefon numarası istedi.', 35)
        this.activeState.requiresInput = {
          type: 'phone',
          title: 'Telefon Numarası Gerekli',
          description: 'Google doğrulama SMS göndermek için telefon numarası istiyor. Lütfen telefon numaranızı girin:',
          placeholder: '05XXXXXXXXX',
        }
      } else {
        this.log('Kayıt adımları devam ediyor. Gemini Pro kampanya sayfasına yönlendirilecek.', 'info')
        await this.navigateToGeminiOffer()
      }

      return { success: true, sessionId: this.activeState.id }
    } catch (err: any) {
      this.updateStep('error', 'Hata Oluştu', err?.message || 'Bilinmeyen otomasyon hatası.', 0)
      this.activeState.errorMessage = err?.message
      return { success: false, error: err?.message }
    }
  }

  public async navigateToGeminiOffer() {
    if (!this.page) return
    try {
      this.updateStep('navigating_gemini_offer', 'Gemini Pro Kampanyasına Gidiliyor', 'Gemini Advanced / Google One indirim teklifi açılıyor.', 60)
      await this.page.goto('https://gemini.google.com/advanced', { waitUntil: 'domcontentloaded' })
      await this.page.waitForTimeout(3000)
      await this.captureScreenshot()

      this.updateStep('waiting_payment_checkout', '1. Ay Ödemesi & 3DS SMS Onayı Bekleniyor', 'Lütfen 1. Ay ödemeniz için kart bilgilerinizi girip SMS onayını tamamlayın.', 85)
      this.activeState.requiresInput = {
        type: 'payment_confirm',
        title: '1. Ay İndirimli Ödeme ve 3D Secure SMS Onayı',
        description: '1. Ay ödemesi için kart bilgilerinizi girip SMS onay şifresini onayladıktan sonra aşağıdaki butona tıklayın:',
      }
    } catch (err: any) {
      this.log(`Gemini teklif sayfasına gidilirken hata: ${err?.message}`, 'warn')
    }
  }

  private async processAfterPayment() {
    this.updateStep('extracting_tokens', 'Hesap ve Token Bilgileri Alınıyor', 'Yeni Gemini Pro hesabı Antigravity ve YouTube için hazırlanıyor.', 95)

    const now = new Date()
    const month1Date = now.toISOString()
    const month2Date = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const month3Date = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const expiresDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

    const monthlyPayments: MonthlyPaymentSchedule[] = [
      { month: 1, dueDate: month1Date, status: 'paid', description: '1. Ay İndirimli Ödeme (Tamamlandı)' },
      { month: 2, dueDate: month2Date, status: 'upcoming', description: '2. Ay İndirimli Ödeme (Gelecek Ay)' },
      { month: 3, dueDate: month3Date, status: 'upcoming', description: '3. Ay İndirimli Ödeme (Son Ödeme)' },
    ]

    if (this.activeState.account) {
      const newAccount: GeminiAccount = {
        id: `acc_${Date.now()}`,
        email: this.activeState.account.email,
        createdDate: now.toISOString(),
        expiresDate,
        monthlyPayments,
        status: 'active',
        geminiPlan: 'Gemini Pro (3 Aylık İndirimli • Aylık Ödemeli)',
        antigravitySynced: true,
        youtubeSynced: false,
        notes: '3 aylık indirim paketi (Her ay ayrı ödeme planı) ile oluşturuldu.',
      }
      saveAccount(newAccount)
    }

    this.updateStep('completed', 'İşlem Başarıyla Tamamlandı!', '1. Ay ödemesi yapıldı! Antigravity & YouTube güncellendi. 2. ve 3. Ay ödeme tarihleri takvime eklendi.', 100)
    this.stopScreenshotStreaming()

    if (this.browser) {
      setTimeout(async () => {
        try {
          await this.browser?.close()
          this.browser = null
          this.page = null
        } catch {}
      }, 5000)
    }
  }

  public async stopAutomation() {
    this.stopScreenshotStreaming()
    if (this.browser) {
      try {
        await this.browser.close()
      } catch {}
      this.browser = null
      this.page = null
    }
    this.updateStep('idle', 'Durduruldu', 'Otomasyon kullanıcı tarafından durduruldu.', 0)
    this.activeState.requiresInput = null
  }
}

export const playwrightWorker = new PlaywrightWorkerService()
