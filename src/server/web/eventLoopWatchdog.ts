/**
 * Watch the event loop for a stall the process survives but the service does
 * not.
 *
 * A blocked filesystem op (one stalled directory open is enough) parks all
 * four libuv threadpool workers; every async fs and DNS call then queues
 * forever while the event loop idles in the kernel. The process stays alive
 * and listening — the TCP handshake completes from the kernel backlog — but no
 * request is ever answered, and launchd's KeepAlive sees a healthy pid it has
 * no reason to restart.
 *
 * A heartbeat timer whose drift exceeds the budget is exactly that state. The
 * only recovery is a new process, so this exits and lets launchd do what it
 * already knows how to do.
 *
 * The heartbeat is unref'd so it cannot by itself keep an otherwise idle
 * process alive: it watches the loop, it is not part of the workload.
 */
const EVENT_LOOP_STALL_EXIT_MS = 60_000;

export function startEventLoopWatchdog(
  log: (message: string) => void = (message) => {
    console.error(message);
  },
  now: () => number = Date.now,
  exit: (code: number) => void = (code) => {
    process.exit(code);
  },
): NodeJS.Timeout {
  let lastBeat = now();
  const heartbeat = setInterval(() => {
    const current = now();
    const drift = current - lastBeat;
    lastBeat = current;
    if (drift <= EVENT_LOOP_STALL_EXIT_MS) return;
    const stalledSeconds = String(Math.round(drift / 1000));
    const budgetSeconds = String(EVENT_LOOP_STALL_EXIT_MS / 1000);
    log(`Event loop stalled for ${stalledSeconds}s (budget ${budgetSeconds}s); exiting so launchd can restart the service.`);
    exit(1);
  }, 1_000);
  heartbeat.unref();
  return heartbeat;
}
