import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validatePlan } from "./check-plan.ts";
import { appendDecision } from "./decision-log.ts";
import { auditWorktrees, parseWorktrees, projectDirectoryName, resolveAuditProfile } from "./worktree-audit.ts";

const directories: string[] = [];
async function directory(): Promise<string> {
  // Git and Claude Code record physical paths; macOS reaches its temp directory through /var -> /private/var.
  const path = await realpath(await mkdtemp(join(tmpdir(), "workflow-test-")));
  directories.push(path);
  return path;
}

afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});

const plan = `# Add search

## Goal
Search the existing records and show matching names.

## Phases
| Phase | Owner | Depends on | Check | Status |
| --- | --- | --- | --- | --- |
| P1 | engineer | none | bun test search | done |
| P2 | engineer | P1 | inspect the search screen | pending |

## Verification
- [ ] Run the search tests and inspect an empty result.

## Decisions
No unresolved decisions.

## Completion
- [ ] Search works and the reviewer has checked the change.
`;

describe("program plan validation", () => {
  it("accepts the native phases contract and escaped command pipes", () => {
    expect(validatePlan(plan)).toEqual([]);
    expect(validatePlan(plan.replace("bun test search", "git status \\| Out-String"))).toEqual([]);
  });

  it("reports missing sections, empty phases, and unknown dependencies", () => {
    expect(validatePlan("").map((problem) => problem.message)).toContain("a nonempty H1 title is required");
    expect(validatePlan(plan.replace("| P2 | engineer | P1 |", "| P2 | engineer | absent |"))
      .map((problem) => problem.message)).toContain("dependency absent is not an earlier phase");
    expect(validatePlan(plan.replace(/\| P[12] .*\n/g, ""))
      .map((problem) => problem.message)).toContain("Phases needs at least one work phase");
  });

  it("rejects duplicate phases, invalid statuses, and malformed fences", () => {
    const invalid = plan.replace("| P2 |", "| P1 |").replace("| pending |", "| maybe |");
    expect(validatePlan(invalid).map((problem) => problem.message)).toContain("duplicate phase P1");
    expect(validatePlan(invalid).map((problem) => problem.message)).toContain("Status must be pending, running, blocked, or done");
    expect(validatePlan(`${plan}\n\`\`\`ts\n## Goal\n`).map((problem) => problem.message)).toContain("unclosed code fence");
  });

  it("rejects an empty fenced goal and respects longer Markdown fence lengths", () => {
    const empty = plan.replace("Search the existing records and show matching names.", "```text\n```");
    expect(validatePlan(empty).map((problem) => problem.message)).toContain("Goal needs substantive content");
    const longer = plan.replace("Search the existing records and show matching names.",
      "````text\n```\n## Hidden heading\nThis is goal content.\n````");
    expect(validatePlan(longer)).toEqual([]);
  });

  it("rejects phase rows separated from the required Markdown table", () => {
    const separated = plan.replace("| P2 |", "Explain the dependency here.\n\n| P2 |");
    expect(validatePlan(separated).map((problem) => problem.message)).toContain("Phases must use one contiguous Markdown table");
    const fenced = plan.replace("| P2 |", "```\n```\n| P2 |");
    expect(validatePlan(fenced).map((problem) => problem.message)).toContain("Phases must use one contiguous Markdown table");
  });

  it("runs the real checker on a path containing spaces and returns failure for a bad plan", async () => {
    const root = await directory();
    const file = join(root, "search plan.md");
    await writeFile(file, plan);
    const command = [process.execPath, join(import.meta.dir, "check-plan.ts"), file];
    expect(Bun.spawnSync(command, { timeout: 10_000 }).exitCode).toBe(0);
    await writeFile(file, "# Unfinished\n");
    expect(Bun.spawnSync(command, { timeout: 10_000 }).exitCode).toBe(1);
  });
});

