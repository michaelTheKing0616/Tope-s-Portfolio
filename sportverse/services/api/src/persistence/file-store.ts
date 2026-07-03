import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export class FileStore<T> {
  constructor(private readonly filePath: string) {}

  read(): T {
    try {
      if (!existsSync(this.filePath)) return this.defaultValue();
      return JSON.parse(readFileSync(this.filePath, "utf8")) as T;
    } catch {
      return this.defaultValue();
    }
  }

  write(data: T): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  update(mutator: (current: T) => T): T {
    const next = mutator(this.read());
    this.write(next);
    return next;
  }

  private defaultValue(): T {
    return {} as T;
  }
}

export function resolveDataPath(...parts: string[]): string {
  return resolve(process.cwd(), "data", ...parts);
}
