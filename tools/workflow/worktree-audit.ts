#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { lstat, open, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface Worktree {
  readonly path: string;
  readonly head: string;
  readonly branch: string;
  readonly locked: boolean;
}

export interface AuditRow extends Worktree {
  readonly bytes: number | null;
  readonly ageDays: number | null;
  readonly merged: boolean;
  readonly dirty: "clean" | "tracked" | "untracked" | "unknown";
  readonly remote: "pushed" | "different" | "no-remote" | "detached";
  readonly lastSession: string | null;
  readonly bucket: "hold-wip" | "hold-lock" | "verify-recent-session" | "review-merged" | "review";
}

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000,
  }).trim();
}

function optionalGit(repo: string, args: readonly string[]): string | null {
  try { return git(repo, args); } catch { return null; }
}

export function parseWorktrees(contents: string): readonly Worktree[] {
  const worktrees: Worktree[] = [];
  for (const block of contents.split(/\r?\n\r?\n/)) {
    const fields = block.split(/\r?\n/);
    const path = fields.find((line) => line.startsWith("worktree "))?.slice(9);
    if (path === undefined) continue;
    worktrees.push({
      path,
      head: fields.find((line) => line.startsWith("HEAD "))?.slice(5) ?? "",
      branch: fields.find((line) => line.startsWith("branch refs/heads/"))?.slice(18) ?? "",
      locked: fields.some((line) => line === "locked" || line.startsWith("locked ")),
    });
  }
  return worktrees;
}

async function treeBytes(path: string): Promise<number | null> {
  let bytes = 0;
  try {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        const subtotal = await treeBytes(child);
        if (subtotal === null) return null;
        bytes += subtotal;
      } else if (entry.isFile()) {
        bytes += (await stat(child)).size;
      }
    }
    return bytes;
  } catch { return null; }
}

export function comparablePath(path: string, platform: NodeJS.Platform = process.platform): string {
  const value = resolve(path).replace(/\\/g, "/").replace(/\/$/, "");
  // NTFS and default APFS volumes are case-insensitive; folding case on macOS errs toward "in use".
  return platform === "win32" || platform === "darwin" ? value.toLowerCase() : value;
}

export function projectDirectoryName(path: string): string {
  const slug = path.replace(/[^a-zA-Z0-9]/g, "-");
  if (slug.length <= 200) return slug;
  // Claude Code 2.1.285 hashes the original UTF-16 spelling with signed 32-bit arithmetic.
  let hash = 0;
  for (let index = 0; index < path.length; index++) hash = ((hash << 5) - hash + path.charCodeAt(index)) | 0;
  return `${slug.slice(0, 200)}-${Math.abs(hash).toString(36)}`;
}

export function resolveAuditProfile(profile?: string): string {
  return profile ?? process.env.CLAUDE_CONFIG_DIR ?? resolve(import.meta.dir, "../..");
}

async function recentSessions(profile: string, paths: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const sessions = new Map<string, string>();
  // Custom project names do not provide a verifiable per-worktree mapping.
  if (process.env.CLAUDE_CONFIG_DIR && process.env.CLAUDE_CODE_PROJECT_DIR_NAME) return sessions;
  const projects = join(profile, "projects");
  const directories = new Map<string, Set<string>>();
  for (const path of paths) {
    for (const spelling of new Set([path, resolve(path)])) {
      const name = projectDirectoryName(spelling);
      const targets = directories.get(name) ?? new Set<string>();
      targets.add(comparablePath(path));
      directories.set(name, targets);
    }
  }
  for (const [name, targets] of directories) {
    const project = join(projects, name);
    const metadata = await lstat(project).catch(() => null);
    if (!metadata?.isDirectory()) continue;
    let files;
    try { files = await readdir(project, { withFileTypes: true }); } catch { continue; }
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;
      const transcript = join(project, file.name);
      const handle = await open(transcript, "r").catch(() => null);
      if (handle === null) continue;
      try {
        // JSONL is internal. Inspect only optional cwd metadata near the beginning,
        // retain no messages, and leave a session unknown when its schema differs.
        const buffer = Buffer.alloc(262_144);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        for (const line of buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/)) {
          let record: unknown;
          try { record = JSON.parse(line); } catch { continue; }
          if (record === null || typeof record !== "object" || !("cwd" in record) || typeof record.cwd !== "string") continue;
          const cwd = comparablePath(record.cwd);
          if (!targets.has(cwd)) break;
          const date = (await handle.stat()).mtime.toISOString();
          if ((sessions.get(cwd) ?? "") < date) sessions.set(cwd, date);
          break;
        }
      } catch {
        // A transcript may disappear or become unreadable during the audit.
      } finally { await handle.close(); }
    }
  }
  return sessions;
}

