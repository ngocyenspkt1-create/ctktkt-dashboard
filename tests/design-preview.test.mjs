import assert from "node:assert/strict";
import { test } from "node:test";
import { stripPreviewRuntime } from "../scripts/design-preview-html.mjs";

test("static preview removes hydration, RSC payload, module preload and HMR while retaining content", () => {
  const source = '<html><head><link rel="stylesheet" href="/app.css"><link rel="modulepreload" href="/client.js"><link rel="icon" href="/favicon.svg"></head><body><h1>Preview</h1><script type="module" src="/client.js"></script><script>window.__rsc="payload"</script><a href="/login">Login</a></body></html>';
  const result = stripPreviewRuntime(source, "body { color: blue; }");
  assert.doesNotMatch(result, /<script|modulepreload|client\.js|__rsc|app\.css/);
  assert.match(result, /<h1>Preview<\/h1>/);
  assert.match(result, /href="\/login"/);
  assert.match(result, /favicon\.svg/);
  assert.match(result, /<style>body \{ color: blue; \}<\/style>/);
});

test("embedded CSS cannot close the preview style element", () => {
  const result = stripPreviewRuntime("<head></head>", '/* </style><script>alert(1)</script> */');
  assert.equal((result.match(/<\/style>/g) || []).length, 1);
});
