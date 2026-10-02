import { describe, expect, it } from "bun:test";
import { WatcherQueryError } from "./github.ts";
import {
  applyQueueSnapshot,
  assessGitHubMerge,
  classifyPr,
  createQueueState,
  evaluateQueue,
  planQueue,
  queryBackoffSeconds,
  readSnapshot,
  runQueued,
  runSimple,
  selectTierMajorStackDecision,
} from "./policy.ts";
import {
  fakeReader,
  failedCheck,
  passingCheck,
  pendingCheck,
} from "./fakes.test-helper.ts";
import type {
  GitHubReader,
  NonEmpty,
  PollingOptions,
  PrContext,
  ProgressVerdict,
  PullRequestFacts,
  RollupState,
} from "./types.ts";
import { parsePrNumber } from "./types.ts";

const context = (number: number): PrContext => ({
  owner: "owner",
  repo: "repo",
  number: parsePrNumber(number),
});
const options = {
  interval: 10,
  sweepInterval: 300,
  timeout: 0,
  maxQueryErrors: 5,
  allowDraft: false,
} satisfies PollingOptions;

describe("readiness truth table", () => {
  it("uses bound current-head evidence while history remains prior-pass metadata", async () => {
    const snapshot = await readSnapshot({
      reader: fakeReader({
        facts: { headRefOid: "head-A" },
        rollupPages: [{ sourceOid: "head-A", state: "SUCCESS", checks: [passingCheck()], endCursor: null }],
        commitRollups: [{ oid: "head-A", state: "FAILURE" }, { oid: "new-head-B", state: "SUCCESS" }],
      }),
      context: context(1), pendingHistory: "include", beforeRead: () => {}, allowDraft: false,
    });
    expect(classifyPr(snapshot)).toMatchObject({ kind: "ready", pr: {
      headRefOid: "head-A", proof: { ci: { sourceOid: "head-A", hadPreviousPassingCi: false,
        github: { headRollupState: "SUCCESS" } } },
    } });
  });

  it("rejects a review gate receipt from another head", async () => {
    await expect(readSnapshot({
      reader: fakeReader({
        facts: { headRefOid: "head-A", isDraft: true, mergeStateStatus: "DRAFT" },
        rollupPages: [{ sourceOid: "head-B", state: "PENDING", checks: [{
          ...passingCheck("Code Review Gate"), kind: "code-review-gate", name: "Code Review Gate", reportedState: "PENDING",
        }], endCursor: null }],
      }),
      context: context(1), pendingHistory: "include", beforeRead: () => {}, allowDraft: true,
    })).rejects.toThrow("observed head");
  });
  it("rejects contradictory head-rollup evidence before claiming clean CI", async () => {
    for (const state of ["FAILURE", "ERROR", "PENDING", "EXPECTED"] as const) {
      await expect(readSnapshot({
        reader: fakeReader({
          facts: { mergeStateStatus: "UNSTABLE" },
          rollupState: state,
        commitRollups: [{ oid: "head", state }],
        }),
        context: context(1), pendingHistory: "include", beforeRead: () => {}, allowDraft: false,
      })).rejects.toThrow("head rollup");
    }
  });

  it("preserves the intentional pending Code Review Gate exception", async () => {
    const gate = {
      ...passingCheck("Code Review Gate"),
      kind: "code-review-gate" as const,
      name: "Code Review Gate" as const,
      reportedState: "PENDING",
    };
    const snapshot = await readSnapshot({
      reader: fakeReader({
        facts: { isDraft: true, mergeStateStatus: "DRAFT" },
        checks: [passingCheck(), gate],
        rollupPages: [{ sourceOid: "head", state: "PENDING", checks: [passingCheck(), gate], endCursor: null }],
        rollupState: "PENDING",
        commitRollups: [{ oid: "head", state: "PENDING" }],
      }),
      context: context(1), pendingHistory: "include", beforeRead: () => {}, allowDraft: true,
    });
    expect(classifyPr(snapshot, true)).toMatchObject({ kind: "ready" });
  });

  it("does not let the excluded review gate hide other pending checks", async () => {
    const gate = {
      ...passingCheck("Code Review Gate"),
      kind: "code-review-gate" as const,
      name: "Code Review Gate" as const,
      reportedState: "PENDING",
    };
    const snapshot = await readSnapshot({
      reader: fakeReader({
        facts: { isDraft: true, mergeStateStatus: "DRAFT" },
        checks: [passingCheck(), gate],
        rollupPages: [
          { sourceOid: "head", state: "PENDING", checks: [passingCheck(), gate], endCursor: "next" },
          { sourceOid: "head", state: "PENDING", checks: [pendingCheck("hidden-ci")], endCursor: null },
        ],
        rollupState: "PENDING",
        commitRollups: [{ oid: "head", state: "PENDING" }],
      }),
      context: context(1), pendingHistory: "include", beforeRead: () => {}, allowDraft: true,
    });
    expect(classifyPr(snapshot, true)).toMatchObject({
      kind: "waiting", pending: [{ name: "hidden-ci" }],
    });
  });

  it("fails closed on an unavailable head and preserves the observed identity", async () => {
    for (const headRefOid of [null, "", "   "]) {
      await expect(readSnapshot({
        reader: fakeReader({ facts: { headRefOid } }),
        context: context(1), pendingHistory: "include", beforeRead: () => {}, allowDraft: false,
      })).rejects.toThrow("headRefOid");
    }
    const snapshot = await readSnapshot({
      reader: fakeReader({
        facts: { headRefOid: "observed-head" },
        commitRollups: [{ oid: "observed-head", state: "SUCCESS" }],
      }),
      context: context(1), pendingHistory: "include", beforeRead: () => {}, allowDraft: false,
    });
    expect(classifyPr(snapshot)).toMatchObject({
      kind: "ready", pr: { headRefOid: "observed-head" },
    });
    expect(selectTierMajorStackDecision([snapshot])).toMatchObject({
      kind: "clear", prs: [{ headRefOid: "observed-head" }],
    });
  });
  it("refuses blocked and unknown merge states regardless of rollup", () => {
    const cases: readonly [
      PullRequestFacts["mergeStateStatus"],
      RollupState,
      "allowed" | "refused",
    ][] = [
      ["BLOCKED", "FAILURE", "refused"],
      ["BLOCKED", "ERROR", "refused"],
      ["BLOCKED", "PENDING", "refused"],
      ["BLOCKED", "SUCCESS", "refused"],
      ["BLOCKED", "EXPECTED", "refused"],
      ["BLOCKED", null, "refused"],
      ["UNSTABLE", "FAILURE", "allowed"],
      ["UNKNOWN", "ERROR", "refused"],
      ["UNKNOWN", "EXPECTED", "refused"],
      ["UNKNOWN", "FAILURE", "refused"],
      ["UNKNOWN", "PENDING", "refused"],
      ["UNKNOWN", "SUCCESS", "refused"],
      ["UNKNOWN", null, "refused"],
      ["CLEAN", "SUCCESS", "allowed"],
      ["HAS_HOOKS", "SUCCESS", "allowed"],
    ];
    for (const [mergeStateStatus, headRollupState, expected] of cases) {
      expect(
        assessGitHubMerge({ mergeStateStatus, headRollupState }).kind
      ).toBe(expected);
    }
  });

  it("reports required review instead of READY or failing checks", async () => {
    const snapshot = await readSnapshot({
      reader: fakeReader({
        facts: {
          mergeStateStatus: "BLOCKED",
          reviewDecision: "REVIEW_REQUIRED",
        },
        commitRollups: [{ oid: "head", state: "SUCCESS" }],
      }),
      context: context(1),
      pendingHistory: "include", beforeRead: () => {},
      allowDraft: false,
    });
    expect(classifyPr(snapshot)).toMatchObject({
      kind: "blocker",
      blocker: { kind: "merge-gate", reason: "review-required" },
    });
    expect(selectTierMajorStackDecision([snapshot])).toMatchObject({
      kind: "blocker",
      blocker: { kind: "merge-gate", reason: "review-required" },
    });
    const queue = [context(1)] satisfies NonEmpty<PrContext>;
    const state = applyQueueSnapshot(
      createQueueState(queue, 0), snapshot, 0, options
    ).state;
    expect(evaluateQueue(state, 0, options)).toMatchObject({
      kind: "blocker",
      blocker: { kind: "merge-gate", reason: "review-required" },
    });
  });

  it("reports blocked and undetermined mergeability with accurate gate reasons", async () => {
    const cases = [
      [{ mergeStateStatus: "BLOCKED" }, "merge-blocked"],
      [{ mergeStateStatus: "UNKNOWN" }, "mergeability-unknown"],
      [{ mergeable: "UNKNOWN" }, "mergeability-unknown"],
      [{ reviewDecision: "REVIEW_REQUIRED" }, "review-required"],
    ] as const;
    for (const [facts, reason] of cases) {
      const snapshot = await readSnapshot({
        reader: fakeReader({ facts }),
        context: context(1),
        pendingHistory: "include", beforeRead: () => {},
        allowDraft: false,
      });
      expect(classifyPr(snapshot)).toMatchObject({
        kind: "blocker",
        blocker: { kind: "merge-gate", reason },
      });
    }
  });

  it("blocks a review gate even when queued pending checks omit commit history", async () => {
    const snapshot = await readSnapshot({
      reader: fakeReader({
        facts: {
          mergeStateStatus: "BLOCKED",
          reviewDecision: "REVIEW_REQUIRED",
        },
        checks: [pendingCheck()],
      }),
      context: context(1),
      pendingHistory: "omit", beforeRead: () => {},
      allowDraft: false,
    });
    expect(classifyPr(snapshot)).toMatchObject({
      kind: "blocker",
      blocker: { kind: "merge-gate", reason: "review-required" },
    });
  });

  it("allows settled mergeable states with approved or unnecessary reviews", async () => {
    for (const mergeStateStatus of ["CLEAN", "HAS_HOOKS", "UNSTABLE"] as const)
      for (const reviewDecision of ["APPROVED", null] as const) {
        const snapshot = await readSnapshot({
          reader: fakeReader({ facts: { mergeStateStatus, reviewDecision } }),
          context: context(1),
          pendingHistory: "include", beforeRead: () => {},
          allowDraft: false,
        });
        expect(classifyPr(snapshot)).toMatchObject({
          kind: "ready",
          pr: {
            proof: { mergeability: "clear", gate: { reviewDecision } },
          },
        });
      }
  });

  it("allow-draft bypasses only the draft gate", async () => {
    const draft = await readSnapshot({
      reader: fakeReader({ facts: { isDraft: true, mergeStateStatus: "DRAFT" } }),
      context: context(1),
      pendingHistory: "include", beforeRead: () => {},
      allowDraft: true,
    });
    expect(classifyPr(draft, true)).toMatchObject({
      kind: "ready", pr: { proof: { gate: { draft: "draft-allowed" } } },
    });
    const reviewRequired = await readSnapshot({
      reader: fakeReader({
        facts: {
          isDraft: true,
          mergeStateStatus: "DRAFT",
          reviewDecision: "REVIEW_REQUIRED",
        },
      }),
      context: context(1),
      pendingHistory: "include", beforeRead: () => {},
      allowDraft: true,
    });
    expect(classifyPr(reviewRequired, true)).toMatchObject({
      kind: "blocker",
      blocker: { kind: "merge-gate", reason: "review-required" },
    });
  });

  it("turns a clean visible list plus GitHub refusal into an explicit CI blocker", async () => {
    const reader = fakeReader({
      facts: { mergeStateStatus: "BLOCKED" },
      checks: [passingCheck()],
      rollupState: "FAILURE",
        commitRollups: [{ oid: "head", state: "FAILURE" }],
    });
    const snapshot = await readSnapshot({
      reader,
      context: context(1),
      pendingHistory: "include", beforeRead: () => {},
      allowDraft: false,
    });
    expect(snapshot.kind).toBe("open");
    if (snapshot.kind !== "open") throw new Error("expected open snapshot");
    expect(snapshot.ci.kind).toBe("ci-github-rejected");
    expect(classifyPr(snapshot)).toMatchObject({
      kind: "blocker",
      blocker: { kind: "failing-checks" },
    });
  });
});

