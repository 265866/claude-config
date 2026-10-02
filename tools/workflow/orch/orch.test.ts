import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import {
  NotFoundError,
  UserError,
  openStore,
  parseVerdict,
  type OpenStoreOptions,
  type Store,
} from "./store.ts";

const SCRIPT = join(import.meta.dir, "orch.ts");
const directories: string[] = [];
const handles: Store[] = [];

interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function makeDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "orch-test-"));
  directories.push(directory);
  return directory;
}

function useStore(
  directory: string,
  options?: OpenStoreOptions
): Store {
  const store = openStore(directory, options);
  handles.push(store);
  return store;
}

async function initializedStore(): Promise<{
  readonly directory: string;
  readonly store: Store;
}> {
  const directory = await makeDirectory();
  const store = useStore(directory);
  await store.init();
  return { directory, store };
}

function git({
  args,
  repo,
}: {
  args: readonly string[];
  repo: string;
}): string {
  const result = Bun.spawnSync(["git", "-C", repo, ...args]);
  if (result.exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr.toString()}`
    );
  }
  return result.stdout.toString().trim();
}

async function makeGitStack(directory: string): Promise<{
  readonly repo: string;
  readonly mergedSha: string;
  readonly closedSha: string;
  readonly openSha: string;
}> {
  const repo = join(directory, "repo");
  await mkdir(repo);
  git({ repo, args: ["init", "--initial-branch=main"] });
  git({ repo, args: ["config", "user.name", "Orch Test"] });
  git({ repo, args: ["config", "user.email", "orch@example.com"] });
  await writeFile(join(repo, "main.txt"), "main\n");
  git({ repo, args: ["add", "."] });
  git({ repo, args: ["commit", "-m", "main"] });

  const branches = ["stack/merged", "stack/closed", "stack/open"];
  for (const [index, branch] of branches.entries()) {
    git({ repo, args: ["checkout", "-b", branch] });
    await writeFile(join(repo, `stack-${index}.txt`), `${branch}\n`);
    git({ repo, args: ["add", "."] });
    git({ repo, args: ["commit", "-m", branch] });
  }

  return {
    repo,
    mergedSha: git({ repo, args: ["rev-parse", "stack/merged"] }),
    closedSha: git({ repo, args: ["rev-parse", "stack/closed"] }),
    openSha: git({ repo, args: ["rev-parse", "stack/open"] }),
  };
}

async function withFakeGt<T>({
  directory,
  operation,
  output,
}: {
  directory: string;
  operation: (outputPath: string) => Promise<T>;
  output: string;
}): Promise<T> {
  const bin = join(directory, "bin");
  const outputPath = join(directory, "gt-output.txt");
  await mkdir(bin);
  await writeFile(outputPath, output);
  const fixture = join(bin, "gt-fixture.ts");
  const gt = join(bin, process.platform === "win32" ? "gt.exe" : "gt");
  await writeFile(
    fixture,
    `import { readFileSync, realpathSync } from "node:fs";
if (realpathSync(process.cwd()) !== ${JSON.stringify(realpathSync(join(directory, "repo")))}) {
  console.error("gt ran outside the fixture repo:", process.cwd());
  process.exit(2);
}
switch (process.argv.slice(2).join(" ")) {
  case "--no-interactive log short --stack --reverse":
    process.stdout.write(readFileSync(${JSON.stringify(outputPath)}, "utf8")); break;
  case "--no-interactive info stack/merged":
    process.stdout.write("stack/merged\\nPR #10 (Merged) merged change\\n"); break;
  case "--no-interactive info stack/closed":
    process.stdout.write("stack/closed\\nPR #13 (Closed) closed change\\n"); break;
  case "--no-interactive info stack/open":
    process.stdout.write("stack/open\\nPR #11 (Needs approvals) open change\\n"); break;
  default:
    console.error("unexpected gt arguments:", process.argv.slice(2).join(" "));
    process.exit(2);
}
`,
  );
  // Retain the upstream gt fixture as a native executable on every platform.
  // On macOS, bun build --compile leaves a .bun-build copy in its cwd; keep it inside the removed fixture directory.
  const compiled = Bun.spawnSync([process.execPath, "build", "--compile", fixture, "--outfile", gt], { cwd: bin, timeout: 30_000 });
  if (compiled.exitCode !== 0) throw new Error(compiled.stderr.toString());

  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}${delimiter}${originalPath ?? ""}`;
  try {
    return await operation(outputPath);
  } finally {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  }
}

function runCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env
): RunResult {
  const result = Bun.spawnSync([process.execPath, SCRIPT, ...args], { env });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

afterEach(async () => {
  for (const store of handles.splice(0).reverse()) {
    await store.close();
  }
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("Store", () => {
  it("initializes an idempotent plain-file store and releases its lock", async () => {
    const directory = await makeDirectory();
    const store = useStore(directory);

    expect(await store.init()).toEqual({ store: directory });
    const firstUnits = await readFile(join(directory, "units.tsv"), "utf8");
    const firstLedger = await readFile(
      join(directory, "ledger.tsv"),
      "utf8"
    );

    expect(await store.init()).toEqual({ store: directory });
    expect(await readFile(join(directory, "units.tsv"), "utf8")).toBe(
      firstUnits
    );
    expect(await readFile(join(directory, "ledger.tsv"), "utf8")).toBe(
      firstLedger
    );
    expect((await readdir(directory)).sort()).toEqual([
      ".orch.lock",
      "frontier.json",
      "gates.md",
      "ledger.tsv",
      "preferences.md",
      "units.tsv",
    ]);

    await store.close();
    expect(await readdir(directory)).not.toContain(".orch.lock");
  });

  it("composes unit add, set, get, list, and counts", async () => {
    const { store } = await initializedStore();

    expect(
      await store.units.add({
        id: "u1",
        track: "build",
        brief: "briefs/u1.md",
      })
    ).toMatchObject({ id: "u1", state: "pending" });
    expect(
      await store.units.add({ id: "=SUM(A1)", track: "+build" })
    ).toMatchObject({ id: "'=SUM(A1)", track: "'+build" });

    const updated = await store.units.set({
      id: "u1",
      state: "done",
      branch: "work/u1",
      pr: 184530,
      sha: "abc123",
    });
    expect(updated).toEqual({
      id: "u1",
      track: "build",
      state: "done",
      branch: "work/u1",
      pr: "184530",
      sha: "abc123",
      brief: "briefs/u1.md",
    });
    expect(await store.units.get("u1")).toEqual(updated);
    expect(
      await store.units.list({ state: "done", track: "build" })
    ).toEqual([updated]);
    expect(await store.units.counts()).toEqual({ done: 1, pending: 1 });
    await expect(
      store.units.add({ id: "u1", track: "build" })
    ).rejects.toThrow("unit u1 already exists");
    await expect(
      store.units.set({ id: "missing", state: "done" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("counts arbitrary state names and preserves them across status renders", async () => {
    const { store } = await initializedStore();
    for (const [index, state] of ["constructor", "__proto__", "toString"].entries()) {
      const id = `unit-${index}`;
      await store.units.add({ id, track: "build" });
      await store.units.set({ id, state });
    }
    const expected = Object.fromEntries([["constructor", 1], ["__proto__", 1], ["toString", 1]]);
    expect(await store.units.counts()).toEqual(expected);
    expect((await store.status.render()).summary.unitStates).toEqual(expected);
    expect((await store.status.render()).changed).toBe("no derived changes");
    await store.units.set({ id: "unit-0", state: "done" });
    expect((await store.status.render()).changed).toContain("units constructor 1->0");
  });

  it("records, replaces, checks, and summarizes typed ledger verdicts", async () => {
    const { store } = await initializedStore();

    try {
      await store.ledger.check({ pr: 184530, sha: "abc123" });
      throw new Error("expected ledger check to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      if (error instanceof NotFoundError) {
        expect(error.output).toEqual({
          compact: "NOT-VERIFIED",
          json: {
            pr: "184530",
            sha: "abc123",
            verdict: "NOT-VERIFIED",
          },
        });
      }
    }
    expect(() => parseVerdict("looks-good")).toThrow("verdict must be");

    const recorded = await store.ledger.record({
      pr: 184530,
      sha: "abc123",
      verdict: "unit-test-verified",
      evidence: "reports/verify.md",
      verifier: "sol",
    });
    expect(await store.ledger.check({ pr: 184530, sha: "abc123" })).toEqual(
      recorded
    );
    await expect(
      store.ledger.check({ pr: 184530, sha: "new-head" })
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      store.ledger.check({ pr: 184531, sha: "abc123" })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await store.ledger.summary()).toEqual({
      "unit-test-verified": 1,
    });

    await store.ledger.record({
      pr: 184530,
      sha: "abc123",
      verdict: "live-ui-verified",
      evidence: "reports/live.md",
    });
    expect(await store.ledger.summary()).toEqual({
      "live-ui-verified": 1,
    });
  });

  it("preserves cross-run project evidence and existing unrelated data during init", async () => {
    const { directory, store } = await initializedStore();
    await store.units.add({ id: "u1", track: "migration", brief: "briefs/u1.md" });
    const unit = await store.units.set({
      id: "u1", state: "awaiting-decision", branch: "work/u1", pr: 17, sha: "head-a",
    });
    const receipt = await store.ledger.record({
      pr: 17, sha: "head-a", verdict: "unit-test-verified", evidence: "reports/u1.md",
    });
    const legacy = join(directory, "inbox", "legacy.tsv");
    await mkdir(join(directory, "inbox"));
    await writeFile(legacy, "retained user data\n");
    await store.close();

    const reopened = useStore(directory);
    await reopened.init();
    expect(await reopened.units.get("u1")).toEqual(unit);
    expect(await reopened.ledger.check({ pr: 17, sha: "head-a" })).toEqual(receipt);
    expect((await reopened.status.render()).summary.unitStates).toEqual({ "awaiting-decision": 1 });
    expect(await readFile(legacy, "utf8")).toBe("retained user data\n");
    expect(await readdir(join(directory, "inbox"))).toEqual(["legacy.tsv"]);
  });

  it("replaces a stale lock whose holder pid is dead", async () => {
    const { directory } = await initializedStore();
    const exited = Bun.spawn([process.execPath, "-e", "process.exit(0)"]);
    await exited.exited;
    await writeFile(join(directory, ".orch.lock"), `${JSON.stringify({ pid: exited.pid, token: "stale" })}\n`);

    const stale: string[] = [];
    const recovered = useStore(directory, {
      onStaleLock: (holder) => stale.push(holder),
    });
    expect(
      await recovered.units.add({ id: "u1", track: "build" })
    ).toMatchObject({ id: "u1" });
    expect(stale).toEqual([String(exited.pid)]);
    await recovered.close();
    expect(await readdir(directory)).not.toContain(".orch.lock");
  });

  it("blocks a writer and steals the pid lock only with force", async () => {
    const { directory, store } = await initializedStore();
    await store.close();
    await writeFile(join(directory, ".orch.lock"), `${JSON.stringify({ pid: process.pid, token: "held" })}\n`);

    const blocked = useStore(directory);
    await expect(
      blocked.units.add({ id: "u1", track: "build" })
    ).rejects.toThrow(`store lock held by pid ${process.pid}`);

    const stolen: string[] = [];
    const forced = useStore(directory, {
      force: true,
      onLockStolen: (holder) => stolen.push(holder),
    });
    expect(
      await forced.units.add({ id: "u1", track: "build" })
    ).toMatchObject({ id: "u1" });
    expect(stolen).toEqual([String(process.pid)]);
    await forced.close();
    expect(await readdir(directory)).not.toContain(".orch.lock");
  });

  it("keeps a replacement lock when an older same-process store closes", async () => {
    const { directory, store } = await initializedStore();
    const replacement = useStore(directory, { force: true });
    await replacement.units.add({ id: "replacement", track: "build" });
    await store.close();
    const blocked = useStore(directory);
    await expect(blocked.units.add({ id: "unexpected", track: "build" })).rejects.toThrow("store lock held");
    await replacement.close();
  });

  it("lets only one real process take over a stale store lock", async () => {
    const { directory, store } = await initializedStore();
    await store.close();
    const exited = Bun.spawn([process.execPath, "-e", "process.exit(0)"], { timeout: 5_000 });
    await exited.exited;
    const script = join(directory, "contender.ts");
    await writeFile(script, `import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openStore } from ${JSON.stringify(join(import.meta.dir, "store.ts"))};
const [directory, id] = process.argv.slice(2);
const store = openStore(directory);
await writeFile(join(directory, "ready-" + id), "ready");
while (!existsSync(join(directory, "start"))) await Bun.sleep(5);
try {
  await store.units.add({ id, track: "build" });
  console.log("acquired");
  await Bun.sleep(500);
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("store lock held")) throw error;
  console.log("blocked");
} finally { await store.close(); }
`);
    await writeFile(join(directory, ".orch.lock"), `${JSON.stringify({ pid: exited.pid, token: "stale" })}\n`);
    const children = Array.from({ length: 6 }, (_, index) =>
      Bun.spawn([process.execPath, script, directory, `worker-${index}`], { stdout: "pipe", stderr: "pipe", timeout: 10_000 }));
    const outputs = children.map(async (child) => ({ code: await child.exited,
      stdout: await new Response(child.stdout).text(), stderr: await new Response(child.stderr).text() }));
    try {
      const deadline = Date.now() + 5_000;
      while ((await readdir(directory)).filter((file) => file.startsWith("ready-")).length !== children.length) {
        if (Date.now() >= deadline) throw new Error("store contenders did not become ready");
        await Bun.sleep(5);
      }
      await writeFile(join(directory, "start"), "start");
      const results = await Promise.all(outputs);
      expect(results.every((result) => result.code === 0 && result.stderr === "")).toBe(true);
      expect(results.filter((result) => result.stdout.trim() === "acquired")).toHaveLength(1);
      expect(await useStore(directory).units.list()).toHaveLength(1);
    } finally {
      for (const child of children) child.kill();
      await Promise.all(outputs);
    }
  }, 15_000);

  it("parks gates, stores standing orders, and renders status", async () => {
    const { directory, store } = await initializedStore();
    await store.units.add({ id: "u1", track: "build" });
    expect(
      await store.gates.park({
        id: "release",
        question: "Ship now?",
        options: "ship,wait",
        defaultAnswer: "wait",
      })
    ).toMatchObject({ kind: "open", id: "release" });
    expect(
      await store.standing.add({ line: "Never force push." })
    ).toEqual({ number: 1, line: "Never force push." });

    const first = await store.status.render();
    expect(first.changed).toBe("first render");
    expect(first.summary.openGateIds).toEqual(["release"]);
    expect(await readFile(join(directory, "status.md"), "utf8")).toContain(
      "| release | open | Ship now? |"
    );
    expect((await store.status.render()).changed).toBe("no derived changes");

    expect(
      await store.gates.resolve({ id: "release", answer: "ship" })
    ).toMatchObject({ kind: "resolved", answer: "ship" });
    expect((await store.status.render()).changed).toBe("open gates 1->0");
    expect(await store.gates.list()).toEqual([]);
    expect(await store.standing.show()).toEqual([
      { number: 1, line: "Never force push." },
    ]);
  });

  // Native fixture compilation on Windows needs more than Bun's default 5s.
  it("resolves the ordered Graphite frontier and validates an optional pin", async () => {
    const { directory, store } = await initializedStore();
    const stack = await makeGitStack(directory);
    const output = `◯ main
◯ stack/merged
◯ stack/closed
◉ stack/open (current)
`;

    await withFakeGt({
      directory,
      output,
      operation: async () => {
        expect(await store.frontier.set({ repo: stack.repo })).toEqual({
          generation: 1,
          prs: [
            {
              pr: 10,
              branches: "stack/merged",
              sha: stack.mergedSha,
              state: "MERGED",
            },
            {
              pr: 13,
              branches: "stack/closed",
              sha: stack.closedSha,
              state: "CLOSED",
            },
            {
              pr: 11,
              branches: "stack/open",
              sha: stack.openSha,
              state: "OPEN",
            },
          ],
          lowestUnmerged: 11,
        });
        expect(
          (
            await store.frontier.set({
              repo: stack.repo,
              prs: [10, 13, 11],
            })
          ).generation
        ).toBe(2);
        expect((await store.frontier.show()).generation).toBe(2);
        await expect(
          store.frontier.set({
            repo: stack.repo,
            prs: [10, 11, 12],
          })
        ).rejects.toThrow(
          "frontier pin mismatch: missing from gt: 12; extra in gt: 13"
        );
        await expect(
          store.frontier.set({
            repo: stack.repo,
            prs: [13, 10, 11],
          })
        ).rejects.toThrow(
          "frontier pin mismatch: order differs: expected 13,10,11; gt 10,13,11"
        );
        await expect(
          store.frontier.set({
            repo: stack.repo,
            prs: [10, 10],
          })
        ).rejects.toThrow("--prs must not contain duplicates");
      },
    });
  }, 30_000);

  it("rejects unparseable Graphite output loudly", async () => {
    const { directory, store } = await initializedStore();
    const stack = await makeGitStack(directory);

    await withFakeGt({
      directory,
      output: "◯ main\nthis line is not Graphite output\n",
      operation: async () => {
        await expect(
          store.frontier.set({ repo: stack.repo })
        ).rejects.toThrow(
          'gt log short output has an unparseable line 2: "this line is not Graphite output"'
        );
      },
    });
  }, 30_000);

  it("rejects malformed project TSV, verdict, and frontier data", async () => {
    const { directory, store } = await initializedStore();

    await writeFile(join(directory, "units.tsv"), "wrong\n");
    await expect(store.units.list()).rejects.toThrow(
      "units.tsv has an invalid header"
    );
    await writeFile(
      join(directory, "units.tsv"),
      "id\ttrack\tstate\tbranch\tpr\tsha\tbrief\nshort\trow\n"
    );
    await expect(store.units.list()).rejects.toThrow(
      "units.tsv has a malformed row"
    );

    await writeFile(
      join(directory, "ledger.tsv"),
      "pr\tsha\tverdict\tevidence\tverifier\tts\n1\tsha\tinvalid\treport\tme\tnow\n"
    );
    await expect(store.ledger.summary()).rejects.toThrow(
      "ledger.tsv has invalid verdict invalid"
    );

    await writeFile(join(directory, "frontier.json"), '{"generation":"1"}\n');
    await expect(store.frontier.show()).rejects.toThrow(
      "frontier.json has an invalid shape"
    );

  });

  it("rejects operations after close", async () => {
    const { store } = await initializedStore();
    await store.close();
    await expect(store.units.list()).rejects.toThrow("store is closed");
    await expect(store.status.render()).rejects.toBeInstanceOf(UserError);
  });
});

describe("orch CLI", () => {
  it("rejects retired inbox commands without mutating project or legacy data", async () => {
    const { directory, store } = await initializedStore();
    await store.units.add({ id: "u1", track: "build" });
    await store.close();
    const inbox = join(directory, "inbox");
    await mkdir(inbox, { recursive: true });
    const legacyPointer = join(inbox, "legacy.tsv");
    await writeFile(legacyPointer, "old\tworker\tu1\tdone\treport.md\n");
    const beforeFiles = (await readdir(directory)).sort();
    const projectFiles = beforeFiles.filter((file) => file !== "inbox");
    const beforeContents = await Promise.all(
      projectFiles.map((file) => readFile(join(directory, file), "utf8"))
    );
    const beforePointer = await readFile(legacyPointer, "utf8");

    for (const command of [
      ["push", "worker", "u1", "done"],
      ["drain"],
      ["drain", "--peek"],
      ["count"],
    ]) {
      const result = runCli(["--store", directory, "inbox", ...command]);
      expect(result.code).toBe(1);
      expect(result.stderr).toStartWith("error: ");
      expect(result.stderr).toContain("Usage: orch");
      expect(result.stdout).toBe("");
      expect((await readdir(directory)).sort()).toEqual(beforeFiles);
      expect(await readdir(inbox)).toEqual(["legacy.tsv"]);
      expect(await readFile(legacyPointer, "utf8")).toBe(beforePointer);
      expect(await Promise.all(
        projectFiles.map((file) => readFile(join(directory, file), "utf8"))
      )).toEqual(beforeContents);
    }
  });

  it("prints commander help and rejects invalid parsing with exit 1", async () => {
    const help = runCli(["--help"]);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("Commands:");
    expect(help.stdout).toContain("unit");
    expect(help.stdout).toContain("ledger");
    expect(help.stdout).toContain("project metadata and verification evidence");
    expect(help.stdout).not.toContain("inbox");

    const frontierHelp = runCli(["frontier", "set", "--help"]);
    expect(frontierHelp.code).toBe(0);
    expect(frontierHelp.stdout).toContain("--repo <dir>");
    expect(frontierHelp.stdout).toContain("--prs <n,...>");

    const directory = await makeDirectory();
    const invalid = runCli(["--store", directory, "unit", "add", "u1"]);
    expect(invalid.code).toBe(1);
    expect(invalid.stderr).toContain("required option '--track <track>'");
  });

  it("accepts ORCH_STORE and emits complete JSON", async () => {
    const directory = await makeDirectory();
    const env = { ...process.env, ORCH_STORE: directory };
    expect(runCli(["init"], env).code).toBe(0);

    const added = runCli(
      ["unit", "add", "u1", "--track", "build", "--json"],
      env
    );
    expect(added.code).toBe(0);
    expect(JSON.parse(added.stdout)).toEqual({
      id: "u1",
      track: "build",
      state: "pending",
      branch: "",
      pr: "",
      sha: "",
      brief: "",
    });
  });

  it("maps user and not-found outcomes to the preserved exit codes", async () => {
    const directory = await makeDirectory();
    expect(runCli(["--store", directory, "init"]).code).toBe(0);

    const missingRepo = runCli([
      "--store",
      directory,
      "frontier",
      "set",
    ]);
    expect(missingRepo.code).toBe(1);
    expect(missingRepo.stderr).toContain(
      "set --repo <dir> or ORCH_REPO"
    );

    const userError = runCli([
      "--store",
      directory,
      "unit",
      "add",
      "",
      "--track",
      "build",
    ]);
    expect(userError.code).toBe(1);
    expect(userError.stderr).toContain("unit id must not be empty");

    const missingUnit = runCli([
      "--store",
      directory,
      "unit",
      "get",
      "missing",
    ]);
    expect(missingUnit.code).toBe(2);
    expect(missingUnit.stderr).toContain("unit missing not found");

    const missingLedger = runCli([
      "--store",
      directory,
      "--json",
      "ledger",
      "check",
      "184530",
      "abc123",
    ]);
    expect(missingLedger.code).toBe(2);
    expect(JSON.parse(missingLedger.stdout)).toEqual({
      pr: "184530",
      sha: "abc123",
      verdict: "NOT-VERIFIED",
    });
    expect(missingLedger.stderr).toBe("");
  });
});
