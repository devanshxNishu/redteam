import { LimitError } from "./policy.ts";

/** Bound the wait, and dispose resources that arrive after the caller timed out. */
export function withinDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  label: string,
  onLateValue?: (value: T) => void | Promise<void>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      clearTimeout(timer);
      reject(new LimitError(`${label} deadline reached.`));
    }, timeoutMs);

    void work.then(
      value => {
        if (expired) {
          if (onLateValue) {
            // Cleanup must not hold the deadline open or leak its own rejection.
            void Promise.resolve().then(() => onLateValue(value)).catch(() => undefined);
          }
          return;
        }
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        if (!expired) reject(error);
        // The explicit handler also consumes work that rejects after timeout.
      },
    );
  });
}
