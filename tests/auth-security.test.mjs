import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { requiresPasswordChange, validateNewPassword } from "../lib/auth/password.ts";
import { LOGIN_WINDOW_MS, loginRetryAfter, MAX_FAILURES_PER_USERNAME } from "../lib/auth/login-throttle.ts";

test("password policy rejects short, letter-only, common and username-based passwords", () => {
  assert.match(validateNewPassword("abc123"), /ít nhất 8/);
  assert.match(validateNewPassword("abcdefgh"), /chữ và số/);
  assert.match(validateNewPassword("password123"), /phổ biến/);
  assert.match(validateNewPassword("hieunp2026", "hieunp"), /tên đăng nhập/);
  assert.equal(validateNewPassword("VanHanh#2026x", "hieunp"), null);
});

test("the former shared default password now forces a change at login", () => {
  assert.equal(requiresPasswordChange("password123", "anyone"), true);
  assert.equal(requiresPasswordChange("VanHanh#2026x", "anyone"), false);
});

function fakeDb(rows) {
  return {
    prepare(sql) {
      return {
        bind(key, since) {
          return {
            async first() {
              const column = sql.includes("WHERE username") ? "username" : "ip";
              const hits = rows.filter(row => row[column] === key && row.at > since);
              return { n: hits.length, first: hits.length ? Math.min(...hits.map(row => row.at)) : null };
            },
          };
        },
      };
    },
  };
}

test("login is blocked after repeated failures and unblocked when the window passes", async () => {
  const now = 1_000_000_000;
  const failures = Array.from({ length: MAX_FAILURES_PER_USERNAME }, (_, index) => ({ username: "a", ip: "1.1.1.1", at: now - 60_000 + index }));
  const db = fakeDb(failures);
  const retry = await loginRetryAfter(db, "a", "9.9.9.9", now);
  assert.ok(retry > 0 && retry <= LOGIN_WINDOW_MS / 1000);
  assert.equal(await loginRetryAfter(db, "b", "9.9.9.9", now), null);
  assert.equal(await loginRetryAfter(db, "a", "9.9.9.9", now + LOGIN_WINDOW_MS), null);
});

test("session tokens carry the pending password change flag", async () => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters!!";
  const { createSessionToken, verifySessionToken } = await import("../lib/auth/session.ts");
  const token = await createSessionToken({ id: 7, username: "u", displayName: "U", role: "viewer", permissions: ["view_all"], mustChangePassword: true });
  assert.equal((await verifySessionToken(token)).mustChangePassword, true);
  const clean = await createSessionToken({ id: 7, username: "u", displayName: "U", role: "viewer", permissions: ["view_all"] });
  assert.equal((await verifySessionToken(clean)).mustChangePassword, false);
});

test("no plaintext passwords, public data endpoints or header-trusting auth remain in the source", () => {
  const seeds = readFileSync(new URL("../lib/auth/initial-users-data.ts", import.meta.url), "utf8");
  assert.doesNotMatch(seeds, /rawPassword\s*:\s*"/);
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.doesNotMatch(proxy, /water-report\/compare/);
  assert.match(proxy, /mustChangePassword/);
  for (const route of ["daily-inputs", "measurements", "ppa-heat-rate", "ppa-heat-rate/notes"]) {
    const source = readFileSync(new URL(`../app/api/${route}/route.ts`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /requireEditor/, route);
    assert.match(source, /requireAnyPermission\("/, route);
  }
});