describe("snapshot query planning", () => {
  it("does not query commit rollups while queued checks are pending", async () => {
    const reader = fakeReader({
      checks: [pendingCheck()],
    });
    const snapshot = await readSnapshot({
      reader,
      context: context(2),
      pendingHistory: "omit", beforeRead: () => {},
      allowDraft: false,
    });
    expect(snapshot.kind).toBe("open");
    if (snapshot.kind !== "open") throw new Error("expected open snapshot");
    expect(snapshot.ci.kind).toBe("ci-pending");
    expect(reader.calls).toEqual([
      "pullRequest",
      "reviewThreads",
      "checkRollupPage:head:null",
    ]);
  });

  it("queries rollups for settled and failed lists", async () => {
    const settled = fakeReader();
    await readSnapshot({
      reader: settled,
      context: context(3),
      pendingHistory: "omit", beforeRead: () => {},
      allowDraft: false,
    });
    expect(settled.calls).toContain("commitRollups");

    const failed = fakeReader({
      checks: [failedCheck()],
    });
    await readSnapshot({
      reader: failed,
      context: context(4),
      pendingHistory: "omit", beforeRead: () => {},
      allowDraft: false,
    });
    expect(failed.calls).toContain("commitRollups");
  });

  it("short-circuits merged rows before threads and checks", async () => {
    const reader = fakeReader({
      facts: { state: "MERGED", mergedAt: "2026-07-26T00:00:00Z" },
    });
    expect(
      (
        await readSnapshot({
          reader,
          context: context(5),
          pendingHistory: "include", beforeRead: () => {},
          allowDraft: false,
        })
      ).kind
    ).toBe("merged");
    expect(reader.calls).toEqual(["pullRequest"]);
  });
});

