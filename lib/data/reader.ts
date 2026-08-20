import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, unknown>();

export async function readProcessedJson<T>(filename: string): Promise<T> {
  const key = filename;
  if (cache.has(key)) {
    return cache.get(key) as T;
  }
  const filePath = path.join(process.cwd(), "data", "processed", filename);
  const raw = await readFile(filePath, "utf8");
  const data = JSON.parse(raw) as T;
  cache.set(key, data);
  return data;
}

export function clearProcessedCache() {
  cache.clear();
}
