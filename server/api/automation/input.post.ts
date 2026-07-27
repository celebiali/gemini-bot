import { playwrightWorker } from '../../utils/playwrightWorker'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.input) {
    return { success: false, error: 'Girdi eksik.' }
  }
  return await playwrightWorker.submitInput(body.input)
})