it("scans stacks tier-major so an upstack conflict outranks frontier CI", async () => {
  const frontier = await readSnapshot({
    reader: fakeReader({
      checks: [failedCheck()],
      rollupState: "FAILURE",
        commitRollups: [{ oid: "head", state: "FAILURE" }],
    }),
    context: context(10),
    pendingHistory: "omit", beforeRead: () => {},
    allowDraft: false,
  });
  const upstack = await readSnapshot({
    reader: fakeReader({ facts: { mergeable: "CONFLICTING" } }),
    context: context(11),
    pendingHistory: "omit", beforeRead: () => {},
    allowDraft: false,
  });
  const decision = selectTierMajorStackDecision([frontier, upstack]);
  expect(decision).toMatchObject({
    kind: "blocker",
    blocker: { kind: "merge-conflicts", pr: { number: 11 } },
  });
});

it("attributes a stack wait to the PR whose checks are pending, not the bottom", async () => {
  const readyBottom = await readSnapshot({
    reader: fakeReader(),
    context: context(20),
    pendingHistory: "omit", beforeRead: () => {},
    allowDraft: false,
  });
  const pendingUpstack = await readSnapshot({
    reader: fakeReader({
      checks: [pendingCheck("upstack-build")],
    }),
    context: context(21),
    pendingHistory: "omit", beforeRead: () => {},
    allowDraft: false,
  });
  const decision = selectTierMajorStackDecision([readyBottom, pendingUpstack]);
  expect(decision).toMatchObject({
    kind: "waiting",
    frontier: { number: 21 },
    pending: [{ name: "upstack-build" }],
  });
});

