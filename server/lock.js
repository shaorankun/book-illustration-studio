const tails = new Map();

export function withLock(key, fn) {
  const prev = tails.get(key) || Promise.resolve();
  const run = prev.then(fn, fn);
  tails.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}
