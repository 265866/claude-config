import { describe, expect, it } from "bun:test";
import { type CliRuntime, main, parseArgs } from "./cli.ts";
import { fakeReader, passingCheck } from "./fakes.test-helper.ts";
import { renderJson, renderPretty } from "./render.ts";
import type { GitHubReader, WatcherVerdict } from "./types.ts";
import { parsePrNumber } from "./types.ts";

const silentIo = { stdout: () => {}, stderr: () => {} };

function testRuntime(reader: GitHubReader): {
  readonly runtime: CliRuntime;
  readonly stdout: string[];
  readonly stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    runtime: {
      reader,
      clock: {
        now: () => 0,
        observedAt: () => "2026-07-26T00:00:00.000Z",
        async sleep() {
          throw new Error("test unexpectedly slept");
        },
      },
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    },
  };
}

describe("parseArgs", () => {
  it("uses the specified defaults", () => {
    expect(parseArgs([], silentIo)).toMatchObject({
      owner: null,
      repo: null,
      pr: null,
      mode: "single",
      stackPrs: [],
      statusOnly: false,
      pretty: false,
      polling: {
        interval: 60,
        sweepInterval: 300,
        timeout: 0,
        maxQueryErrors: 5,
        allowDraft: false,
      },
    });
  });

  it("parses a frozen queued stack bottom-to-top", () => {
    const parsed = parseArgs(
      [
        "--queued-stack",
        "--stack-prs",
        "#10, 11,#12",
        "--interval",
        "2.5",
        "--sweep-interval",
        "30",
        "--timeout",
        "0",
        "--max-query-errors",
        "3",
        "--allow-draft",
        "--pretty",
      ],
      silentIo
    );
    expect(parsed.mode).toBe("queued-stack");
    expect(parsed.stackPrs.map(Number)).toEqual([10, 11, 12]);
    expect(parsed.polling).toEqual({
      interval: 2.5,
      sweepInterval: 30,
      timeout: 0,
      maxQueryErrors: 3,
      allowDraft: true,
    });
    expect(parsed.pretty).toBe(true);
  });

  it("rejects every invalid mode and numeric shape as usage", async () => {
    const invalid = [
      ["--unknown"],
      ["--interval", "0"],
      ["--sweep-interval", "-1"],
      ["--timeout", "-1"],
      ["--max-query-errors", "1.5"],
      ["--stack", "--queued-stack"],
      ["--stack-prs", "1,2"],
      ["--queued-stack", "--stack-prs", "1,1"],
    ];
    for (const argv of invalid) {
      const harness = testRuntime(fakeReader());
      expect(await main(argv, harness.runtime)).toBe(64);
      expect(harness.stdout).toEqual([]);
      expect(harness.stderr.join("")).toContain("error:");
    }
  });
});

describe("rendering", () => {
  const context = {
    owner: "owner",
    repo: "repo",
    number: parsePrNumber(1),
  };
  const status = {
    schemaVersion: 1,
    sequence: 1,
    observedAt: "2026-07-26T00:00:00.000Z",
    mode: "single",
    kind: "STATUS",
    terminal: true,
    exitCode: 0,
    reason: "status-only",
    rows: [
      {
        kind: "merged",
        context,
        facts: {
          context,
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          reviewDecision: "APPROVED",
          headRefOid: "head",
          headRefName: "feature",
          baseRefName: "main",
          state: "MERGED",
          mergedAt: "now",
          isDraft: false,
        },
      },
    ],
  } satisfies WatcherVerdict;

  it("emits compact valid JSON by default", () => {
    const rendered = renderJson(status);
    expect(rendered.endsWith("\n")).toBe(true);
    expect(JSON.parse(rendered)).toEqual(status);
  });

  it("renders the Markdown table from the same verdict only", () => {
    const rendered = renderPretty(status);
    expect(rendered).toContain("| PR | CI | Review | Merge |");
    expect(rendered).toContain(
      "| [#1](https://github.com/owner/repo/pull/1) | \u2014 | \u2014 | ✅ merged |"
    );
  });
});

