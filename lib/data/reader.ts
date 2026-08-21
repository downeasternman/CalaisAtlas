import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, unknown>();

export async function readProcessedJson<T>(filename: string): Promise<T> {
  const key = filename;
  if (cache.has(key)) {
    return cache.get(key) as T;
  }
  const filePath = path.join(process.cwd(), "data", "processed", filename);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    (error as NodeJS.ErrnoException).code =
      (err as NodeJS.ErrnoException)?.code ?? "ENOENT";
    throw error;
  }
  const data = JSON.parse(raw) as T;
  cache.set(key, data);
  return data;
}

export function clearProcessedCache() {
  cache.clear();
}
