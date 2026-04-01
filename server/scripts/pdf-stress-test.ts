/**
 * =====================================================================
 *  PDF STRESS TEST — Failure Simulation & Recovery Verification
 * =====================================================================
 *
 *  TEST ENVIRONMENT:
 *    Server: Replit (dev/US) — 0.5 vCPU, 1GB RAM
 *    Runtime: Node.js + tsx (TypeScript)
 *    PDF Engine: @react-pdf/renderer (in-process, no Chromium)
 *    Database: Neon PostgreSQL (dev)
 *    Document: tax_invoice #2795 (5 items, 1 page, ~33KB)
 *
 *  TEST RESULTS (2026-03-31, Replit dev server):
 *
 *    TEST 1 — 40 concurrent (all normal):
 *      40/40 OK | peak RSS 240MB | avg 13,836ms | min 3,118ms | max 24,577ms
 *      Single-request baseline: ~3 seconds (from warmup & recovery)
 *
 *    TEST 2 — 40 concurrent (4 throw + 3 hang):
 *      33/33 normal OK | 4/4 throws caught | 3/3 hangs timed out (30s)
 *      Recovery: 5/5 OK after failures | peak RSS 213MB → GC 185MB
 *
 *  BENCHMARK — Render time vs item count (single request):
 *      5 items → 1.5s | 50 → 4.2s | 100 → 7.4s | 200 → 12.7s | 300 → 16.4s | 400 → 20.2s
 *      Rate: ~50ms per item, ~600ms per page
 *
 *  ⚠️  PRODUCTION ADEQUACY NOTE:
 *    Final server spec supports 500+ concurrent users.
 *    Minimum production stress test should be 20-30% = 100-150 concurrent.
 *    This test did 40 concurrent — BELOW minimum production standard.
 *    Proper production stress test must be conducted on the final server
 *    (dedicated hardware, Thailand) with 100-150+ concurrent requests
 *    before certifying PDF system for production load.
 *
 *  Run: npx tsx --expose-gc server/scripts/pdf-stress-test.ts
 * =====================================================================
 */

import { buildPdfDataById } from "../pdf-data-fetcher";
import { generatePdfDirect, _setTestHook, getPdfHealthStats, type GeneratePdfOptions } from "../pdf-react-generator";

const DOC_TYPE = "tax_invoice";
const DOC_ID = 2795;
const RENDER_TIMEOUT = 30;

function memMB() {
  const m = process.memoryUsage();
  return {
    rss: Math.round(m.rss / 1024 / 1024),
    heapUsed: Math.round(m.heapUsed / 1024 / 1024),
  };
}

async function test1_normalConcurrent(pdfOpts: GeneratePdfOptions, count: number) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  TEST 1: ${count} concurrent PDF requests (all normal)`);
  console.log(`${"=".repeat(60)}`);

  _setTestHook(null);

  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 500));

  const memBefore = memMB();
  const startTime = Date.now();
  let peakRss = memBefore.rss;

  const monitor = setInterval(() => {
    const m = memMB();
    if (m.rss > peakRss) peakRss = m.rss;
  }, 50);

  const results = await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const t0 = Date.now();
      try {
        const buf = await generatePdfDirect(pdfOpts);
        return { i, ok: true, ms: Date.now() - t0, bytes: buf.length, error: "" };
      } catch (err: any) {
        return { i, ok: false, ms: Date.now() - t0, bytes: 0, error: err.message };
      }
    })
  );

  clearInterval(monitor);
  const totalMs = Date.now() - startTime;

  const successes = results.filter(r => r.ok).length;
  const failures = results.filter(r => !r.ok).length;
  const times = results.map(r => r.ms);

  console.log(`  Results:     ${successes} OK / ${failures} FAIL`);
  console.log(`  Time:        total=${totalMs}ms  avg=${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms  min=${Math.min(...times)}ms  max=${Math.max(...times)}ms`);
  console.log(`  Memory:      before RSS=${memBefore.rss}MB  peak RSS=${peakRss}MB`);
  console.log(`  Health:      ${JSON.stringify(getPdfHealthStats())}`);

  if (failures > 0) {
    results.filter(r => !r.ok).forEach(r => console.log(`    #${r.i}: ${r.error} (${r.ms}ms)`));
  }

  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 1000));
  console.log(`  After GC:    ${JSON.stringify(memMB())}`);

  return { successes, failures, totalMs, peakRss };
}

