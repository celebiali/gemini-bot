import { playwrightWorker } from '../../utils/playwrightWorker'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const result = await playwrightWorker.startAutomation({
    customEmail: body?.customEmail,
    headless: body?.headless ?? false,
  })
  return result
})
