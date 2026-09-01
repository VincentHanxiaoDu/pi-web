import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startEventLoopWatchdog } from "./eventLoopWatchdog";

describe("the event loop watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function watch(): { messages: string[]; exits: number[]; stop: () => void } {
    const messages: string[] = [];
    const exits: number[] = [];
    const handle = startEventLoopWatchdog(
      (message) => {
        messages.push(message);
      },
      () => Date.now(),
      (code) => {
        exits.push(code);
      },
    );
    return {
      messages,
      exits,
      stop: () => {
        clearInterval(handle);
      },
    };
  }

  it("exits when the loop stalls past the budget", () => {
    const { messages, exits, stop } = watch();

    // One healthy beat, then the loop freezes: wall-clock time runs on while
    // the heartbeat cannot fire. The next beat sees the whole drift.
    vi.advanceTimersByTime(1_000);
    vi.setSystemTime(Date.now() + 90_000);
    vi.advanceTimersByTime(1_000);

    expect(exits).toEqual([1]);
    expect(messages.some((message) => message.includes("stalled"))).toBe(true);
    stop();
  });

  it("lets a healthy loop run forever", () => {
    const { messages, exits, stop } = watch();

    for (let minute = 0; minute < 10; minute += 1) {
      vi.advanceTimersByTime(60_000);
    }

    expect(exits).toEqual([]);
    expect(messages).toEqual([]);
    stop();
  });

  it("does not fire for a stall still inside the budget", () => {
    const { messages, exits, stop } = watch();

    vi.advanceTimersByTime(1_000);
    vi.setSystemTime(Date.now() + 30_000);
    vi.advanceTimersByTime(1_000);

    expect(exits).toEqual([]);
    expect(messages).toEqual([]);
    stop();
  });
});