describe("main", () => {
  it("rejects moving-head evidence in every watcher mode", async () => {
    for (const modeArgs of [[], ["--stack"], ["--queued-stack", "--stack-prs", "1"]]) {
      const harness = testRuntime(fakeReader({
        facts: { headRefOid: "head-A" },
        rollupPages: [{ sourceOid: "head-B", state: "SUCCESS", checks: [passingCheck()], endCursor: null }],
      }));
      expect(await main([
        "--owner", "owner", "--repo", "repo", "--pr", "1", "--max-query-errors", "1", ...modeArgs,
      ], harness.runtime)).toBe(7);
      expect(JSON.parse(harness.stdout.at(-1) ?? "null")).toMatchObject({
        kind: "BLOCKER", blocker: { kind: "status-query", failure: { kind: "missing-key" } },
      });
      expect(harness.stdout.join("")).not.toContain('"kind":"READY"');
    }
  });
  it("emits status-query blockers for contradictory clean-CI evidence", async () => {
    for (const state of ["FAILURE", "ERROR", "PENDING", "EXPECTED"] as const) {
      const harness = testRuntime(fakeReader({
        facts: { mergeStateStatus: "UNSTABLE" },
        rollupState: state,
        commitRollups: [{ oid: "head", state }],
      }));
      expect(await main([
        "--owner", "owner", "--repo", "repo", "--pr", "1", "--max-query-errors", "1",
      ], harness.runtime)).toBe(7);
      expect(JSON.parse(harness.stdout.at(-1) ?? "null")).toMatchObject({
        kind: "BLOCKER", blocker: { kind: "status-query", failure: { kind: "checks-unavailable" } },
      });
    }
  });

  it("carries the observed head in single and stack READY JSON", async () => {
    for (const stackArgs of [[], ["--stack"]]) {
      const harness = testRuntime(fakeReader({
        facts: { headRefOid: "observed-head" },
        commitRollups: [{ oid: "observed-head", state: "SUCCESS" }],
      }));
      expect(await main([
        "--owner", "owner", "--repo", "repo", "--pr", "1", ...stackArgs,
      ], harness.runtime)).toBe(0);
      const ready: unknown = JSON.parse(harness.stdout.at(-1) ?? "null");
      expect(ready).toMatchObject(stackArgs.length === 0
        ? { kind: "READY", scope: { pr: { headRefOid: "observed-head", proof: { ci: { sourceOid: "observed-head" } } } } }
        : { kind: "READY", scope: { prs: [{ headRefOid: "observed-head", proof: { ci: { sourceOid: "observed-head" } } }] } });
    }
  });

  it("binds human READY receipts to the full observed head", async () => {
    const headRefOid = "1234567890abcdef1234567890abcdef12345678";
    for (const stackArgs of [[], ["--stack"]]) {
      const harness = testRuntime(fakeReader({
        facts: { headRefOid },
        commitRollups: [{ oid: headRefOid, state: "SUCCESS" }],
      }));
      expect(await main([
        "--owner", "owner", "--repo", "repo", "--pr", "1", "--pretty", ...stackArgs,
      ], harness.runtime)).toBe(0);
      expect(harness.stdout.at(-1)).toContain(`headRefOid=${headRefOid}`);
    }
  });

  it("retains head identity in queued receipts and rejects a missing open head", async () => {
    const valid = testRuntime(fakeReader({ facts: { headRefOid: "observed-head" } }));
    expect(await main([
      "--owner", "owner", "--repo", "repo", "--queued-stack", "--stack-prs", "1", "--status-only",
    ], valid.runtime)).toBe(0);
    expect(JSON.parse(valid.stdout[0])).toMatchObject({
      kind: "STATUS", rows: [{ facts: { headRefOid: "observed-head" } }],
    });
    const queued = testRuntime(fakeReader({
      facts: { headRefOid: "observed-head" },
      commitRollups: [{ oid: "observed-head", state: "SUCCESS" }],
    }));
    await expect(main([
      "--owner", "owner", "--repo", "repo", "--queued-stack", "--stack-prs", "1",
    ], queued.runtime)).rejects.toThrow("test unexpectedly slept");
    expect(JSON.parse(queued.stdout[1])).toMatchObject({
      kind: "STATUS", reason: "whole-stack-sweep",
      rows: [{ facts: { headRefOid: "observed-head" } }],
    });
    expect(JSON.parse(queued.stdout[2])).toMatchObject({
      kind: "WAITING", reason: { kind: "merge-queue" },
    });
    for (const modeArgs of [[], ["--stack"], ["--queued-stack", "--stack-prs", "1"]]) {
      const missing = testRuntime(fakeReader({ facts: { headRefOid: null } }));
      expect(await main([
        "--owner", "owner", "--repo", "repo", "--pr", "1", "--max-query-errors", "1", ...modeArgs,
      ], missing.runtime)).toBe(7);
      expect(JSON.parse(missing.stdout.at(-1) ?? "null")).toMatchObject({
        kind: "BLOCKER", blocker: { kind: "status-query", failure: { kind: "missing-key" } },
      });
    }
  });
  it("returns EX_USAGE 64 and writes usage errors only to stderr", async () => {
    const harness = testRuntime(fakeReader());
    expect(await main(["--interval", "0"], harness.runtime)).toBe(64);
    expect(harness.stdout).toEqual([]);
    expect(harness.stderr.join("")).toContain(
      "option '--interval <seconds>' argument '0' is invalid"
    );
  });

  it("bypasses the queue machine for queued-stack status-only", async () => {
    const reader = fakeReader();
    const harness = testRuntime(reader);
    const code = await main(
      [
        "--owner",
        "owner",
        "--repo",
        "repo",
        "--queued-stack",
        "--stack-prs",
        "1",
        "--status-only",
      ],
      harness.runtime
    );
    expect(code).toBe(0);
    expect(harness.stdout).toHaveLength(1);
    const verdict: unknown = JSON.parse(harness.stdout[0]);
    expect(verdict).toMatchObject({
      kind: "STATUS",
      terminal: true,
      exitCode: 0,
      mode: "queued-stack",
    });
    expect(harness.stdout[0]).not.toContain('"kind":"QUEUE"');
  });

  it("returns exit 4 for a hidden GitHub-side CI refusal", async () => {
    const reader = fakeReader({
      facts: { mergeStateStatus: "BLOCKED" },
      checks: [passingCheck()],
      rollupState: "FAILURE",
        commitRollups: [{ oid: "head", state: "FAILURE" }],
    });
    const harness = testRuntime(reader);
    const code = await main(
      ["--owner", "owner", "--repo", "repo", "--pr", "1"],
      harness.runtime
    );
    expect(code).toBe(4);
    expect(harness.stdout).toHaveLength(1);
    expect(JSON.parse(harness.stdout[0])).toMatchObject({
      kind: "BLOCKER",
      exitCode: 4,
      blocker: {
        kind: "failing-checks",
        ci: { kind: "ci-github-rejected" },
      },
    });
  });

  it("returns exit 6 with an accurate required-review reason for passing CI", async () => {
    const harness = testRuntime(
      fakeReader({
        facts: { mergeStateStatus: "BLOCKED", reviewDecision: "REVIEW_REQUIRED" },
      })
    );
    expect(
      await main(
        ["--owner", "owner", "--repo", "repo", "--pr", "1"],
        harness.runtime
      )
    ).toBe(6);
    expect(JSON.parse(harness.stdout[0])).toMatchObject({
      kind: "BLOCKER",
      exitCode: 6,
      blocker: { kind: "merge-gate", reason: "review-required" },
    });
  });

  it("renders required reviews and unknown mergeability without claiming clearance", async () => {
    for (const [facts, reason, action] of [
      [
        { mergeStateStatus: "BLOCKED", reviewDecision: "REVIEW_REQUIRED" },
        "review-required",
        "obtain the required approving review",
      ],
      [
        { mergeStateStatus: "UNKNOWN" },
        "mergeability-unknown",
        "recheck GitHub mergeability",
      ],
      [
        { mergeStateStatus: "BLOCKED" },
        "merge-blocked",
        "resolve the GitHub merge requirements",
      ],
    ] as const) {
      const harness = testRuntime(fakeReader({ facts }));
      expect(
        await main(
          ["--owner", "owner", "--repo", "repo", "--pr", "1", "--pretty"],
          harness.runtime
        )
      ).toBe(6);
      expect(harness.stdout.join("")).toContain(`BLOCKER: ${reason}`);
      expect(harness.stdout.join("")).toContain(action);
    }
  });

  it("shows GitHub merge gates accurately in the status table with passing checks", async () => {
    for (const [facts, mergeCell] of [
      [{ mergeStateStatus: "BLOCKED", reviewDecision: "REVIEW_REQUIRED" }, "⚠️ review required"],
      [{ mergeStateStatus: "BLOCKED" }, "⚠️ blocked"],
      [{ mergeStateStatus: "UNKNOWN" }, "⏳ mergeability unknown"],
    ] as const) {
      const harness = testRuntime(fakeReader({ facts }));
      expect(
        await main(
          ["--owner", "owner", "--repo", "repo", "--pr", "1", "--status-only", "--pretty"],
          harness.runtime
        )
      ).toBe(0);
      expect(harness.stdout.join("")).toContain(`| ✅ | ✅ | ${mergeCell} |`);
    }
  });

  it("shows help without touching the reader", async () => {
    const reader = fakeReader();
    const harness = testRuntime(reader);
    expect(await main(["--help"], harness.runtime)).toBe(0);
    expect(harness.stdout.join("")).toContain("JSON (NDJSON while polling)");
    expect(reader.calls).toEqual([]);
  });
});