async function test2_withFailures(
  pdfOpts: GeneratePdfOptions,
  count: number,
  throwIndices: number[],
  hangIndices: number[],
) {
  const totalFailures = throwIndices.length + hangIndices.length;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  TEST 2: ${count} concurrent PDFs — ${throwIndices.length} THROW + ${hangIndices.length} HANG`);
  console.log(`  THROW indices: [${throwIndices.join(", ")}]`);
  console.log(`  HANG indices:  [${hangIndices.join(", ")}]  (expect ~${RENDER_TIMEOUT}s timeout each)`);
  console.log(`${"=".repeat(60)}`);

  let callSeq = 0;
  const throwSet = new Set(throwIndices);
  const hangSet = new Set(hangIndices);

  _setTestHook(async () => {
    const myIndex = callSeq++;
    if (throwSet.has(myIndex)) {
      console.log(`    [hook] Request #${myIndex} → THROWING error`);
      throw new Error(`SIMULATED CRASH in request #${myIndex}`);
    }
    if (hangSet.has(myIndex)) {
      console.log(`    [hook] Request #${myIndex} → HANGING forever (will timeout in ${RENDER_TIMEOUT}s)`);
      await new Promise(() => {});
    }
  });

  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 500));

  const memBefore = memMB();
  const startTime = Date.now();
  let peakRss = memBefore.rss;

  const monitor = setInterval(() => {
    const m = memMB();
    if (m.rss > peakRss) peakRss = m.rss;
  }, 200);

  const results = await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const t0 = Date.now();
      try {
        const buf = await generatePdfDirect(pdfOpts);
        return { i, ok: true, ms: Date.now() - t0, bytes: buf.length, error: "" };
      } catch (err: any) {
        return { i, ok: false, ms: Date.now() - t0, bytes: 0, error: err.message.slice(0, 150) };
      }
    })
  );

  clearInterval(monitor);
  _setTestHook(null);

  const totalMs = Date.now() - startTime;
  const successes = results.filter(r => r.ok).length;
  const failures = results.filter(r => !r.ok).length;

  const okResults = results.filter(r => r.ok);
  const failResults = results.filter(r => !r.ok);

  console.log(`\n  Successes:   ${successes} OK  (expected ~${count - totalFailures})`);
  if (okResults.length > 0) {
    const okTimes = okResults.map(r => r.ms);
    console.log(`  OK times:    avg=${Math.round(okTimes.reduce((a, b) => a + b, 0) / okTimes.length)}ms  min=${Math.min(...okTimes)}ms  max=${Math.max(...okTimes)}ms`);
  }

  console.log(`\n  Failures:    ${failures}  (expected ${totalFailures})`);
  const throwFails = failResults.filter(r => r.error.includes("SIMULATED CRASH"));
  const timeoutFails = failResults.filter(r => r.error.includes("timeout"));
  const queueFails = failResults.filter(r => r.error.includes("queue timeout"));
  const otherFails = failResults.filter(r => !r.error.includes("SIMULATED CRASH") && !r.error.includes("timeout"));

  console.log(`    Throws caught:     ${throwFails.length}`);
  throwFails.forEach(r => console.log(`      #${r.i}: ${r.error} (${r.ms}ms)`));

  console.log(`    Render timeouts:   ${timeoutFails.filter(r => !r.error.includes("queue")).length}`);
  timeoutFails.filter(r => !r.error.includes("queue")).forEach(r => console.log(`      #${r.i}: timed out in ${r.ms}ms`));

  if (queueFails.length > 0) {
    console.log(`    Queue timeouts:    ${queueFails.length}`);
    queueFails.forEach(r => console.log(`      #${r.i}: ${r.error} (${r.ms}ms)`));
  }

  if (otherFails.length > 0) {
    console.log(`    Other failures:    ${otherFails.length}`);
    otherFails.forEach(r => console.log(`      #${r.i}: ${r.error} (${r.ms}ms)`));
  }

  console.log(`\n  Total time:  ${totalMs}ms`);
  console.log(`  Memory:      before RSS=${memBefore.rss}MB  peak RSS=${peakRss}MB`);
  console.log(`  Health:      ${JSON.stringify(getPdfHealthStats())}`);

  console.log(`\n  --- RECOVERY CHECK ---`);
  console.log(`  Sending 5 normal requests to verify system recovered...`);

  const recoveryResults = await Promise.all(
    Array.from({ length: 5 }, async (_, i) => {
      const t0 = Date.now();
      try {
        const buf = await generatePdfDirect(pdfOpts);
        return { i, ok: true, ms: Date.now() - t0, bytes: buf.length };
      } catch (err: any) {
        return { i, ok: false, ms: Date.now() - t0, bytes: 0, error: err.message };
      }
    })
  );

  const recoveryOk = recoveryResults.filter(r => r.ok).length;
  const recoveryTimes = recoveryResults.map(r => r.ms);
  console.log(`  Recovery:    ${recoveryOk}/5 OK  avg=${Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length)}ms`);
  console.log(`  Health:      ${JSON.stringify(getPdfHealthStats())}`);

  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 1000));
  const memRecovered = memMB();
  console.log(`  After GC:    ${JSON.stringify(memRecovered)}`);

  return { successes, failures, throwFails: throwFails.length, timeoutFails: timeoutFails.length, recoveryOk, totalMs, peakRss, memRecoveredRss: memRecovered.rss };
}

