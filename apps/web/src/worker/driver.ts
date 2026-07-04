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

import { createHeartbeat } from "./heartbeat";
import {
  acquireSingleInstanceLock,
  singleInstanceEnabled,
  type InstanceLock,
} from "./single-instance-lock";
import { validateConfig, WORKER_CONFIG } from "./worker-config";
import { workerLogger } from "./worker-logger";

let isShuttingDown = false;
let instanceLock: InstanceLock | null = null;

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
  // Liveness signal (MUS-269): touch the heartbeat file once per tick so
  // container HEALTHCHECKs can assert freshness (see docs/DEPLOYMENT.md).
  const heartbeat = createHeartbeat("driver", process.env.DRIVER_HEARTBEAT_FILE);

  while (!isShuttingDown) {
    heartbeat.beat();
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

  // Single-instance guard (Goal 4): one driver only — several drivers ticking
  // in parallel corrupt the live/prepared concurrency accounting.
  instanceLock = await acquireSingleInstanceLock("driver", {
    enabled: singleInstanceEnabled(),
  });
  if (!instanceLock.acquired) {
    workerLogger.error(
      "[driver] Another driver instance is already running (single-instance lock held). Exiting. " +
        "Set WORKER_SINGLE_INSTANCE=0 to allow multiple (not recommended)."
    );
    await instanceLock.release();
    process.exit(0);
  }

  workerLogger.info(
    `[driver] Started. Ticking every ${WORKER_CONFIG.DRIVER_TICK_INTERVAL_MS}ms.`
  );

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);

  await driverLoop();
  if (instanceLock) {
    await instanceLock.release();
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  workerLogger.error(`[driver] crashed: ${message}`);
  process.exit(1);
});