it("waits on a draft while checks are pending, then reports the draft gate", async () => {
  const pending = await readSnapshot({
    reader: fakeReader({
      facts: { isDraft: true },
      checks: [pendingCheck()],
    }),
    context: context(12),
    pendingHistory: "omit", beforeRead: () => {},
    allowDraft: false,
  });
  expect(classifyPr(pending).kind).toBe("waiting");

  const settled = await readSnapshot({
    reader: fakeReader({ facts: { isDraft: true } }),
    context: context(12),
    pendingHistory: "omit", beforeRead: () => {},
    allowDraft: false,
  });
  expect(classifyPr(settled)).toMatchObject({
    kind: "blocker",
    blocker: { kind: "merge-gate", reason: "draft-pr" },
  });
});

describe("queued-stack cadence", () => {
  async function openSnapshot(pr: PrContext) {
    return readSnapshot({
      reader: fakeReader(),
      context: pr,
      pendingHistory: "omit", beforeRead: () => {},
      allowDraft: false,
    });
  }

  it("drops a sweep head only after its snapshot succeeds", async () => {
    const queue = [
      context(20),
      context(21),
      context(22),
    ] satisfies NonEmpty<PrContext>;
    let state = createQueueState(queue, 0);
    const first = await openSnapshot(queue[0]);
    state = applyQueueSnapshot(state, first, 0, options).state;
    expect(state.work).toMatchObject({
      kind: "whole-stack-sweep",
      remaining: [{ number: 21 }, { number: 22 }],
    });
    const second = await openSnapshot(queue[1]);
    state = applyQueueSnapshot(state, second, 60, options).state;
    expect(state.work).toMatchObject({
      kind: "whole-stack-sweep",
      remaining: [{ number: 22 }],
    });
  });

  it("resumes the sweep at the PR whose read failed", async () => {
    const middle = context(21);
    const base = fakeReader();
    let failNext = true;
    const timeline: string[] = [];
    const reader = {
      ...base,
      async pullRequest(pr: PrContext) {
        if (pr.number === middle.number && failNext) {
          failNext = false;
          timeline.push(`fail:${pr.number}`);
          throw new WatcherQueryError({
            kind: "command-exit",
            retryable: true,
            detail: "rate limited",
            code: 1,
          });
        }
        timeline.push(`read:${pr.number}`);
        return base.pullRequest(pr);
      },
    } satisfies GitHubReader;
    let now = 0;
    let sleeps = 0;
    const running = runQueued({
      dependencies: {
        reader,
        clock: {
          now: () => now,
          observedAt: () => "2026-07-26T00:00:00.000Z",
          async sleep(seconds) {
            timeline.push("sleep");
            now += seconds;
            sleeps += 1;
            if (sleeps === 2) throw new Error("stop after resume proof");
          },
        },
        emit(verdict) {
          timeline.push(`emit:${verdict.kind}`);
        },
      },
      contexts: [context(20), middle, context(22)],
      options,
    });
    await expect(running).rejects.toThrow("stop after resume proof");
    expect(timeline).toEqual([
      "emit:QUEUE",
      "read:20",
      "fail:21",
      "emit:RETRY",
      "sleep",
      "read:21",
      "read:22",
      "emit:STATUS",
      "emit:WAITING",
      "sleep",
    ]);
  });

  it("emits a completed sweep only after its final successful snapshot", async () => {
    const queue = [context(30), context(31)] satisfies NonEmpty<PrContext>;
    let state = createQueueState(queue, 0);
    const first = applyQueueSnapshot(
      state,
      await openSnapshot(queue[0]),
      0,
      options
    );
    expect(first.completedSweepRows).toBeNull();
    state = first.state;
    const second = applyQueueSnapshot(
      state,
      await openSnapshot(queue[1]),
      5,
      options
    );
    expect(
      second.completedSweepRows?.map((row) => Number(row.context.number))
    ).toEqual([30, 31]);
    expect(second.state.nextSweepAt).toBe(305);
  });

  it("ADVANCE continues directly to the new frontier without sleeping", async () => {
    const one = context(40);
    const two = context(41);
    const base = fakeReader();
    const reads = new Map<number, number>();
    const timeline: string[] = [];
    const reader = {
      ...base,
      async pullRequest(pr: PrContext) {
        timeline.push(`read:${pr.number}`);
        const facts = await base.pullRequest(pr);
        const count = (reads.get(pr.number) ?? 0) + 1;
        reads.set(pr.number, count);
        return pr.number === one.number && count > 1
          ? {
              ...facts,
              state: "MERGED" as const,
              mergedAt: "2026-07-26T00:00:00Z",
            }
          : facts;
      },
    } satisfies GitHubReader;
    let now = 0;
    let sleeps = 0;
    const emitted: ProgressVerdict[] = [];
    const running = runQueued({
      dependencies: {
        reader,
        clock: {
          now: () => now,
          observedAt: () => "2026-07-26T00:00:00.000Z",
          async sleep(seconds) {
            timeline.push("sleep");
            now += seconds;
            sleeps += 1;
            if (sleeps === 2) throw new Error("stop after advance proof");
          },
        },
        emit(verdict) {
          emitted.push(verdict);
          timeline.push(`emit:${verdict.kind}`);
        },
      },
      contexts: [one, two],
      options,
    });
    await expect(running).rejects.toThrow("stop after advance proof");
    expect(emitted.some((event) => event.kind === "ADVANCE")).toBe(true);
    const firstSleep = timeline.indexOf("sleep");
    expect(timeline.slice(firstSleep, firstSleep + 5)).toEqual([
      "sleep",
      "read:40",
      "emit:ADVANCE",
      "read:41",
      "emit:WAITING",
    ]);
  });

  it("deduplicates identical waits and schedules the next due sweep", async () => {
    const queue = [context(50)] satisfies NonEmpty<PrContext>;
    let state = createQueueState(queue, 0);
    state = applyQueueSnapshot(
      state,
      await openSnapshot(queue[0]),
      0,
      options
    ).state;
    const first = evaluateQueue(state, 0, options);
    expect(first.kind).toBe("waiting");
    if (first.kind !== "waiting") throw new Error("expected waiting");
    expect(first.emit).toBe(true);
    const second = evaluateQueue(first.state, 10, options);
    expect(second.kind).toBe("waiting");
    if (second.kind !== "waiting") throw new Error("expected waiting");
    expect(second.emit).toBe(false);
    expect(planQueue(second.state, 300).work?.kind).toBe("whole-stack-sweep");
  });
});

