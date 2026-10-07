import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";

const requireFromBuild = createRequire(import.meta.url);
const { getClientIpKey } = requireFromBuild(
  join(process.env.SAFT_TEST_BUILD_DIR, "client-ip.cjs"),
);

test.beforeEach(() => {
  delete process.env.TRUST_PROXY_HEADERS;
});

test.afterEach(() => {
  delete process.env.TRUST_PROXY_HEADERS;
});

function request(headers = {}, ip) {
  const incoming = new Request("http://localhost", { headers });
  if (ip) Object.defineProperty(incoming, "ip", { value: ip });
  return incoming;
}

test("uses CF-Connecting-IP when proxy headers are trusted", () => {
  // #given
  // #when
  const result = getClientIpKey(
    request({
      "cf-connecting-ip": "2001:db8::1",
      "x-forwarded-for": "198.51.100.4",
    }),
  );

  // #then
  assert.equal(result, getClientIpKey(request({ "cf-connecting-ip": "2001:db8::1" })));
});

test("falls back to the first valid X-Forwarded-For address", () => {
  // #given
  // #when
  const result = getClientIpKey(
    request({ "x-forwarded-for": "not-an-ip, 203.0.113.8, 198.51.100.4" }),
  );

  // #then
  assert.equal(result, getClientIpKey(request({ "x-forwarded-for": "203.0.113.8" })));
});

test("falls back when CF-Connecting-IP is invalid", () => {
  // #given
  // #when
  const result = getClientIpKey(
    request({
      "cf-connecting-ip": "not-an-ip",
      "x-forwarded-for": "203.0.113.8",
    }),
  );

  // #then
  assert.equal(result, getClientIpKey(request({ "x-forwarded-for": "203.0.113.8" })));
});

test("falls back to X-Real-IP when other proxy IP headers are unavailable", () => {
  // #given
  // #when
  const result = getClientIpKey(request({ "x-real-ip": "198.51.100.7" }));

  // #then
  assert.equal(result, getClientIpKey(request({ "x-real-ip": "198.51.100.7" })));
});

test("falls back to the runtime request IP when forwarded headers are absent", () => {
  // #given
  // #when
  const result = getClientIpKey(request({}, "192.0.2.12"));

  // #then
  assert.equal(result, getClientIpKey(request({}, "192.0.2.12")));
});

test("does not trust proxy headers when TRUST_PROXY_HEADERS is false", () => {
  // #given
  process.env.TRUST_PROXY_HEADERS = "false";

  // #when
  const result = getClientIpKey(
    request({
      "cf-connecting-ip": "203.0.113.1",
      "x-forwarded-for": "203.0.113.2",
      "x-real-ip": "203.0.113.3",
    }),
  );

  // #then
  assert.equal(result, null);
});

test("uses the runtime request IP when proxy-header trust is disabled", () => {
  // #given
  process.env.TRUST_PROXY_HEADERS = "false";

  // #when
  const result = getClientIpKey(
    request({ "cf-connecting-ip": "203.0.113.1" }, "192.0.2.12"),
  );

  // #then
  assert.equal(result, getClientIpKey(request({}, "192.0.2.12")));
});
