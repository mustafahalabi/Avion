/**
 * Continuous Execution Driver (MUS-211).
 *
 * A separate long-running process from the executor worker (`index.ts`). The
 * worker *executes* prepared sessions; this driver *schedules* — on an interval
 * it enqueues the next executable task(s) per company (respecting the
 * concurrency limit) and advances completed work through the review/QA gates.
 *
 * Run with `npm run driver`. The tick logic lives in
 * `@/lib/execution-driver-service` so it is testable and replaceable; this file
 * is only the loop + lifecycle (graceful shutdown, logging).
 */

import {
  runDriverTickForCompany,
  summarizeDriverTick,
} from "@/lib/execution-driver-service";
import { prisma } from "@/lib/prisma";

import { validateConfig, WORKER_CONFIG } from "./worker-config";
import { workerLogger } from "./worker-logger";

let isShuttingDown = false;

/**
 * Sleeps for the given number of milliseconds.
 *
 * @param ms - Duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gracefully stops the driver loop.
 */
function handleShutdown(): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  workerLogger.info("[driver] Shutting down gracefully...");
}

/**
 * Runs one driver tick across every company, logging each company's decisions.
 */
async function tickAllCompanies(): Promise<void> {
  const companies = await prisma.company.findMany({ select: { id: true } });

  for (const company of companies) {
    if (isShuttingDown) {
      break;
    }
    try {
      const result = await runDriverTickForCompany(company.id);
      workerLogger.info(`[driver] ${summarizeDriverTick(result)}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      workerLogger.error(`[driver] Tick failed for company ${company.id}: ${message}`);
    }
  }
}

/**
 * Polls and drives all companies until shutdown.
 */
async function driverLoop(): Promise<void> {
  while (!isShuttingDown) {
    await tickAllCompanies();
    if (isShuttingDown) {
      break;
    }
    await sleep(WORKER_CONFIG.DRIVER_TICK_INTERVAL_MS);
  }
}

/**
 * Driver entry point.
 */
async function main(): Promise<void> {
  validateConfig();
  workerLogger.info(
    `[driver] Started. Ticking every ${WORKER_CONFIG.DRIVER_TICK_INTERVAL_MS}ms.`
  );

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);

  await driverLoop();
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  workerLogger.error(`[driver] crashed: ${message}`);
  process.exit(1);
});