it("uses the specified retry floor and cap", () => {
  expect(queryBackoffSeconds(1, 1)).toBe(60);
  expect(queryBackoffSeconds(1, 2)).toBe(120);
  expect(queryBackoffSeconds(60, 4)).toBe(300);
});

describe("polling deadline", () => {
  it("caps pending-check sleep to the remaining budget and performs no later read", async () => {
    const reader = fakeReader({ checks: [pendingCheck()], rollupState: "PENDING" });
    let now = 0;
    const sleeps: number[] = [];
    const result = await runSimple({
      dependencies: {
        reader,
        clock: { now: () => now, observedAt: () => "now", async sleep(seconds) { sleeps.push(seconds); now += seconds; } },
        emit() {},
      },
      contexts: [context(1)], mode: "single", statusOnly: false,
      options: { ...options, timeout: 1, interval: 60 },
    });
    expect(result).toMatchObject({ kind: "TIMEOUT", exitCode: 5 });
    expect(sleeps).toEqual([1]);
    expect(reader.calls.filter((call) => call === "pullRequest")).toHaveLength(1);
  });

  it("caps query-error backoff and stops before retrying after expiry", async () => {
    const base = fakeReader();
    let queries = 0;
    const reader = { ...base, async pullRequest() {
      queries += 1;
      throw new WatcherQueryError({ kind: "command-exit", retryable: true, code: 1, detail: "rate limited" });
    } } satisfies GitHubReader;
    let now = 0;
    const sleeps: number[] = [];
    const result = await runSimple({
      dependencies: {
        reader,
        clock: { now: () => now, observedAt: () => "now", async sleep(seconds) { sleeps.push(seconds); now += seconds; } },
        emit() {},
      },
      contexts: [context(1)], mode: "single", statusOnly: false,
      options: { ...options, timeout: 1, interval: 60 },
    });
    expect(result).toMatchObject({ kind: "TIMEOUT", reason: { kind: "status-unavailable" } });
    expect(sleeps).toEqual([1]);
    expect(queries).toBe(1);
  });

  it("stops a queued partial sweep and retains rows that completed before expiry", async () => {
    const base = fakeReader();
    let now = 0;
    const reads: number[] = [];
    const reader = { ...base, async pullRequest(pr: PrContext) {
      reads.push(pr.number);
      return base.pullRequest(pr);
    }, async commitRollups(pr: PrContext) {
      const commits = await base.commitRollups(pr);
      now = 2;
      return commits;
    } } satisfies GitHubReader;
    const result = await runQueued({
      dependencies: {
        reader,
        clock: { now: () => now, observedAt: () => "now", async sleep() { throw new Error("unexpected sleep"); } },
        emit() {},
      },
      contexts: [context(1), context(2)], options: { ...options, timeout: 1 },
    });
    expect(result).toMatchObject({ kind: "TIMEOUT", rows: [{ context: { number: 1 } }] });
    expect(reads).toEqual([1]);
  });

  it("does not report READY when an in-flight snapshot completes after the deadline", async () => {
    const base = fakeReader();
    let now = 0;
    const reader = { ...base, async commitRollups(pr: PrContext) {
      const commits = await base.commitRollups(pr);
      now = 2;
      return commits;
    } } satisfies GitHubReader;
    const result = await runSimple({
      dependencies: {
        reader,
        clock: { now: () => now, observedAt: () => "now", async sleep() { throw new Error("unexpected sleep"); } },
        emit() {},
      },
      contexts: [context(1)], mode: "single", statusOnly: false,
      options: { ...options, timeout: 1 },
    });
    expect(result).toMatchObject({ kind: "TIMEOUT", rows: [{ context: { number: 1 } }] });
  });

  it("starts no further reader calls after an in-flight facts read expires", async () => {
    const base = fakeReader();
    let now = 0;
    const reader = { ...base, async pullRequest(pr: PrContext) {
      const facts = await base.pullRequest(pr);
      now = 2;
      return facts;
    } } satisfies GitHubReader;
    const result = await runSimple({
      dependencies: {
        reader,
        clock: { now: () => now, observedAt: () => "now", async sleep() { throw new Error("unexpected sleep"); } },
        emit() {},
      },
      contexts: [context(1)], mode: "single", statusOnly: false,
      options: { ...options, timeout: 1 },
    });
    expect(result).toMatchObject({ kind: "TIMEOUT", rows: [] });
    expect(base.calls).toEqual(["pullRequest"]);
  });

  it("starts no later rollup page after the deadline", async () => {
    const base = fakeReader({ rollupPages: [
      { sourceOid: "head", state: "SUCCESS", checks: [passingCheck()], endCursor: "next" },
      { sourceOid: "head", state: "SUCCESS", checks: [passingCheck()], endCursor: null },
    ] });
    let now = 0;
    const reader = { ...base, async checkRollupPage(pr: PrContext, head: string, after: string | null) {
      const page = await base.checkRollupPage(pr, head, after);
      now = 2;
      return page;
    } } satisfies GitHubReader;
    const result = await runSimple({
      dependencies: {
        reader,
        clock: { now: () => now, observedAt: () => "now", async sleep() { throw new Error("unexpected sleep"); } },
        emit() {},
      },
      contexts: [context(1)], mode: "single", statusOnly: false,
      options: { ...options, timeout: 1 },
    });
    expect(result.kind).toBe("TIMEOUT");
    expect(base.calls).toEqual(["pullRequest", "reviewThreads", "checkRollupPage:head:null"]);
  });

  it("keeps timeout zero disabled while using the normal polling cadence", async () => {
    const reader = fakeReader({ rollupPages: [
      { sourceOid: "head", state: "PENDING", checks: [pendingCheck()], endCursor: null },
      { sourceOid: "head", state: "SUCCESS", checks: [passingCheck()], endCursor: null },
    ] });
    let now = 0;
    const sleeps: number[] = [];
    const result = await runSimple({
      dependencies: {
        reader,
        clock: { now: () => now, observedAt: () => "now", async sleep(seconds) { sleeps.push(seconds); now += seconds; } },
        emit() {},
      },
      contexts: [context(1)], mode: "single", statusOnly: false,
      options: { ...options, timeout: 0, interval: 60 },
    });
    expect(result.kind).toBe("READY");
    expect(sleeps).toEqual([60]);
  });
});
