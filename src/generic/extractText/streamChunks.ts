// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Reading a `ReadableStream` chunk by chunk, without `for await`. WebKit does
// not implement `ReadableStream[Symbol.asyncIterator]`, so async iteration over
// a stream throws `undefined is not a function` on every Safari / iOS browser;
// a reader loop is the portable spelling of the same loop.

/** The slice of `ReadableStreamDefaultReader` this needs. */
export type ChunkReader<T> = {
  read(): Promise<{ done: false; value: T } | { done: true; value?: unknown }>;
  cancel(reason?: unknown): Promise<void>;
  releaseLock(): void;
};

/** The slice of `ReadableStream` this needs — anything that hands out a reader.
 *  A DOM `ReadableStream` doesn't match structurally (its `getReader` is
 *  overloaded with a BYOB variant), so hand one over as
 *  `{ getReader: () => stream.getReader() }`. */
export type ChunkStream<T> = {
  getReader(): ChunkReader<T>;
};

/** Pull every chunk out of `stream`, in order, passing each to `onChunk`.
 *  Resolves when the stream closes. If `onChunk` or the stream itself throws,
 *  the stream is cancelled and the error rethrown; the reader is always
 *  released. */
export async function forEachChunk<T>(
  stream: ChunkStream<T>,
  onChunk: (chunk: T) => void,
): Promise<void> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) return;
      onChunk(result.value);
    }
  } catch (err) {
    // Let the producer stop early; it has no other way to hear about this.
    await reader.cancel(err).catch(() => undefined);
    throw err;
  } finally {
    reader.releaseLock();
  }
}