describe("decision logs", () => {
  it("creates a log, appends without truncation, and neutralizes spreadsheet formulas", async () => {
    const file = join(await directory(), "nested folder", "decisions.tsv");
    await appendDecision(file, ["build", "keep API", "=SUM(A1)", "line\nwith\ttabs", "passed"]);
    await appendDecision(file, ["review", "accept", "+formula", "@evidence", "-result"]);
    const lines = (await readFile(file, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("ts\tphase\tdecision\twhy\tevidence\tresult");
    expect(lines[1]?.split("\t").slice(1)).toEqual(["build", "keep API", "'=SUM(A1)", "line with tabs", "passed"]);
    expect(lines[2]?.split("\t").slice(3)).toEqual(["'+formula", "'@evidence", "'-result"]);
  });

  it("repairs an empty log and rejects an incomplete row", async () => {
    const file = join(await directory(), "empty.tsv");
    await writeFile(file, "");
    await expect(appendDecision(file, [])).rejects.toThrow("five cells are required");
    await appendDecision(file, ["a", "b", "c", "d", "e"]);
    expect((await readFile(file, "utf8")).split("\n")[0]).toBe("ts\tphase\tdecision\twhy\tevidence\tresult");
  });

  it("writes a bare relative log path in the working directory", async () => {
    const cwd = await directory();
    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, "decision-log.ts"), "decisions.tsv", "start", "a", "b", "c", "d"],
      { cwd, timeout: 10_000 });
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    expect((await readFile(join(cwd, "decisions.tsv"), "utf8")).split("\n")[0]).toBe("ts\tphase\tdecision\twhy\tevidence\tresult");
  });

  it("serializes concurrent writers and emits exactly one header", async () => {
    const file = join(await directory(), "shared.tsv");
    await writeFile(file, "");
    await Promise.all(Array.from({ length: 32 }, (_, index) =>
      appendDecision(file, ["build", `decision-${index}`, "reason", "evidence", "pass"])));
    const lines = (await readFile(file, "utf8")).trim().split("\n");
    expect(lines.filter((line) => line === "ts\tphase\tdecision\twhy\tevidence\tresult")).toHaveLength(1);
    expect(lines).toHaveLength(33);
    expect(new Set(lines.slice(1).map((line) => line.split("\t")[2])).size).toBe(32);
  });
});

