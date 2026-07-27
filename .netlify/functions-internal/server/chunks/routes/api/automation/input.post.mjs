import { d as defineEventHandler, r as readBody } from '../../../nitro/nitro.mjs';
import { p as playwrightWorker } from '../../../_/playwrightWorker.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'playwright';
import '../../../_/db.mjs';
import 'fs';
import 'path';

const input_post = defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!(body == null ? void 0 : body.input)) {
    return { success: false, error: "Girdi eksik." };
  }
  return await playwrightWorker.submitInput(body.input);
});

export { input_post as default };
//# sourceMappingURL=input.post.mjs.map
