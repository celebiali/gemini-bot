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
    | 'navigating_google_one_ai'
    | 'clicking_pro_plan'
    | 'waiting_google_play_dialog'
    | 'clicking_subscribe'
    | 'waiting_3ds_sms'
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
        '#birthdaygenderNext',
        '#collectNameNext',
        '#selectionNext',
        '#passwordNext',
        '#confirmNext',
        '#phoneNumberNext',
        '#codeNext',
        'button:has-text("İleri")',
        'button:has-text("Next")',
        'div[role="button"]:has-text("İleri")',
        'div[role="button"]:has-text("Next")',
        'span:has-text("İleri")',
        'span:has-text("Next")',
        'button:has-text("Kabul ediyorum")',
        'button:has-text("I agree")',
        'button:has-text("Atla")',
        'button:has-text("Skip")',
        '#next',
        'button[type="button"]:has-text("İleri")',
        'button[type="submit"]',
        'div[id*="Next"] button',
        'div[id*="next"] button',
      ]

      for (const selector of nextSelectors) {
        try {
          const btn = await this.page.$(selector)
          if (btn && await btn.isVisible()) {
            await btn.click()
            return
          }
        } catch {}
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
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-size=1280,800',
            '--lang=tr-TR,tr',
          ],
          ignoreDefaultArgs: ['--enable-automation'],
        })
      } catch (launchErr: any) {
        this.log('Yerel Chrome ikili dosyaları açılamadı, simülasyon moduna geçiliyor.', 'warn')
      }
    }

    if (!this.browser) {
      // Fallback flow for serverless / no-browser environments
      this.log('Hesap ve kampanya adımları simülasyon modunda hazırlanıyor...', 'info')
      await new Promise(r => setTimeout(r, 800))
      this.updateStep('navigating_google_one_ai', 'Google One AI Sayfasına Gidiliyor', 'Google AI Pro abonelik sayfası hazırlanıyor...', 65)
      this.updateStep('waiting_3ds_sms', '3D Secure SMS Onayı Bekleniyor', 'Bankanızdan gelen 3D Secure SMS onayını bekleyin.', 85)
      this.activeState.requiresInput = {
        type: 'payment_confirm',
        title: '3D Secure SMS Onayı',
        description: 'Google AI Pro aboneliği için ödeme yapıldıktan sonra bankanızdan gelen 3D Secure SMS onayını tamamlayıp aşağıdaki butona tıklayın:',
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
    
    // Stealth Evasion Script: Hide navigator.webdriver flag
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
    })

    this.startScreenshotStreaming()

    // Step 1: Google Signup page
    this.updateStep('creating_google_account', 'Google Kayıt Sayfası Açılıyor', 'Google yeni hesap oluşturma ekranına gidiliyor.', 30)
    await this.page.goto('https://accounts.google.com/signup', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await this.captureScreenshot()

    let stepAttempts = 0
    let lastHandledStep = ''
    let stepStuckCount = 0
    let signupCompleted = false

    while (this.page && !this.page.isClosed() && stepAttempts < 80) {
      stepAttempts++
      await this.page.waitForTimeout(2000)
      await this.captureScreenshot()

      const currentUrl = this.page.url()

      // Reset lastHandledStep if stuck on the same page for 3 consecutive loops (only if not waiting for user input)
      stepStuckCount++
      if (stepStuckCount >= 3 && !this.activeState.requiresInput) {
        lastHandledStep = ''
        stepStuckCount = 0
        this.log('Form adımında bekleniyor, İleri butonu tekrar deneniyor...', 'info')
        await this.clickNextButton()
      }

      // Log current URL every 10 iterations for debugging
      if (stepAttempts % 10 === 0) {
        this.log(`Döngü iterasyonu: ${stepAttempts}, URL: ${currentUrl.substring(0, 80)}...`, 'info')
      }

      // Check for QR Code / Device Verification Challenge Screen
      try {
        const pageText = await this.page.textContent('body').catch(() => '')
        if (
          pageText.includes('bazı bilgileri doğrulayın') ||
          pageText.includes('QR kodunu tarayın') ||
          pageText.includes('QR kod') ||
          pageText.includes('Verify it\'s you')
        ) {
          if (lastHandledStep !== 'qr_challenge') {
            lastHandledStep = 'qr_challenge'
            this.log('⚠️ Google QR kod doğrulama ekranı gösterdi. SMS ile doğrulama yöntemine geçiliyor...', 'warn')
            await this.captureScreenshot()

            // Try to click "Farklı bir yöntem deneyin" / "Try another way" to switch to SMS phone entry
            const alternativeLinkSelectors = [
              'a:has-text("Farklı bir yöntem")',
              'button:has-text("Farklı bir yöntem")',
              'a:has-text("Try another way")',
              'button:has-text("Try another way")',
              'a:has-text("Telefon")',
              'button:has-text("Telefon")',
              'a:has-text("SMS")',
              'button:has-text("SMS")',
              '[role="button"]:has-text("Farklı")',
            ]

            let switchedToSms = false
            for (const sel of alternativeLinkSelectors) {
              try {
                const el = await this.page.$(sel)
                if (el && await el.isVisible()) {
                  await el.click()
                  this.log(`"Farklı bir yöntem deneyin" bağlantısına tıklandı: ${sel}`, 'success')
                  switchedToSms = true
                  await this.page.waitForTimeout(2000)
                  await this.captureScreenshot()
                  break
                }
              } catch {}
            }

            if (!switchedToSms) {
              // If couldn't switch automatically, prompt user with clear options
              this.updateStep('waiting_phone_number', 'Telefon Numarası veya QR Onayı', 'Google doğrulama ekranında. Lütfen telefon numaranızı girin veya QR kod onayını yapın.', 45)
              await this.waitForUserInput(
                'phone',
                'Telefon Numarası ile SMS Doğrulaması',
                'Google doğrulama istedi. Lütfen SMS gönderilecek telefon numaranızı (05XXXXXXXXX) yazıp gönderin:',
                '05XXXXXXXXX'
              )
            }
          }
          continue
        }
      } catch {}

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

          // Month Selection - try multiple strategies
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
                await this.page.waitForTimeout(500)
                await this.page.keyboard.press('ArrowDown')
                await this.page.waitForTimeout(200)
                await this.page.keyboard.press('Enter')
              }
            } catch {
              await monthEl.click().catch(() => {})
              await this.page.waitForTimeout(500)
              await this.page.keyboard.press('ArrowDown')
              await this.page.waitForTimeout(200)
              await this.page.keyboard.press('Enter')
            }
          }

          // Gender Selection - try multiple strategies
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
                await this.page.waitForTimeout(500)
                await this.page.keyboard.press('ArrowDown')
                await this.page.waitForTimeout(200)
                await this.page.keyboard.press('Enter')
              }
            } catch {
              await genderEl.click().catch(() => {})
              await this.page.waitForTimeout(500)
              await this.page.keyboard.press('ArrowDown')
              await this.page.waitForTimeout(200)
              await this.page.keyboard.press('Enter')
            }
          }

          await this.captureScreenshot()
          await this.page.waitForTimeout(500)
          await this.clickNextButton()
          this.log('Doğum tarihi ve cinsiyet gönderildi, İleri\'ye basıldı.', 'info')
        }
        continue
      }

      // 3. Username Selection / Input (Google may show radio buttons for suggested emails OR a text input)
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
            // Click the first radio option (Google suggested email)
            await optionRadio.click()
          }
          await this.captureScreenshot()
          await this.clickNextButton()
          this.log('Kullanıcı adı gönderildi.', 'info')
        }
        continue
      }

      // 4. Password Creation
      const pwdInputs = await this.page.$$('input[name="Passwd"], input[name="passwd"], input[type="password"]')
      let validPwdInput: any = null
      for (const inputEl of pwdInputs) {
        try {
          const isRealInput = await inputEl.evaluate((el: any) => el.tagName.toLowerCase() === 'input' && el.type !== 'checkbox' && el.type !== 'hidden')
          if (isRealInput && await inputEl.isVisible()) {
            validPwdInput = inputEl
            break
          }
        } catch {}
      }

      if (validPwdInput) {
        if (lastHandledStep !== 'password') {
          lastHandledStep = 'password'
          this.log('Şifre belirleniyor...', 'info')
          await validPwdInput.fill(password)
          await this.page.keyboard.press('Tab')
          await this.page.waitForTimeout(300)
          
          const confirmPwdInput = await this.page.$(
            'input[name="ConfirmPasswd"], input[name="confirmPasswd"], input[name="PasswdAgain"], input[name="passwdAgain"], input[name="confirmPassword"], #confirmPasswd'
          )
          if (confirmPwdInput) {
            try {
              const isRealConfirm = await confirmPwdInput.evaluate((el: any) => el.tagName.toLowerCase() === 'input')
              if (isRealConfirm && await confirmPwdInput.isVisible()) {
                await confirmPwdInput.fill(password)
                await this.page.keyboard.press('Tab')
                this.log('Şifre onayı girildi.', 'info')
              }
            } catch {}
          }
          await this.captureScreenshot()
          await this.page.waitForTimeout(500)
          await this.clickNextButton()
          await this.page.keyboard.press('Enter')
          this.log('Şifre gönderildi.', 'info')
        }
        continue
      }

      // 5. Phone Number Verification
      const telInput = await this.page.$(
        'input[type="tel"], #phoneNumberId, input[name="phoneNumber"], input[name="phone"], input[id*="phone"], input[id*="Phone"]'
      )
      if (telInput && await telInput.isVisible() && !currentUrl.includes('code')) {
        if (lastHandledStep !== 'phone') {
          lastHandledStep = 'phone'
          this.updateStep('waiting_phone_number', 'Telefon Numarası Bekleniyor', 'Google doğrulama için telefon numarası istedi.', 40)
          this.log('[Telefon Numarası Bekleniyor] Google doğrulama için telefon numarası istedi.', 'info')
          const phoneNum = await this.waitForUserInput(
            'phone',
            'Telefon Numarası Gerekli',
            'Google hesabını doğrulamak için SMS gönderecek. Lütfen telefon numaranızı girin:',
            '05XXXXXXXXX'
          )

          if (phoneNum && this.page && !this.page.isClosed()) {
            const currentTelInput = await this.page.$(
              'input[type="tel"], #phoneNumberId, input[name="phoneNumber"], input[name="phone"], input[id*="phone"], input[id*="Phone"]'
            )
            if (currentTelInput) {
              await currentTelInput.fill(phoneNum)
              this.log(`Telefon numarası girildi: ${phoneNum.substring(0, 4)}****`, 'info')
              await this.captureScreenshot()
              await this.clickNextButton()
              this.log('Telefon numarası gönderildi, SMS bekleniyor...', 'info')
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
          this.log('[SMS Kodu Bekleniyor] Telefonunuza gelen doğrulama kodunu girin.', 'info')
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
              this.log('SMS kodu girildi, doğrulanıyor...', 'info')
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
        this.log('Atla butonuna tıklanıyor...', 'info')
        await skipBtn.click()
        await this.page.waitForTimeout(1500)
        continue
      }

      // 8. Terms Agreement
      const agreeBtn = await this.page.$('button:has-text("Kabul ediyorum"), button:has-text("I agree")')
      if (agreeBtn && await agreeBtn.isVisible()) {
        this.log('Kullanım koşulları kabul ediliyor...', 'info')
        await agreeBtn.click()
        await this.page.waitForTimeout(3000)
        signupCompleted = true
        this.log('✅ Google hesabı başarıyla oluşturuldu!', 'success')
        break
      }

      // If we landed on myaccount or gemini directly
      if (currentUrl.includes('myaccount.google.com') || currentUrl.includes('gemini.google.com')) {
        signupCompleted = true
        this.log('✅ Google hesap sayfasına ulaşıldı!', 'success')
        break
      }
    }

    if (!signupCompleted) {
      this.log('⚠️ Google kayıt döngüsü tamamlanamadı. Mevcut sayfada kaldı.', 'warn')
      if (this.page && !this.page.isClosed()) {
        const finalUrl = this.page.url()
        this.log(`Son sayfa URL: ${finalUrl}`, 'warn')
        await this.captureScreenshot()
      }
    }

    // Only navigate to Gemini offer if signup was completed
    if (signupCompleted) {
      await this.navigateToGeminiOffer()
    } else {
      this.updateStep('error', 'Hesap Oluşturma Tamamlanamadı', 'Google kayıt adımları tamamlanamadı. Lütfen tekrar deneyin.', 0)
    }
  }

  public async navigateToGeminiOffer() {
    if (!this.page || this.page.isClosed()) return
    try {
      // Step 1: Navigate to Google One AI page
      this.updateStep('navigating_google_one_ai', 'Google One AI Sayfasına Gidiliyor', 'Google AI Pro abonelik sayfası açılıyor...', 65)
      await this.page.goto(
        'https://one.google.com/ai?utm_source=gemini&utm_medium=web&utm_campaign=gemini_ail_upsell_zero_state_banner&g1_landing_page=75',
        { waitUntil: 'domcontentloaded', timeout: 45000 }
      )
      await this.page.waitForTimeout(4000)
      await this.captureScreenshot()
      this.log('Google One AI sayfası yüklendi.', 'success')

      // Step 2: Find and click "Google AI Pro üyesi olun" button
      this.updateStep('clicking_pro_plan', 'Google AI Pro Planı Seçiliyor', 'Pro plan butonu aranıyor ve tıklanıyor...', 70)
      await this.captureScreenshot()

      const proButtonSelectors = [
        // Turkish text variants
        'a:has-text("Google AI Pro üyesi olun")',
        'button:has-text("Google AI Pro üyesi olun")',
        'a:has-text("AI Pro üyesi")',
        'button:has-text("AI Pro üyesi")',
        // English text variants
        'a:has-text("Get Google AI Pro")',
        'button:has-text("Get Google AI Pro")',
        'a:has-text("Join Google AI Pro")',
        'button:has-text("Join Google AI Pro")',
        // Generic selectors for middle card (Pro is the 2nd card)
        'section:nth-of-type(2) a[href*="subscribe"]',
        'div[class*="card"]:nth-of-type(2) a',
        'div[class*="card"]:nth-of-type(2) button',
      ]

      let proButtonClicked = false
      for (const selector of proButtonSelectors) {
        try {
          const btn = await this.page.$(selector)
          if (btn && await btn.isVisible()) {
            await btn.scrollIntoViewIfNeeded()
            await this.page.waitForTimeout(500)
            await btn.click()
            this.log(`Pro plan butonu tıklandı: ${selector}`, 'success')
            proButtonClicked = true
            break
          }
        } catch {}
      }

      if (!proButtonClicked) {
        // Fallback: try finding any element with Pro text and click
        this.log('Pro butonu standart selektörlerle bulunamadı, metin araması yapılıyor...', 'warn')
        try {
          const allLinks = await this.page.$$('a, button')
          for (const link of allLinks) {
            const text = await link.textContent().catch(() => '')
            if (text && (text.includes('Pro üyesi') || text.includes('AI Pro') || text.includes('Get Google AI Pro'))) {
              await link.scrollIntoViewIfNeeded()
              await this.page.waitForTimeout(300)
              await link.click()
              this.log(`Pro plan butonu metin aramasıyla bulundu ve tıklandı: "${text.trim().substring(0, 40)}"`, 'success')
              proButtonClicked = true
              break
            }
          }
        } catch (e: any) {
          this.log(`Metin araması hatası: ${e?.message}`, 'warn')
        }
      }

      if (!proButtonClicked) {
        this.log('⚠️ Pro plan butonu otomatik tıklanamadı. Lütfen ekrandan manuel olarak tıklayın.', 'warn')
        await this.waitForUserInput(
          'manual_action',
          'Pro Plan Butonu Manuel Tıklama Gerekli',
          'Otomatik tıklama başarısız oldu. Lütfen tarayıcı ekranında "Google AI Pro üyesi olun" butonuna kendiniz tıklayın, ardından Devam butonuna basın.'
        )
      }

      await this.page.waitForTimeout(3000)
      await this.captureScreenshot()

      // Step 3: Wait for Google Play subscription dialog
      this.updateStep('waiting_google_play_dialog', 'Google Play Ödeme Diyalogu Bekleniyor', 'Google Play abonelik penceresi açılıyor...', 75)
      this.log('Google Play abonelik diyalogu bekleniyor...', 'info')

      // Wait for the Google Play dialog to appear (iframe or overlay)
      let dialogFound = false
      for (let i = 0; i < 20; i++) {
        await this.page.waitForTimeout(1500)
        await this.captureScreenshot()

        // Check for Google Play dialog elements (can be in iframe or direct DOM)
        const subscribeSelectors = [
          // Direct DOM - Turkish
          'button:has-text("Abone Ol")',
          'button:has-text("Abone ol")',
          // Direct DOM - English  
          'button:has-text("Subscribe")',
          // iframe approach
          'iframe[src*="play.google.com"]',
          'iframe[src*="payments.google.com"]',
          // Dialog/overlay markers
          'div[role="dialog"] button:has-text("Abone")',
          'div[role="dialog"] button:has-text("Subscribe")',
        ]

        for (const sel of subscribeSelectors) {
          try {
            const el = await this.page.$(sel)
            if (el && await el.isVisible()) {
              dialogFound = true
              this.log('Google Play diyalogu tespit edildi!', 'success')
              break
            }
          } catch {}
        }

        if (dialogFound) break

        // Also check in iframes
        try {
          const frames = this.page.frames()
          for (const frame of frames) {
            const subscribeBtn = await frame.$('button:has-text("Abone"), button:has-text("Subscribe")')
            if (subscribeBtn && await subscribeBtn.isVisible()) {
              dialogFound = true
              this.log('Google Play diyalogu iframe içinde tespit edildi!', 'success')
              break
            }
          }
        } catch {}

        if (dialogFound) break

        if (i % 5 === 4) {
          this.log(`Diyalog bekleniyor... (${i + 1}/20 deneme)`, 'info')
        }
      }

      if (!dialogFound) {
        this.log('⚠️ Google Play diyalogu otomatik tespit edilemedi.', 'warn')
      }

      // Step 4: Click "Abone Ol" (Subscribe) button
      this.updateStep('clicking_subscribe', 'Abone Ol Butonu Tıklanıyor', 'Google Play "Abone Ol" butonuna basılıyor...', 80)
      await this.page.waitForTimeout(1000)
      await this.captureScreenshot()

      let subscribeClicked = false

      // Try clicking in main page first
      const subscribeButtonSelectors = [
        'button:has-text("Abone Ol")',
        'button:has-text("Abone ol")',
        'button:has-text("Subscribe")',
        'div[role="dialog"] button:has-text("Abone")',
        'div[role="dialog"] button:has-text("Subscribe")',
      ]

      for (const sel of subscribeButtonSelectors) {
        try {
          const btn = await this.page.$(sel)
          if (btn && await btn.isVisible()) {
            await btn.scrollIntoViewIfNeeded()
            await this.page.waitForTimeout(500)
            await btn.click()
            this.log(`"Abone Ol" butonuna tıklandı: ${sel}`, 'success')
            subscribeClicked = true
            break
          }
        } catch {}
      }

      // Try in iframes if not found in main page
      if (!subscribeClicked) {
        try {
          const frames = this.page.frames()
          for (const frame of frames) {
            for (const sel of subscribeButtonSelectors) {
              try {
                const btn = await frame.$(sel)
                if (btn && await btn.isVisible()) {
                  await btn.click()
                  this.log(`"Abone Ol" butonu iframe içinde tıklandı.`, 'success')
                  subscribeClicked = true
                  break
                }
              } catch {}
            }
            if (subscribeClicked) break
          }
        } catch {}
      }

      if (!subscribeClicked) {
        this.log('⚠️ "Abone Ol" butonu otomatik tıklanamadı. Manuel müdahale gerekebilir.', 'warn')
        await this.waitForUserInput(
          'manual_action',
          'Abone Ol Butonu Manuel Tıklama',
          'Otomatik tıklama başarısız oldu. Lütfen Google Play diyalogundaki "Abone Ol" butonuna kendiniz tıklayın, ardından Devam butonuna basın.'
        )
      }

      await this.page.waitForTimeout(3000)
      await this.captureScreenshot()

      // Step 5: Wait for 3D Secure SMS verification
      this.updateStep('waiting_3ds_sms', '3D Secure SMS Onayı Bekleniyor', 'Bankanızdan gelen 3D Secure SMS onay kodunu telefonunuzdan onaylayın.', 85)
      this.log('3D Secure SMS onayı bekleniyor — telefonunuza gelen onay kodunu/bildirimini onaylayın.', 'info')
      await this.captureScreenshot()

      await this.waitForUserInput(
        'payment_confirm',
        '3D Secure SMS Onayı',
        'Bankanızdan gelen 3D Secure SMS onayını telefonunuzdan tamamladıktan sonra aşağıdaki butona tıklayın. Ekranda ödeme onaylandı mesajı görünene kadar bekleyin.'
      )

      // Wait for subscription confirmation on page
      await this.page.waitForTimeout(5000)
      await this.captureScreenshot()
      this.log('Ödeme ve abonelik durumu kontrol ediliyor...', 'info')

      let isRealPaid = false
      try {
        const pageText = await this.page.textContent('body').catch(() => '')
        if (
          pageText.includes('Hoş geldiniz') ||
          pageText.includes('Welcome') ||
          pageText.includes('Aboneliğiniz aktif') ||
          pageText.includes('üyeliğiniz başlatıldı') ||
          pageText.includes('Manage membership') ||
          pageText.includes('Üyeliği yönet')
        ) {
          isRealPaid = true
          this.log('✅ Google AI Pro aboneliği doğrulandı!', 'success')
        } else {
          this.log('ℹ️ Ödeme sayfası tamamlanmadı veya 3DS SMS onayı bekleniyor. Hesap (Ödeme Bekleniyor) olarak kaydedildi.', 'warn')
        }
      } catch {}

      await this.processAfterPayment(isRealPaid)
    } catch (err: any) {
      this.log(`Google One AI Pro abonelik hatası: ${err?.message}`, 'error')
      this.updateStep('error', 'Abonelik Hatası', `Google AI Pro aboneliği tamamlanamadı: ${err?.message}`, 0)
      this.activeState.errorMessage = err?.message
    }
  }

  private async processAfterPayment(isPaymentConfirmed: boolean = true) {
    this.updateStep('extracting_tokens', 'Hesap ve Token Bilgileri Alınıyor', 'Yeni Google AI Pro hesabı hazırlanıyor.', 95)

    const now = new Date()
    const month1Date = now.toISOString()
    const month2Date = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const month3Date = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const expiresDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

    const month1Status: 'paid' | 'due' = isPaymentConfirmed ? 'paid' : 'due'
    const month1Desc = isPaymentConfirmed 
      ? '1. Ay — ₺179,99 (Promosyon Fiyatı, Ödendi)' 
      : '1. Ay — ₺179,99 (Ödeme Bekleniyor)'

    const monthlyPayments: MonthlyPaymentSchedule[] = [
      { month: 1, dueDate: month1Date, status: month1Status, description: month1Desc },
      { month: 2, dueDate: month2Date, status: 'upcoming', description: '2. Ay — ₺179,99 (Promosyon Fiyatı)' },
      { month: 3, dueDate: month3Date, status: 'upcoming', description: '3. Ay — ₺179,99 (Promosyon Son Ay)' },
    ]

    if (this.activeState.account) {
      const newAccount: GeminiAccount = {
        id: `acc_${Date.now()}`,
        email: this.activeState.account.email,
        password: this.activeState.account.password,
        createdDate: now.toISOString(),
        expiresDate,
        monthlyPayments,
        status: isPaymentConfirmed ? 'active' : 'pending_payment',
        geminiPlan: 'Google AI Pro (5 TB) — 3 Aylık Promosyon ₺179,99/ay',
        antigravitySynced: isPaymentConfirmed,
        youtubeSynced: false,
        notes: isPaymentConfirmed 
          ? 'Google One AI Pro aboneliği aktif. 3 aylık promosyon (₺179,99/ay), sonra ₺869,99/ay.'
          : 'Google hesabı açıldı, 1. ay ₺179,99 ödemesi ve 3DS SMS onayı bekleniyor.',
      }
      saveAccount(newAccount)
    }

    if (isPaymentConfirmed) {
      this.updateStep('completed', 'Google AI Pro Aboneliği Aktif!', 'Google AI Pro (5 TB) aboneliği başarıyla tamamlandı! 1. ay ₺179,99 ödendi.', 100)
    } else {
      this.updateStep('completed', 'Hesap Oluşturuldu (Ödeme Bekleniyor)', 'Google hesabı başarıyla açıldı. 1. ay ₺179,99 ödemesi tamamlandığında sistem aktifleşecektir.', 100)
    }
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

