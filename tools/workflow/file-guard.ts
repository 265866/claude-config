import { mkdir, rmdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function withFileGuard<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + 5_000;
  for (;;) {
    try {
      await mkdir(path);
      break;
    } catch (error) {
      if (!(error instanceof Error && "code" in error)) throw error;
      // Windows can report EPERM while a removed directory is pending deletion.
      if (error.code !== "EEXIST" && !(process.platform === "win32" && error.code === "EPERM")) throw error;
      if (Date.now() >= deadline) {
        if (error.code === "EPERM") throw error;
        throw new Error(`file guard busy at ${path}; if a writer was interrupted, confirm no writers remain before removing that guard`);
      }
      await delay(5);
    }
  }
  try {
    return await operation();
  } finally {
    await rmdir(path);
  }
}
