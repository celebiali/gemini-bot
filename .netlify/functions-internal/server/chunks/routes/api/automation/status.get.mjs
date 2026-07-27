import { d as defineEventHandler } from '../../../nitro/nitro.mjs';
import { p as playwrightWorker } from '../../../_/playwrightWorker.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import '../../../_/db.mjs';
import 'fs';
import 'path';

const status_get = defineEventHandler(() => {
  return playwrightWorker.getState();
});

export { status_get as default };
//# sourceMappingURL=status.get.mjs.map