function git(repo: string, args: readonly string[]): string {
  const result = Bun.spawnSync(["git", "-C", repo, ...args], { timeout: 15_000 });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

async function worktreeFixture(
  name: string | ((root: string) => string) = "scoped worktree",
): Promise<{ repo: string; worktree: string; profile: string }> {
  const root = await directory();
  const repo = join(root, "main repo");
  const worktree = join(root, typeof name === "string" ? name : name(root));
  await mkdir(repo);
  git(repo, ["init", "--initial-branch=main"]);
  git(repo, ["config", "user.name", "Workflow Test"]);
  git(repo, ["config", "user.email", "workflow@example.invalid"]);
  await writeFile(join(repo, "tracked.txt"), "base\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "base"]);
  git(repo, ["worktree", "add", "-b", "feature", worktree]);
  return { repo, worktree, profile: join(root, "profile") };
}

describe("native worktree audit", () => {
  it("preserves spaces and lock reasons in Git's porcelain format", () => {
    expect(parseWorktrees("worktree C:/repo with spaces\nHEAD abc\nbranch refs/heads/work/test\nlocked active job\n\n"))
      .toEqual([{ path: "C:/repo with spaces", head: "abc", branch: "work/test", locked: true }]);
    expect(parseWorktrees("")).toEqual([]);
  });

  it("matches Claude Code 2.1.285 project encoding at the length and Unicode boundaries", () => {
    expect(projectDirectoryName("C:/Work/a_b.é中")).toBe("C--Work-a-b---");
    expect(projectDirectoryName("a".repeat(200))).toBe("a".repeat(200));
    expect(projectDirectoryName("a".repeat(201))).toBe(`${"a".repeat(200)}-rkvsv5`);
    expect(projectDirectoryName(`C:/${"é".repeat(198)}`)).toBe(`C${"-".repeat(199)}-1hxmag`);
    expect(projectDirectoryName(`C:\\${"é".repeat(198)}`)).toBe(`C${"-".repeat(199)}-mift1`);
    expect(projectDirectoryName(`${"x".repeat(199)}😀`)).toBe(`${"x".repeat(199)}--strnl1`);
    expect(projectDirectoryName("a_b")).toBe(projectDirectoryName("a.b"));
    expect(projectDirectoryName("a_b")).toBe(projectDirectoryName("a-b"));
    expect(projectDirectoryName("Case")).not.toBe(projectDirectoryName("case"));
  });

  it("resolves the helper-local profile with explicit and environment precedence without opening sessions", () => {
    const previous = process.env.CLAUDE_CONFIG_DIR;
    try {
      delete process.env.CLAUDE_CONFIG_DIR;
      expect(resolveAuditProfile()).toBe(resolve(import.meta.dir, "../.."));
      process.env.CLAUDE_CONFIG_DIR = "environment-profile";
      expect(resolveAuditProfile()).toBe("environment-profile");
      expect(resolveAuditProfile("explicit-profile")).toBe("explicit-profile");
      expect(resolveAuditProfile("")).toBe("");
      process.env.CLAUDE_CONFIG_DIR = "";
      expect(resolveAuditProfile()).toBe("");
    } finally {
      if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = previous;
    }
  });

  it("ignores unrelated project transcripts even when their cwd claims an audited worktree", async () => {
    const { repo, worktree, profile } = await worktreeFixture();
    const unrelated = join(profile, "projects", "unrelated-project");
    await mkdir(unrelated, { recursive: true });
    await writeFile(join(unrelated, "session.jsonl"), `${JSON.stringify({ cwd: worktree })}\n`);
    expect((await auditWorktrees(repo, { base: "main", profile }))[0])
      .toMatchObject({ lastSession: null, bucket: "review-merged" });
    const matching = join(profile, "projects", projectDirectoryName(worktree));
    await mkdir(matching, { recursive: true });
    await writeFile(join(matching, "session.jsonl"), `${JSON.stringify({ cwd: worktree })}\n`);
    expect((await auditWorktrees(repo, { base: "main", profile }))[0])
      .toMatchObject({ bucket: "verify-recent-session" });
  });

  it("checks cwd within an exact directory when project encodings collide", async () => {
    const { repo, worktree, profile } = await worktreeFixture("scope_a");
    const other = join(resolve(worktree, ".."), "scope.a");
    git(repo, ["worktree", "add", "-b", "other", other]);
    const project = join(profile, "projects", worktree.replace(/[^a-zA-Z0-9]/g, "-"));
    expect(projectDirectoryName(other)).toBe(projectDirectoryName(worktree));
    await mkdir(project, { recursive: true });
    await writeFile(join(project, "other.jsonl"), `${JSON.stringify({ cwd: other })}\n`);
    const rows = await auditWorktrees(repo, { base: "main", profile });
    expect(rows.find((row) => row.branch === "feature"))
      .toMatchObject({ lastSession: null, bucket: "review-merged" });
    expect(rows.find((row) => row.branch === "other"))
      .toMatchObject({ bucket: "verify-recent-session" });
    await writeFile(join(project, "wrong-cwd.jsonl"), `${JSON.stringify({ cwd: repo })}\n`);
    expect((await auditWorktrees(repo, { base: "main", profile })).find((row) => row.branch === "feature"))
      .toMatchObject({ lastSession: null });
  });

  it("selects exact long project directories for both native and Git path spellings", async () => {
    // Claude Code hashes project paths past 200 characters; Git for Windows rejects a worktree whose <path>/.git exceeds 220.
    const parent = "nested".repeat(8);
    const { repo, worktree, profile } = await worktreeFixture((root) =>
      join(parent, "n".repeat(Math.max(1, 205 - join(root, parent).length - 1))));
    const listed = parseWorktrees(git(repo, ["worktree", "list", "--porcelain"])).find((row) => row.branch === "feature");
    if (listed === undefined) throw new Error("test worktree missing from Git");
    expect(worktree.length).toBeGreaterThan(200);
    const names = new Set([projectDirectoryName(worktree), projectDirectoryName(listed.path)]);
    expect(names.size).toBe(process.platform === "win32" ? 2 : 1);
    const unsupported = join(profile, "projects", `${worktree.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 200)}-unsupported`);
    await mkdir(unsupported, { recursive: true });
    await writeFile(join(unsupported, "session.jsonl"), `${JSON.stringify({ cwd: worktree })}\n`);
    expect((await auditWorktrees(repo, { base: "main", profile }))[0]).toMatchObject({ lastSession: null });
    for (const name of names) {
      const project = join(profile, "projects", name);
      await mkdir(project, { recursive: true });
      await writeFile(join(project, "session.jsonl"), `${JSON.stringify({ cwd: worktree })}\n`);
      expect((await auditWorktrees(repo, { base: "main", profile }))[0])
        .toMatchObject({ bucket: "verify-recent-session" });
      await rm(project, { recursive: true });
    }
    expect((await auditWorktrees(repo, { base: "main", profile }))[0]).toMatchObject({ lastSession: null });
  });

  it("leaves active custom project mappings unknown and ignores an override without a config directory", async () => {
    const { repo, worktree, profile } = await worktreeFixture();
    for (const name of [worktree.replace(/[^a-zA-Z0-9]/g, "-"), "custom-project"]) {
      const project = join(profile, "projects", name);
      await mkdir(project, { recursive: true });
      await writeFile(join(project, "session.jsonl"), `${JSON.stringify({ cwd: worktree })}\n`);
    }
    const previousConfig = process.env.CLAUDE_CONFIG_DIR;
    const previousName = process.env.CLAUDE_CODE_PROJECT_DIR_NAME;
    try {
      process.env.CLAUDE_CONFIG_DIR = profile;
      process.env.CLAUDE_CODE_PROJECT_DIR_NAME = "custom-project";
      expect((await auditWorktrees(repo, { base: "main", profile }))[0]).toMatchObject({ lastSession: null });
      delete process.env.CLAUDE_CONFIG_DIR;
      expect((await auditWorktrees(repo, { base: "main", profile }))[0])
        .toMatchObject({ bucket: "verify-recent-session" });
    } finally {
      if (previousConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = previousConfig;
      if (previousName === undefined) delete process.env.CLAUDE_CODE_PROJECT_DIR_NAME;
      else process.env.CLAUDE_CODE_PROJECT_DIR_NAME = previousName;
    }
  });

  it("audits real isolated worktrees, keeps tracked edits, and reads optional profile-local session metadata", async () => {
    const root = await directory();
    const repo = join(root, "main repo");
    const feature = join(root, "feature worktree");
    const merged = join(root, "merged worktree");
    const profile = join(root, "profile");
    await mkdir(repo);
    git(repo, ["init", "--initial-branch=main"]);
    git(repo, ["config", "user.name", "Workflow Test"]);
    git(repo, ["config", "user.email", "workflow@example.invalid"]);
    await writeFile(join(repo, "tracked.txt"), "base\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "base"]);
    git(repo, ["worktree", "add", "-b", "feature", feature]);
    git(repo, ["worktree", "add", "--detach", merged, "main"]);
    await writeFile(join(feature, "tracked.txt"), "edited\n");

    const rows = await auditWorktrees(repo, { base: "main", profile });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.branch === "feature")).toMatchObject({ dirty: "tracked", bucket: "hold-wip", bytes: null });
    expect(rows.find((row) => row.branch === "")).toMatchObject({ dirty: "clean", merged: true, bucket: "review-merged", lastSession: null });

    const project = join(profile, "projects", merged.replace(/[^a-zA-Z0-9]/g, "-"));
    await mkdir(project, { recursive: true });
    await writeFile(join(project, "session.jsonl"),
      `${JSON.stringify({ type: "metadata", unknown: true })}\n${JSON.stringify({ cwd: merged })}\npartial write`);
    expect((await auditWorktrees(repo, { base: "main", profile })).find((row) => row.branch === ""))
      .toMatchObject({ bucket: "verify-recent-session" });
    git(repo, ["worktree", "lock", "--reason", "active job", merged]);
    expect((await auditWorktrees(repo, { base: "main", profile, includeSize: true })).find((row) => row.branch === ""))
      .toMatchObject({ bucket: "hold-lock", locked: true });
    expect(git(feature, ["status", "--porcelain"])).toContain("tracked.txt");
  });
});
