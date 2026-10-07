import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  ChecksUnavailable,
  WatcherQueryError,
  mapRollupNode,
  orderStack,
  parsePullRequest,
  parseCheckRollupPage,
  parseOpenPullRequests,
  parseReviewThreads,
  resolveChecks,
  resolveContext,
} from "./github.ts";
import {
  fakeReader,
  failedCheck,
  passingCheck,
  pendingCheck,
} from "./fakes.test-helper.ts";
import { parsePrNumber } from "./types.ts";

const context = {
  owner: "owner",
  repo: "repo",
  number: parsePrNumber(42),
};

describe("observed-head checks", () => {
  it("reads settled checks from the captured head", async () => {
    const reader = fakeReader({ checks: [passingCheck("bound")] });
    const read = await resolveChecks(reader, context, "head", () => {});
    expect(read).toMatchObject({ source: "graphql-rollup", sourceOid: "head", state: "SUCCESS" });
    expect(read.checks.map((check) => check.name)).toEqual(["bound"]);
    expect(reader.calls).toEqual(["checkRollupPage:head:null"]);
  });
  it("includes later pages without changing source identity", async () => {
    const reader = fakeReader({ rollupPages: [
      { sourceOid: "head", state: "FAILURE", checks: [passingCheck("first")], endCursor: "next" },
      { sourceOid: "head", state: "FAILURE", checks: [failedCheck("second")], endCursor: null },
    ] });
    const read = await resolveChecks(reader, context, "head", () => {});
    expect(read.checks.map((check) => check.name)).toEqual(["first", "second"]);
    expect(reader.calls).toEqual(["checkRollupPage:head:null", "checkRollupPage:head:next"]);
  });
  it("fails closed when the captured commit has no rollup", async () => {
    const reader = fakeReader({ checks: [], rollupState: null });
    await expect(resolveChecks(reader, context, "head", () => {})).rejects.toBeInstanceOf(ChecksUnavailable);
    expect(reader.calls).toEqual(["checkRollupPage:head:null"]);
  });
  it("rejects repeated continuation cursors before accepting partial checks", async () => {
    const reader = fakeReader({ rollupPages: [
      { sourceOid: "head", state: "SUCCESS", checks: [passingCheck()], endCursor: "repeat" },
      { sourceOid: "head", state: "SUCCESS", checks: [passingCheck()], endCursor: "repeat" },
    ] });
    await expect(resolveChecks(reader, context, "head", () => {})).rejects.toThrow("repeated pagination");
    expect(reader.calls).toEqual(["checkRollupPage:head:null", "checkRollupPage:head:repeat"]);
  });
  it("rejects aggregate states that change during pagination", async () => {
    const reader = fakeReader({ rollupPages: [
      { sourceOid: "head", state: "PENDING", checks: [passingCheck()], endCursor: "next" },
      { sourceOid: "head", state: "SUCCESS", checks: [passingCheck()], endCursor: null },
    ] });
    await expect(resolveChecks(reader, context, "head", () => {})).rejects.toThrow("state changed");
  });
});

it("rejects incomplete head-rollup pagination and preserves valid continuation", () => {
  for (const endCursor of [null, "", undefined, "next"]) {
    const response = { data: { repository: { object: {
      __typename: "Commit", oid: "head", statusCheckRollup: { state: "SUCCESS", contexts: {
        nodes: [{ __typename: "StatusContext", context: "ci", state: "SUCCESS" }],
        pageInfo: { hasNextPage: true, endCursor },
      } },
    } } } };
    if (endCursor === "next")
      expect(parseCheckRollupPage(response, "head")).toMatchObject({ sourceOid: "head", state: "SUCCESS", endCursor: "next", checks: [{ kind: "passed" }] });
    else expect(() => parseCheckRollupPage(response, "head")).toThrow(WatcherQueryError);
  }
});

