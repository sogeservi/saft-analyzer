import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const requireFromBuild = createRequire(import.meta.url);
const clientPath = join(process.env.SAFT_TEST_BUILD_DIR, "analyze-file.cjs");

test("worker URLs change between builds, including builds with the same version", async (t) => {
  const originalVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  const originalDate = process.env.NEXT_PUBLIC_BUILD_DATE;
  const originalWorker = globalThis.Worker;
  t.after(() => {
    if (originalVersion === undefined) delete process.env.NEXT_PUBLIC_APP_VERSION;
    else process.env.NEXT_PUBLIC_APP_VERSION = originalVersion;
    if (originalDate === undefined) delete process.env.NEXT_PUBLIC_BUILD_DATE;
    else process.env.NEXT_PUBLIC_BUILD_DATE = originalDate;
    delete requireFromBuild.cache[clientPath];
    if (originalWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = originalWorker;
  });

  const loadedUrls = [];
  const completed = { id: "analysis-result" };
  globalThis.Worker = class {
    constructor(url, options) {
      loadedUrls.push(new URL(url, "https://example.test"));
      assert.equal(options.type, "module");
    }
    terminate() {}
    postMessage() {
      queueMicrotask(() => this.onmessage({ data: { type: "complete", result: completed } }));
    }
  };

  for (const [version, date] of [
    ["0.1.0+old", "2026-10-19 12:00 UTC"],
    ["0.1.0+new", "2026-10-19 12:01 UTC"],
    ["0.1.0+new", "2026-10-19 12:02 UTC"],
  ]) {
    process.env.NEXT_PUBLIC_APP_VERSION = version;
    process.env.NEXT_PUBLIC_BUILD_DATE = date;
    delete requireFromBuild.cache[clientPath];
    const { analyzeFileInWorker } = requireFromBuild(clientPath);
    assert.equal(await analyzeFileInWorker(new File(["<AuditFile/>"], "test.xml"), () => {}), completed);
    const url = loadedUrls.at(-1);
    assert.equal(url.pathname, "/analysis.worker.js");
    assert.equal(url.searchParams.get("v"), version);
    assert.equal(url.searchParams.get("build"), date);
  }
  assert.equal(new Set(loadedUrls.map(({ href }) => href)).size, 3);
});

test("the bundled analysis worker accepts E rather than returning UNSUPPORTED_BASIS", async () => {
  const source = await readFile(join(process.env.SAFT_TEST_BUILD_DIR, "analysis-worker.cjs"), "utf8");
  const messages = [];
  const worker = { postMessage: (message) => messages.push(message) };
  runInNewContext(source, {
    self: worker, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer,
    Date, Intl, crypto: globalThis.crypto,
  });

  await worker.onmessage({ data: { file: new File([
    '<?xml version="1.0" encoding="UTF-8"?><AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01"><Header><AuditFileVersion>1.04_01</AuditFileVersion><TaxAccountingBasis>E</TaxAccountingBasis></Header><MasterFiles/></AuditFile>',
  ], "third-party.xml") } });

  const response = messages.find(({ type }) => type === "complete" || type === "error");
  assert.equal(response?.type, "complete", JSON.stringify(response));
  assert.equal(response.result.header.taxAccountingBasis, "E");
});
