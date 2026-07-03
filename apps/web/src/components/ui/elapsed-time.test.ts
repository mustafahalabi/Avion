import { describe, expect, it } from "vitest";
import { formatDuration } from "./elapsed-time";

describe("formatDuration", () => {
  describe("compact mode", () => {
    it("renders seconds only under a minute", () => {
      expect(formatDuration(0)).toBe("0s");
      expect(formatDuration(8_000)).toBe("8s");
      expect(formatDuration(59_000)).toBe("59s");
    });

    it("renders minutes + zero-padded seconds under an hour", () => {
      expect(formatDuration(65_000)).toBe("1m 05s");
      expect(formatDuration(12 * 60_000 + 4_000)).toBe("12m 04s");
    });

    it("renders hours + minutes at/over an hour (drops seconds)", () => {
      expect(formatDuration(3_600_000)).toBe("1h 0m");
      expect(formatDuration(3_661_000)).toBe("1h 1m");
      expect(formatDuration(2 * 3_600_000 + 47 * 60_000)).toBe("2h 47m");
    });
  });

  describe("clock mode", () => {
    it("renders MM:SS under an hour", () => {
      expect(formatDuration(0, "clock")).toBe("00:00");
      expect(formatDuration(65_000, "clock")).toBe("01:05");
      expect(formatDuration(12 * 60_000 + 4_000, "clock")).toBe("12:04");
    });

    it("renders HH:MM:SS at/over an hour", () => {
      expect(formatDuration(3_661_000, "clock")).toBe("01:01:01");
      expect(formatDuration(10 * 3_600_000, "clock")).toBe("10:00:00");
    });
  });

  it("clamps negative durations to zero (clock skew safety)", () => {
    expect(formatDuration(-5_000)).toBe("0s");
    expect(formatDuration(-5_000, "clock")).toBe("00:00");
  });

  it("truncates sub-second remainders rather than rounding up", () => {
    expect(formatDuration(1_999)).toBe("1s");
    expect(formatDuration(999)).toBe("0s");
  });
});
