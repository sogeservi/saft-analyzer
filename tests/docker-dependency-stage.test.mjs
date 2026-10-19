import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

test("builds and serves a static export from the production container", async () => {
  // #given
  const dockerfile = await readFile(join(projectRoot, "Dockerfile"), "utf8");

  // #when
  // #then
  assert.match(dockerfile, /RUN npm run build/);
  assert.match(dockerfile, /COPY --from=builder \/app\/out \/usr\/share\/nginx\/html/);
  assert.match(dockerfile, /FROM nginx:alpine AS runner/);
  assert.doesNotMatch(dockerfile, /next start|server\.js/);
});

test("the stable worker endpoint is not cached while hashed Next assets remain immutable", async () => {
  const config = await readFile(join(projectRoot, "nginx.conf"), "utf8");
  const workerLocation = config.match(/location = \/analysis\.worker\.js \{([^}]+)\}/)?.[1];
  assert.ok(workerLocation, "the analysis worker needs its own cache policy");
  assert.match(workerLocation, /add_header Cache-Control "no-store" always/);
  for (const header of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]) {
    assert.ok(workerLocation.includes(header), `${header} must remain present in the worker location`);
  }
  assert.match(config, /location \/_next\/static\/ \{[^}]+public, immutable/);
});
