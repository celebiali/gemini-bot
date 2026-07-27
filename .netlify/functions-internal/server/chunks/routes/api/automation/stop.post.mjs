import { d as defineEventHandler } from '../../../nitro/nitro.mjs';
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

const stop_post = defineEventHandler(async () => {
  await playwrightWorker.stopAutomation();
  return { success: true };
});

export { stop_post as default };
//# sourceMappingURL=stop.post.mjs.map