export async function auditWorktrees(repo: string, options: {
  readonly profile?: string;
  readonly base?: string;
  readonly includeSize?: boolean;
} = {}): Promise<readonly AuditRow[]> {
  const worktrees = parseWorktrees(git(repo, ["worktree", "list", "--porcelain"]));
  const profile = resolveAuditProfile(options.profile);
  const sessions = await recentSessions(profile, worktrees.slice(1).map((worktree) => worktree.path));
  const base = options.base ?? "origin/main";
  const rows: AuditRow[] = [];
  for (const worktree of worktrees.slice(1)) {
    const porcelain = optionalGit(worktree.path, ["status", "--porcelain"]);
    const dirty = porcelain === null ? "unknown" : porcelain === "" ? "clean" :
      porcelain.split(/\r?\n/).some((line) => !line.startsWith("??")) ? "tracked" : "untracked";
    const timestamp = Number(optionalGit(worktree.path, ["log", "-1", "--format=%ct", "HEAD"]) ?? 0);
    const remoteHead = worktree.branch === "" ? null : optionalGit(repo, ["rev-parse", "--verify", `refs/remotes/origin/${worktree.branch}`]);
    const lastSession = sessions.get(comparablePath(worktree.path)) ?? null;
    const recent = lastSession !== null && Date.now() - Date.parse(lastSession) <= 4 * 86_400_000;
    const merged = optionalGit(repo, ["merge-base", "--is-ancestor", worktree.head, base]) !== null;
    rows.push({
      ...worktree,
      bytes: options.includeSize ? await treeBytes(worktree.path) : null,
      ageDays: timestamp > 0 ? Math.floor((Date.now() / 1_000 - timestamp) / 86_400) : null,
      merged, dirty,
      remote: worktree.branch === "" ? "detached" : remoteHead === null ? "no-remote" : remoteHead === worktree.head ? "pushed" : "different",
      lastSession,
      bucket: worktree.locked ? "hold-lock" : dirty === "tracked" || dirty === "unknown" ? "hold-wip" :
        recent ? "verify-recent-session" : merged ? "review-merged" : "review",
    });
  }
  return rows.sort((left, right) => (right.bytes ?? 0) - (left.bytes ?? 0));
}

export async function main(args: readonly string[]): Promise<number> {
  if (args.includes("--help")) {
    console.log("Usage: bun worktree-audit.ts [repo] [--base <ref>] [--size] [--json]\nRead-only snapshot. No fetch, remote API, or deletion. Squash merges require separate PR review.");
    return 0;
  }
  let repo: string | undefined;
  let base: string | undefined;
  let includeSize = false;
  let json = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--base") {
      base = args[++index];
      if (base === undefined || base.startsWith("--")) { console.error("--base requires a ref"); return 2; }
    } else if (argument === "--size") includeSize = true;
    else if (argument === "--json") json = true;
    else if (argument === undefined || argument.startsWith("--") || repo !== undefined) {
      console.error(`unexpected argument ${argument ?? ""}`); return 2;
    } else repo = argument;
  }
  try {
    const root = repo ?? git(process.cwd(), ["rev-parse", "--show-toplevel"]);
    const rows = await auditWorktrees(root, { base, includeSize });
    if (json) console.log(JSON.stringify(rows, null, 2));
    else {
      console.log("BYTES\tAGE_DAYS\tMERGED\tDIRTY\tREMOTE\tLAST_SESSION\tBUCKET\tWORKTREE");
      for (const row of rows) console.log([row.bytes ?? "-", row.ageDays ?? "-", row.merged, row.dirty, row.remote,
        row.lastSession ?? "unknown", row.bucket, row.path].join("\t"));
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