async function main() {
  console.log(`\nPDF STRESS TEST — Normal + Failure Simulation`);
  console.log(`Document: ${DOC_TYPE} #${DOC_ID}`);
  console.log(`GC exposed: ${!!global.gc}`);
  console.log(`Render timeout: ${RENDER_TIMEOUT}s  Queue timeout: 60s`);

  console.log(`\nWarming up...`);
  const pdfOpts = await buildPdfDataById(DOC_TYPE, DOC_ID);
  await generatePdfDirect(pdfOpts);
  console.log(`Warmup done.\n`);

  const r1 = await test1_normalConcurrent(pdfOpts, 40);

  await new Promise(r => setTimeout(r, 2000));

  const throwIndices = [5, 14, 22, 33];
  const hangIndices = [8, 20, 36];
  const r2 = await test2_withFailures(pdfOpts, 40, throwIndices, hangIndices);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  FINAL SUMMARY`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  TEST 1 — 40 normal:`);
  console.log(`    ${r1.successes}/40 OK  peak=${r1.peakRss}MB  time=${r1.totalMs}ms`);
  console.log(`  TEST 2 — 40 with ${throwIndices.length} throws + ${hangIndices.length} hangs:`);
  console.log(`    OK=${r2.successes}  Throws caught=${r2.throwFails}  Timeouts=${r2.timeoutFails}  Recovery=${r2.recoveryOk}/5`);
  console.log(`    Peak=${r2.peakRss}MB  Recovered=${r2.memRecoveredRss}MB  Time=${r2.totalMs}ms`);

  const pass =
    r1.failures === 0 &&
    r2.throwFails >= throwIndices.length &&
    r2.timeoutFails >= hangIndices.length &&
    r2.recoveryOk === 5;

  if (pass) {
    console.log(`\n✅ ALL TESTS PASSED — system handles throws, hangs, and recovers correctly`);
  } else {
    console.log(`\n⚠️  REVIEW NEEDED — see details above`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
