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
