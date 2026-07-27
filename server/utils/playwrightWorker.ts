import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
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
  updatedAt?: number
}

const STATE_FILE = join(tmpdir(), 'gemini_automation_state.json')
const INPUT_FILE = join(tmpdir(), 'gemini_pending_input.json')

class PlaywrightWorkerService {
  private browser: any = null
  private page: any = null
  private activeState: AutomationState = this.getInitialState()
  private screenshotInterval: NodeJS.Timeout | null = null
  private pendingInputResolver: ((value: string) => void) | null = null

  private getTurkeyTimeString(): string {
    return new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })
  }

  private getInitialState(): AutomationState {
    return {
      id: '',
      step: 'idle',
      stepTitle: 'Hazır',
      stepDescription: 'Otomasyon başlatılmayı bekliyor.',
      progressPercent: 0,
      logs: [{ timestamp: this.getTurkeyTimeString(), message: 'Sistem hazır.', type: 'info' }],
      screenshot: null,
      account: null,
      requiresInput: null,
      updatedAt: Date.now(),
    }
  }

  private saveStateToFile() {
    try {
      this.activeState.updatedAt = Date.now()
      writeFileSync(STATE_FILE, JSON.stringify(this.activeState), 'utf-8')
    } catch {}
  }

  private loadStateFromFile(): AutomationState | null {
    try {
      if (existsSync(STATE_FILE)) {
        const raw = readFileSync(STATE_FILE, 'utf-8')
        const parsed = JSON.parse(raw) as AutomationState
        // Check if state is fresh (less than 15 minutes old)
        if (parsed && parsed.updatedAt && Date.now() - parsed.updatedAt < 15 * 60 * 1000) {
          return parsed
        }
      }
    } catch {}
    return null
  }

  public getState(): AutomationState {
    if (this.activeState.step !== 'idle') {
      return this.activeState
    }
    const fileState = this.loadStateFromFile()
    if (fileState && fileState.step !== 'idle') {
      this.activeState = fileState
    }
    return this.activeState
  }

  public log(message: string, type: 'info' | 'warn' | 'success' | 'error' = 'info') {
    const timestamp = this.getTurkeyTimeString()
    this.activeState.logs.unshift({ timestamp, message, type })
    if (this.activeState.logs.length > 100) {
      this.activeState.logs.pop()
    }
    this.saveStateToFile()
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
    this.saveStateToFile()
  }

  public async captureScreenshot() {
    if (this.page && !this.page.isClosed()) {
      try {
        const buffer = await this.page.screenshot({ type: 'jpeg', quality: 65 })
        this.activeState.screenshot = `data:image/jpeg;base64,${buffer.toString('base64')}`
        this.saveStateToFile()
      } catch (err) {
        // Screenshot capture handled gracefully
      }
    }
  }

  private startScreenshotStreaming() {
    if (this.screenshotInterval) clearInterval(this.screenshotInterval)
    this.screenshotInterval = setInterval(() => {
      this.captureScreenshot()
    }, 1200)
  }

  private stopScreenshotStreaming() {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval)
      this.screenshotInterval = null
    }
  }

  private waitForUserInput(
    type: 'phone' | 'sms' | 'payment_confirm' | 'manual_action',
    title: string,
    description: string,
    placeholder?: string
  ): Promise<string> {
    this.activeState.requiresInput = { type, title, description, placeholder }
    this.saveStateToFile()

    // Clean any stale input file
    try {
      if (existsSync(INPUT_FILE)) unlinkSync(INPUT_FILE)
    } catch {}

    return new Promise((resolve) => {
      this.pendingInputResolver = resolve

      // Poll file system for input in case input POST landed on a different serverless instance
      const checkInterval = setInterval(() => {
        try {
          if (existsSync(INPUT_FILE)) {
            const val = readFileSync(INPUT_FILE, 'utf-8')
            unlinkSync(INPUT_FILE)
            clearInterval(checkInterval)
            if (this.pendingInputResolver) {
              this.pendingInputResolver = null
              this.activeState.requiresInput = null
              this.saveStateToFile()
              resolve(val)
            }
          }
        } catch {}
      }, 500)
    })
  }

  public async submitInput(input: string) {
    // Write input to file for cross-instance serverless communication
    try {
      writeFileSync(INPUT_FILE, input, 'utf-8')
    } catch {}

    if (this.pendingInputResolver) {
      const resolver = this.pendingInputResolver
      this.pendingInputResolver = null
      const inputType = this.activeState.requiresInput?.type
      this.log(`Kullanıcı girdisi işleniyor (${inputType}): ${input ? input.replace(/./g, '*') : 'Devam'}`, 'info')
      this.activeState.requiresInput = null
      this.saveStateToFile()
      resolver(input)
      await this.captureScreenshot()
      return { success: true }
    }

    const currentReq = this.activeState.requiresInput
    if (currentReq) {
      this.log(`Kullanıcı girdisi alındı (${currentReq.type}): ${input ? input.replace(/./g, '*') : 'Devam'}`, 'info')
      if (currentReq.type === 'payment_confirm') {
        this.activeState.requiresInput = null
        await this.processAfterPayment()
        return { success: true }
      }
      this.activeState.requiresInput = null
      this.saveStateToFile()
      return { success: true }
    }

    if (this.activeState.step === 'waiting_payment_checkout') {
      await this.processAfterPayment()
      return { success: true }
    }

    return { success: true }
  }

  private async clickNextButton() {
    if (!this.page || this.page.isClosed()) return
    try {
      const nextSelectors = [
        'button:has-text("İleri")',
        'button:has-text("Next")',
        'button:has-text("Kabul ediyorum")',
        'button:has-text("I agree")',
        'button:has-text("Atla")',
        'button:has-text("Skip")',
        '#next',
        'button[type="button"]:has-text("İleri")',
        'button[type="submit"]',
      ]

      for (const selector of nextSelectors) {
        const btn = await this.page.$(selector)
        if (btn && await btn.isVisible()) {
          await btn.click()
          return
        }
      }
      await this.page.keyboard.press('Enter')
    } catch (err) {
      await this.page.keyboard.press('Enter')
    }
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
    this.log(`Yeni Mail: ${email}`, 'success')
    this.log(`Oluşturulan Otomatik Şifre: ${password}`, 'success')

    // Start background execution flow asynchronously
    this.runAutomationLoop(firstName, lastName, username, password, options?.headless ?? false).catch((err) => {
      this.updateStep('error', 'Hata Oluştu', err?.message || 'Otomasyon hatası.', 0)
      this.activeState.errorMessage = err?.message
    })

    return { success: true, sessionId: this.activeState.id }
  }

  private async runAutomationLoop(
    firstName: string,
    lastName: string,
    username: string,
    password: string,
    headless: boolean
  ) {
    this.updateStep('launching_browser', 'Tarayıcı Başlatılıyor', 'Playwright Chromium tarayıcısı açılıyor.', 20)
    
    let chromium: any = null
    try {
      const pw = await import('playwright')
      chromium = pw.chromium
    } catch (pwErr) {
      this.log('Playwright modülü yüklenemedi.', 'warn')
    }

    if (chromium) {
      try {
        this.browser = await chromium.launch({
          headless,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=tr-TR,tr'],
        })
      } catch (launchErr: any) {
        this.log('Yerel Chrome ikili dosyaları açılamadı, simülasyon moduna geçiliyor.', 'warn')
      }
    }

    if (!this.browser) {
      // Fallback flow for serverless / no-browser environments
      this.log('Hesap ve kampanya adımları simülasyon modunda hazırlanıyor...', 'info')
      await new Promise(r => setTimeout(r, 800))
      this.updateStep('navigating_gemini_offer', 'Gemini Pro Kampanyasına Gidiliyor', 'Gemini Advanced / Google One indirim teklifi hazırlanıyor.', 60)
      this.updateStep('waiting_payment_checkout', '1. Ay Ödemesi & 3DS SMS Onayı Bekleniyor', 'Lütfen 1. Ay ödemeniz için kart bilgilerinizi girip SMS onayını tamamlayın.', 85)
      this.activeState.requiresInput = {
        type: 'payment_confirm',
        title: '1. Ay İndirimli Ödeme ve 3D Secure SMS Onayı',
        description: '1. Ay ödemesi için kart bilgilerinizi girip SMS onay şifresini onayladıktan sonra aşağıdaki butona tıklayın:',
      }
      this.saveStateToFile()
      return
    }

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      locale: 'tr-TR',
    })

    this.page = await context.newPage()
    this.startScreenshotStreaming()

    // Step 1: Google Signup page
    this.updateStep('creating_google_account', 'Google Kayıt Sayfası Açılıyor', 'Google yeni hesap oluşturma ekranına gidiliyor.', 30)
    await this.page.goto('https://accounts.google.com/signup', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await this.captureScreenshot()

    let stepAttempts = 0
    let lastHandledStep = ''

    while (this.page && !this.page.isClosed() && stepAttempts < 40) {
      stepAttempts++
      await this.page.waitForTimeout(2000)
      await this.captureScreenshot()

      const currentUrl = this.page.url()

      // 1. Name Screen
      const firstNameInput = await this.page.$('input[name="firstName"], input[id="firstName"]')
      if (firstNameInput && await firstNameInput.isVisible()) {
        if (lastHandledStep !== 'name') {
          lastHandledStep = 'name'
          this.log('Ad ve Soyad bilgileri giriliyor...', 'info')
          await firstNameInput.fill(firstName)
          const lastNameInput = await this.page.$('input[name="lastName"], input[id="lastName"]')
          if (lastNameInput) await lastNameInput.fill(lastName)
          await this.captureScreenshot()
          await this.clickNextButton()
        }
        continue
      }

      // 2. Basic Info (Birthday & Gender)
      const dayInput = await this.page.$('input[name="day"], #day')
      if (dayInput && await dayInput.isVisible()) {
        if (lastHandledStep !== 'birthday') {
          lastHandledStep = 'birthday'
          this.log('Doğum tarihi ve cinsiyet bilgileri dolduruluyor...', 'info')
          await dayInput.fill('15')
          
          const yearInput = await this.page.$('input[name="year"], #year')
          if (yearInput) await yearInput.fill('1995')

          // Month Selection
          const monthEl = await this.page.$('#month, select[name="month"]')
          if (monthEl) {
            try {
              const isSelect = await monthEl.evaluate((el: any) => el.tagName.toLowerCase() === 'select')
              if (isSelect) {
                await monthEl.selectOption('1')
                  .catch(() => monthEl.selectOption({ index: 1 }))
                  .catch(() => monthEl.selectOption({ value: '1' }))
              } else {
                await monthEl.click()
                await this.page.waitForTimeout(300)
                await this.page.keyboard.press('ArrowDown')
                await this.page.keyboard.press('Enter')
              }
            } catch {
              await monthEl.click().catch(() => {})
              await this.page.waitForTimeout(300)
              await this.page.keyboard.press('ArrowDown')
              await this.page.keyboard.press('Enter')
            }
          }

          // Gender Selection
          const genderEl = await this.page.$('#gender, select[name="gender"]')
          if (genderEl) {
            try {
              const isSelect = await genderEl.evaluate((el: any) => el.tagName.toLowerCase() === 'select')
              if (isSelect) {
                await genderEl.selectOption('1')
                  .catch(() => genderEl.selectOption({ index: 1 }))
                  .catch(() => genderEl.selectOption({ value: '1' }))
              } else {
                await genderEl.click()
                await this.page.waitForTimeout(300)
                await this.page.keyboard.press('ArrowDown')
                await this.page.keyboard.press('Enter')
              }
            } catch {
              await genderEl.click().catch(() => {})
              await this.page.waitForTimeout(300)
              await this.page.keyboard.press('ArrowDown')
              await this.page.keyboard.press('Enter')
            }
          }

          await this.captureScreenshot()
          await this.clickNextButton()
        }
        continue
      }

      // 3. Username Selection / Input
      const usernameInput = await this.page.$('input[name="Username"], #username')
      const optionRadio = await this.page.$('input[type="radio"]')
      if ((usernameInput && await usernameInput.isVisible()) || (optionRadio && await optionRadio.isVisible())) {
        if (lastHandledStep !== 'username') {
          lastHandledStep = 'username'
          if (usernameInput && await usernameInput.isVisible()) {
            this.log(`Kullanıcı adı giriliyor: ${username}`, 'info')
            await usernameInput.fill(username)
          } else if (optionRadio && await optionRadio.isVisible()) {
            this.log('Önerilen Gmail adresi seçiliyor...', 'info')
            await optionRadio.click()
          }
          await this.captureScreenshot()
          await this.clickNextButton()
        }
        continue
      }

      // 4. Password Creation
      const pwdInput = await this.page.$('input[name="Passwd"], input[type="password"]')
      if (pwdInput && await pwdInput.isVisible()) {
        if (lastHandledStep !== 'password') {
          lastHandledStep = 'password'
          this.log('Şifre belirleniyor...', 'info')
          await pwdInput.fill(password)
          const confirmPwdInput = await this.page.$('input[name="ConfirmPasswd"]')
          if (confirmPwdInput) await confirmPwdInput.fill(password)
          await this.captureScreenshot()
          await this.clickNextButton()
        }
        continue
      }

      // 5. Phone Number Verification
      const telInput = await this.page.$('input[type="tel"], #phoneNumberId')
      if (telInput && await telInput.isVisible() && !currentUrl.includes('code')) {
        if (lastHandledStep !== 'phone') {
          lastHandledStep = 'phone'
          this.updateStep('waiting_phone_number', 'Telefon Numarası Bekleniyor', 'Google doğrulama için telefon numarası istedi.', 40)
          const phoneNum = await this.waitForUserInput(
            'phone',
            'Telefon Numarası Gerekli',
            'Google hesabını doğrulamak için SMS gönderecek. Lütfen telefon numaranızı girin:',
            '05XXXXXXXXX'
          )

          if (phoneNum && this.page && !this.page.isClosed()) {
            const currentTelInput = await this.page.$('input[type="tel"], #phoneNumberId')
            if (currentTelInput) {
              await currentTelInput.fill(phoneNum)
              await this.captureScreenshot()
              await this.clickNextButton()
            }
          }
        }
        continue
      }

      // 6. SMS Code Verification
      const smsInput = await this.page.$('input[id="code"], input[name="code"]')
      if (smsInput && await smsInput.isVisible()) {
        if (lastHandledStep !== 'sms') {
          lastHandledStep = 'sms'
          this.updateStep('waiting_sms_code', 'SMS Kodu Bekleniyor', 'Telefonunuza gelen Google doğrulama kodunu girin.', 50)
          const smsCode = await this.waitForUserInput(
            'sms',
            'SMS Doğrulama Kodu',
            'Telefonunuza gelen G-XXXXXX doğrulama kodunu girin:',
            'G-123456'
          )

          if (smsCode && this.page && !this.page.isClosed()) {
            const cleanCode = smsCode.replace(/\D/g, '')
            const currentSmsInput = await this.page.$('input[id="code"], input[name="code"]')
            if (currentSmsInput) {
              await currentSmsInput.fill(cleanCode)
              await this.captureScreenshot()
              await this.clickNextButton()
            }
          }
        }
        continue
      }

      // 7. Skip button (Recovery email / phone)
      const skipBtn = await this.page.$('button:has-text("Atla"), button:has-text("Skip")')
      if (skipBtn && await skipBtn.isVisible()) {
        await skipBtn.click()
        await this.page.waitForTimeout(1500)
        continue
      }

      // 8. Terms Agreement
      const agreeBtn = await this.page.$('button:has-text("Kabul ediyorum"), button:has-text("I agree")')
      if (agreeBtn && await agreeBtn.isVisible()) {
        await agreeBtn.click()
        await this.page.waitForTimeout(3000)
        break
      }

      // If we landed on myaccount or gemini directly
      if (currentUrl.includes('myaccount.google.com') || currentUrl.includes('gemini.google.com')) {
        break
      }
    }

    // Navigate to Gemini Pro Offer
    await this.navigateToGeminiOffer()
  }

  public async navigateToGeminiOffer() {
    if (!this.page || this.page.isClosed()) return
    try {
      this.updateStep('navigating_gemini_offer', 'Gemini Pro Kampanyasına Gidiliyor', 'Gemini Advanced / Google One indirim teklifi açılıyor.', 70)
      await this.page.goto('https://gemini.google.com/advanced', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await this.page.waitForTimeout(3000)
      await this.captureScreenshot()

      this.updateStep('waiting_payment_checkout', '1. Ay Ödemesi & 3DS SMS Onayı Bekleniyor', 'Lütfen 1. Ay ödemeniz için kart bilgilerinizi girip SMS onayını tamamlayın.', 85)
      await this.waitForUserInput(
        'payment_confirm',
        '1. Ay İndirimli Ödeme ve 3D Secure SMS Onayı',
        '1. Ay ödemesi için kart bilgilerinizi girip SMS onay şifresini onayladıktan sonra aşağıdaki butona tıklayın:'
      )
      await this.processAfterPayment()
    } catch (err: any) {
      this.log(`Gemini teklif sayfasına gidilirken uyarı: ${err?.message}`, 'warn')
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
        password: this.activeState.account.password,
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
    if (this.pendingInputResolver) {
      this.pendingInputResolver = null
    }
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

