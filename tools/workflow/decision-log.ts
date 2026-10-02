#!/usr/bin/env bun
import { appendFile, mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { withFileGuard } from "./file-guard.ts";

const HEADER = "ts\tphase\tdecision\twhy\tevidence\tresult\n";

export function cleanCell(value: string): string {
  const cell = value.replace(/[\t\r\n]/g, " ");
  return /^[=+@-]/.test(cell) ? `'${cell}` : cell;
}

export async function appendDecision(relativeOrAbsolute: string, cells: readonly string[]): Promise<void> {
  if (cells.length !== 5) throw new Error("five cells are required: phase, decision, why, evidence, result");
  // Bun on Windows rejects a recursive mkdir of "." with EEXIST, so create the resolved parent instead.
  const file = resolve(relativeOrAbsolute);
  await mkdir(dirname(file), { recursive: true });
  await withFileGuard(`${file}.lock`, async () => {
    const handle = await open(file, "a+");
    try {
      const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const prefix = (await handle.stat()).size === 0 ? HEADER : "";
      await appendFile(file, `${prefix}${timestamp}\t${cells.map(cleanCell).join("\t")}\n`);
    } finally {
      await handle.close();
    }
  });
}

export async function main(args: readonly string[]): Promise<number> {
  const file = args[0];
  if (args.length !== 6 || file === undefined || file.trim() === "") {
    console.error("Usage: bun decision-log.ts <log.tsv> <phase> <decision> <why> <evidence> <result>");
    return 2;
  }
  try {
    await appendDecision(file, args.slice(1));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