it("validates captured commit identity and nullable rollups without claiming passing proof", () => {
  for (const object of [null, { __typename: "Tree", oid: "head" },
    { __typename: "Commit", statusCheckRollup: null },
    { __typename: "Commit", oid: "other-head", statusCheckRollup: null }]) {
    expect(() => parseCheckRollupPage({ data: { repository: { object } } }, "head")).toThrow(WatcherQueryError);
  }
  expect(parseCheckRollupPage({ data: { repository: { object: {
    __typename: "Commit", oid: "head", statusCheckRollup: null,
  } } } }, "head")).toEqual({ sourceOid: "head", state: null, checks: [], endCursor: null });
  expect(() => parseCheckRollupPage({ data: { repository: { object: {
    __typename: "Commit", oid: "head", statusCheckRollup: { state: null, contexts: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
  } } } }, "head")).toThrow(WatcherQueryError);
});

describe("rollup node mapping", () => {
  it("maps terminal and non-terminal CheckRun states fail closed", () => {
    const cases = [
      ["IN_PROGRESS", null, "pending", "PENDING"],
      ["COMPLETED", "SUCCESS", "passed", "SUCCESS"],
      ["COMPLETED", "NEUTRAL", "skipped", "NEUTRAL"],
      ["COMPLETED", "SKIPPED", "skipped", "SKIPPED"],
      ["COMPLETED", "ACTION_REQUIRED", "failed", "ACTION_REQUIRED"],
      ["COMPLETED", "TIMED_OUT", "failed", "FAILURE"],
      ["COMPLETED", "FUTURE_VALUE", "failed", "FAILURE"],
    ] as const;
    for (const [status, conclusion, kind, reportedState] of cases) {
      expect(
        mapRollupNode({
          __typename: "CheckRun",
          name: "ci",
          status,
          conclusion,
        })
      ).toMatchObject({ kind, reportedState });
    }
  });

  it("classifies an in-progress Code Review Gate from the rollup as the gate", () => {
    expect(
      mapRollupNode({
        __typename: "CheckRun",
        name: "Code Review Gate",
        status: "IN_PROGRESS",
        conclusion: null,
      })
    ).toMatchObject({ kind: "code-review-gate" });
    expect(
      mapRollupNode({
        __typename: "StatusContext",
        context: "Code Review Gate",
        state: "PENDING",
      })
    ).toMatchObject({ kind: "code-review-gate" });
  });

  it("maps StatusContext states and rejects unknown or missing typenames", () => {
    expect(
      mapRollupNode({
        __typename: "StatusContext",
        context: "ci",
        state: "EXPECTED",
      })
    ).toMatchObject({ kind: "pending", reportedState: "PENDING" });
    expect(
      mapRollupNode({
        __typename: "StatusContext",
        context: "ci",
        state: "FUTURE_VALUE",
      })
    ).toMatchObject({ kind: "failed", reportedState: "FUTURE_VALUE" });
    expect(() => mapRollupNode({ __typename: "FutureNode" })).toThrow(WatcherQueryError);
    expect(() => mapRollupNode({})).toThrow(WatcherQueryError);
  });
});

it("rejects mixed passed and unknown or null rollup evidence", () => {
  for (const unknown of [{ __typename: "FutureNode" }, {}, null])
    expect(() => parseCheckRollupPage({ data: { repository: { object: {
      __typename: "Commit", oid: "head", statusCheckRollup: { state: "SUCCESS", contexts: {
        nodes: [{ __typename: "StatusContext", context: "ci", state: "SUCCESS" }, unknown],
        pageInfo: { hasNextPage: false, endCursor: null },
      } },
    } } } }, "head")).toThrow(WatcherQueryError);
});

it("rejects checks from a moving head and mixed source identities across pages", async () => {
  for (const sources of [["head-B"], ["head-A", "head-B"]]) {
    const reader = fakeReader({
      rollupPages: sources.map((sourceOid, index) => ({
        sourceOid, state: "SUCCESS" as const, checks: [passingCheck()],
        endCursor: index < sources.length - 1 ? "next" : null,
      })),
    });
    await expect(resolveChecks(reader, context, "head-A", () => {})).rejects.toThrow("head");
  }
});

describe("closed enum parsing", () => {
  const rawPullRequest = {
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    reviewDecision: "APPROVED",
    headRefOid: "head",
    headRefName: "feature",
    baseRefName: "main",
    state: "OPEN",
    mergedAt: null,
    isDraft: false,
  };

  it("accepts mergeStateStatus CONFLICTING", () => {
    expect(
      parsePullRequest(
        { ...rawPullRequest, mergeStateStatus: "CONFLICTING" },
        context
      ).mergeStateStatus
    ).toBe("CONFLICTING");
  });

  it("reads gh's empty reviewDecision as no decision rather than a parse failure", () => {
    expect(
      parsePullRequest({ ...rawPullRequest, reviewDecision: "" }, context)
        .reviewDecision
    ).toBeNull();
  });

  it("still rejects an unknown reviewDecision", () => {
    expect(() =>
      parsePullRequest({ ...rawPullRequest, reviewDecision: "MAYBE" }, context)
    ).toThrow(WatcherQueryError);
  });

  it("rejects unknown enum values as retryable errors carrying the raw value", () => {
    try {
      parsePullRequest(
        { ...rawPullRequest, mergeStateStatus: "FUTURE_STATE" },
        context
      );
      throw new Error("expected parser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WatcherQueryError);
      if (!(error instanceof WatcherQueryError)) throw error;
      expect(error.failure).toMatchObject({
        kind: "missing-key",
        retryable: true,
        rawValue: '"FUTURE_STATE"',
      });
    }
  });
});

it("annotates automated review threads with distinct review-pass counts", () => {
  const response = {
    data: {
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                id: "one",
                isResolved: false,
                comments: {
                  nodes: [
                    {
                      body: "RUN_ID: run-1",
                      createdAt: "now",
                      path: "a.ts",
                      line: 1,
                      author: { login: "review-bot" },
                    },
                  ],
                },
              },
              {
                id: "two",
                isResolved: false,
                comments: {
                  nodes: [
                    {
                      body: "AUTOMATED_REVIEW_ID: run-2 severity high",
                      createdAt: "now",
                      path: null,
                      line: null,
                      author: { login: "review-bot[bot]" },
                    },
                  ],
                },
              },
              {
                id: "resolved",
                isResolved: true,
                comments: {
                  nodes: [
                    {
                      body: "RUN_ID: run-3",
                      createdAt: "now",
                      path: null,
                      line: null,
                      author: { login: "review-bot" },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  };
  const threads = parseReviewThreads([response]);
  expect(threads).toHaveLength(2);
  expect(threads.map((thread) => thread.isAutomatedReview)).toEqual([true, true]);
  expect(threads.map((thread) => thread.automatedReviewPasses)).toEqual([3, 3]);
});

describe("context and stack discovery", () => {
  it("returns a fully explicit context without any reader call", async () => {
    const reader = fakeReader();
    expect(
      await resolveContext({
        reader,
        owner: "explicit",
        repo: "repo",
        pr: context.number,
      })
    ).toEqual({ owner: "explicit", repo: "repo", number: context.number });
    expect(reader.calls).toEqual([]);
  });

  it("uses the local origin before currentPr for an explicit number", async () => {
    const reader = fakeReader({ origin: { owner: "local", repo: "checkout" } });
    expect(
      await resolveContext({
        reader,
        owner: null,
        repo: null,
        pr: context.number,
      })
    ).toEqual({ owner: "local", repo: "checkout", number: context.number });
    expect(reader.calls).toEqual(["originRepo"]);
  });

  it("orders the connected stack bottom-to-top", () => {
    const ordered = orderStack(context, [
      {
        number: parsePrNumber(41),
        headRefName: "base-feature",
        baseRefName: "main",
        isCrossRepository: false,
      },
      {
        number: context.number,
        headRefName: "feature",
        baseRefName: "base-feature",
        isCrossRepository: false,
      },
      {
        number: parsePrNumber(43),
        headRefName: "upstack",
        baseRefName: "feature",
        isCrossRepository: false,
      },
    ]);
    expect(ordered.map((item) => Number(item.number))).toEqual([41, 42, 43]);
  });

  it("rejects a cyclic base graph in a bounded real process", () => {
    const source = `import { orderStack, WatcherQueryError } from ${JSON.stringify(join(import.meta.dir, "github.ts"))};
try {
  orderStack({ owner: "owner", repo: "repo", number: 1 }, [
    { number: 1, headRefName: "one", baseRefName: "two", isCrossRepository: false },
    { number: 2, headRefName: "two", baseRefName: "one", isCrossRepository: false },
  ]);
  process.exit(1);
} catch (error) {
  if (!(error instanceof WatcherQueryError) || error.failure.retryable || error.failure.kind !== "invalid-stack") process.exit(2);
}`;
    const child = Bun.spawnSync([process.execPath, "--eval", source], { timeout: 1_000 });
    expect(child.exitCode).toBe(0);
  });
});

it("includes unresolved review threads after the first hundred records", () => {
  const thread = (id: string, resolved: boolean) => ({ id, isResolved: resolved, comments: { nodes: [] } });
  const first = { data: { repository: { pullRequest: { reviewThreads: {
    nodes: Array.from({ length: 100 }, (_, index) => thread(`resolved-${index}`, true)),
    pageInfo: { hasNextPage: true, endCursor: "next" },
  } } } } };
  const second = { data: { repository: { pullRequest: { reviewThreads: {
    nodes: [thread("late-blocker", false)], pageInfo: { hasNextPage: false, endCursor: null },
  } } } } };
  expect(parseReviewThreads([first, second])).toMatchObject([{ id: "late-blocker" }]);
  expect(() => parseReviewThreads([first])).toThrow("incomplete or repeated pagination");
});

it("reads open PRs beyond the old three-hundred limit and rejects incomplete page sets", () => {
  const pages = Array.from({ length: 4 }, (_, page) => ({ data: { repository: { pullRequests: {
    pageInfo: { hasNextPage: page < 3, endCursor: page < 3 ? `page-${page + 1}` : null },
    nodes: Array.from({ length: page < 3 ? 100 : 1 }, (_, index) => ({
      number: page * 100 + index + 1,
      headRefName: `feature-${page * 100 + index + 1}`,
      baseRefName: "main",
      isCrossRepository: false,
    })),
  } } } }));
  const prs = parseOpenPullRequests(pages);
  expect(prs).toHaveLength(301);
  expect(prs.at(-1)?.number).toBe(parsePrNumber(301));
  expect(() => parseOpenPullRequests(pages.slice(0, 3))).toThrow("incomplete or repeated pagination");
  expect(() => parseOpenPullRequests([])).toThrow("must contain a response");
});

it("never treats a fork PR as a parent but keeps it as a child of a stack PR", () => {
  const page = { data: { repository: { pullRequests: {
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [
      { number: 10, headRefName: "feat-a", baseRefName: "main", isCrossRepository: false },
      { number: 11, headRefName: "feat-b", baseRefName: "feat-a", isCrossRepository: false },
      { number: 99, headRefName: "main", baseRefName: "main", isCrossRepository: true },
      { number: 98, headRefName: "main", baseRefName: "develop", isCrossRepository: true },
      { number: 97, headRefName: "feat-a", baseRefName: "feat-b", isCrossRepository: true },
    ],
  } } } };
  const prs = parseOpenPullRequests([page]);
  expect(prs.map((pr) => Number(pr.number))).toEqual([10, 11, 99, 98, 97]);
  const ordered = orderStack({ owner: "owner", repo: "repo", number: parsePrNumber(10) }, prs);
  expect(ordered.map((item) => Number(item.number))).toEqual([10, 11, 97]);
  const fromFork = orderStack({ owner: "owner", repo: "repo", number: parsePrNumber(97) }, prs);
  expect(fromFork.map((item) => Number(item.number))).toEqual([10, 11, 97]);
});
