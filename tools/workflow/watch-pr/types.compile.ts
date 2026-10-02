import { parsePrNumber } from "./types.ts";
import type {
  CiClean,
  GitHubMergeAllowed,
  PrContext,
  ReadyPr,
  TerminalVerdict,
} from "./types.ts";

type ReadyVerdict = Extract<TerminalVerdict, { readonly kind: "READY" }>;

const context = {
  owner: "octocat",
  repo: "hello-world",
  number: parsePrNumber(123),
} satisfies PrContext;
const cleanCi = {
  kind: "ci-clean",
  source: "graphql-rollup",
  sourceOid: "head",
  all: [
    {
      kind: "passed",
      name: "ci",
      reportedState: "SUCCESS",
      description: "",
      link: "",
      workflow: "",
    },
  ],
  failed: [],
  pending: [],
  hadPreviousPassingCi: false,
  github: {
    kind: "allowed",
    basis: "merge-state",
    mergeStateStatus: "CLEAN",
    headRollupState: "SUCCESS",
  },
} satisfies CiClean;
const readyPr = {
  kind: "ready-pr",
  context,
  headRefOid: "head",
  proof: {
    mergeability: "clear",
    threads: [],
    ci: cleanCi,
    gate: {
      state: "OPEN",
      reviewDecision: "APPROVED",
      draft: "not-draft",
    },
  },
} satisfies ReadyPr;
const ready = {
  schemaVersion: 1,
  sequence: 1,
  observedAt: "2026-07-26T00:00:00.000Z",
  mode: "single",
  kind: "READY",
  terminal: true,
  exitCode: 0,
  scope: { kind: "single", pr: readyPr },
} satisfies ReadyVerdict;

void ready;

// PR 179929's shape. Each assertion below stays a single short statement so a
// reformat cannot drift the directive away from the line that actually errors.
const refused = {
  kind: "allowed",
  basis: "merge-state",
  mergeStateStatus: "BLOCKED",
  headRollupState: "FAILURE",
} as const;

// @ts-expect-error BLOCKED is a refusal regardless of its rollup.
const refusalIsNotAllowed: GitHubMergeAllowed = refused;

// @ts-expect-error CI cannot be clean while GitHub refuses the merge.
const refusalIsNotClean: CiClean = { ...cleanCi, github: refused };

const blockedPassing = { ...cleanCi.github, mergeStateStatus: "BLOCKED" } as const;
// @ts-expect-error Passing CI cannot turn a blocked merge into an allowance.
const blockedPassingIsNotAllowed: GitHubMergeAllowed = blockedPassing;

const unknownMerge = { ...cleanCi.github, mergeStateStatus: "UNKNOWN" } as const;
// @ts-expect-error Undetermined mergeability cannot prove merge clearance.
const unknownIsNotAllowed: GitHubMergeAllowed = unknownMerge;

const requiredReview = {
  ...readyPr.proof.gate,
  reviewDecision: "REVIEW_REQUIRED",
} as const;
const reviewRequiredPr = {
  ...readyPr,
  proof: { ...readyPr.proof, gate: requiredReview },
};
// @ts-expect-error READY cannot carry a required review gate.
const reviewRequiredIsNotReady: ReadyPr = reviewRequiredPr;

// @ts-expect-error READY cannot carry the failing-checks exit code.
const readyWithBlockerExit: ReadyVerdict = { ...ready, exitCode: 4 };

const unprovenPr = { kind: "ready-pr", context, headRefOid: "head" } as const;

// @ts-expect-error An open READY row must carry positive readiness proof.
const readyWithoutProof: ReadyPr = unprovenPr;

const { headRefOid: observedHead, ...headlessPr } = readyPr;
// @ts-expect-error READY must retain the observed head identity.
const readyWithoutHead: ReadyPr = headlessPr;
// @ts-expect-error READY cannot carry an unavailable head.
const readyWithNullHead: ReadyPr = { ...readyPr, headRefOid: null };

void refusalIsNotAllowed;
void refusalIsNotClean;
void blockedPassingIsNotAllowed;
void unknownIsNotAllowed;
void reviewRequiredIsNotReady;
void readyWithBlockerExit;
void readyWithoutProof;
void observedHead;
void readyWithoutHead;
void readyWithNullHead;
