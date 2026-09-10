import { describe, expect, it, vi } from "vitest";

import {
  forEachChunk,
  type ChunkStream,
} from "../src/generic/extractText/streamChunks.ts";

/** A stream that only exposes `getReader()` — no `Symbol.asyncIterator`, the
 *  way WebKit's `ReadableStream` still is. `failAt` makes the nth read reject. */
function readerOnlyStream<T>(
  chunks: readonly T[],
  failAt?: number,
): { stream: ChunkStream<T>; cancelledWith: () => unknown } {
  let index = 0;
  let cancelled: unknown;
  const reader = {
    read: () => {
      if (index === failAt) return Promise.reject(new Error("stream broke"));
      return Promise.resolve(
        index < chunks.length
          ? { done: false as const, value: chunks[index++]! }
          : { done: true as const },
      );
    },
    cancel: (reason?: unknown) => {
      cancelled = reason;
      return Promise.resolve();
    },
    releaseLock: () => {},
  };
  return {
    stream: { getReader: () => reader },
    cancelledWith: () => cancelled,
  };
}

describe("forEachChunk", () => {
  it("reads a stream to the end without async iteration", async () => {
    const { stream } = readerOnlyStream(["a", "b", "c"]);
    const seen: string[] = [];
    await forEachChunk(stream, (chunk) => seen.push(chunk));
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("works on a real ReadableStream that is not async-iterable", async () => {
    const stream = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.close();
      },
    });
    // What WebKit hands back: a stream with a reader and nothing else.
    Object.defineProperty(stream, Symbol.asyncIterator, { value: undefined });
    const seen: number[] = [];
    await forEachChunk<number>(
      { getReader: () => stream.getReader() },
      (chunk) => seen.push(chunk),
    );
    expect(seen).toEqual([1, 2]);
  });

  it("cancels the stream and rethrows when a chunk handler throws", async () => {
    const { stream, cancelledWith } = readerOnlyStream(["a", "b"]);
    const boom = new Error("handler broke");
    const onChunk = vi.fn(() => {
      throw boom;
    });
    await expect(forEachChunk(stream, onChunk)).rejects.toBe(boom);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(cancelledWith()).toBe(boom);
  });

  it("rethrows a stream error", async () => {
    const { stream } = readerOnlyStream(["a", "b"], 1);
    const seen: string[] = [];
    await expect(
      forEachChunk(stream, (chunk) => seen.push(chunk)),
    ).rejects.toThrow("stream broke");
    expect(seen).toEqual(["a"]);
  });
});
