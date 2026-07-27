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

const start_post = defineEventHandler(async (event) => {
  var _a;
  const body = await readBody(event).catch(() => ({}));
  const result = await playwrightWorker.startAutomation({
    customEmail: body == null ? void 0 : body.customEmail,
    headless: (_a = body == null ? void 0 : body.headless) != null ? _a : false
  });
  return result;
});

export { start_post as default };
//# sourceMappingURL=start.post.mjs.map
