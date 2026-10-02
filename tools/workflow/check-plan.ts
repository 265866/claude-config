#!/usr/bin/env bun
import { readFile } from "node:fs/promises";

export interface PlanProblem {
  readonly line: number;
  readonly message: string;
}

interface Section {
  readonly line: number;
  readonly title: string;
  readonly body: readonly { readonly line: number; readonly text: string; readonly code: boolean }[];
}

const HEADINGS = ["Goal", "Phases", "Verification", "Decisions", "Completion"];
const COLUMNS = ["phase", "owner", "depends on", "check", "status"];
const STATUSES = new Set(["pending", "running", "blocked", "done"]);

function cells(row: string): readonly string[] {
  return row.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function filled(value: string): boolean {
  return value.length > 0 && !/^(?:-|tbd|todo|<[^>]+>)$/i.test(value);
}

export function validatePlan(contents: string): readonly PlanProblem[] {
  const problems: PlanProblem[] = [];
  const sections: Section[] = [];
  let body: { line: number; text: string; code: boolean }[] = [];
  let fence: { marker: string; length: number } | null = null;
  let hasTitle = false;
  let frontmatter = contents.split(/\r?\n/, 1)[0] === "---";
  const lines = contents.split(/\r?\n/);

  for (const [index, text] of lines.entries()) {
    const line = index + 1;
    if (frontmatter) {
      if (index > 0 && text === "---") frontmatter = false;
      continue;
    }
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (marker !== null && fence === null) {
      fence = { marker: marker[1]?.[0] ?? "`", length: marker[1]?.length ?? 3 };
      continue;
    }
    if (fence !== null) {
      if (marker !== null && marker[1]?.[0] === fence.marker &&
          (marker[1]?.length ?? 0) >= fence.length && marker[2]?.trim() === "") {
        fence = null;
      } else body.push({ line, text, code: true });
      continue;
    }
    if (/^#\s+\S/.test(text)) hasTitle = true;
    const heading = /^##\s+(.+?)\s*$/.exec(text)?.[1];
    if (heading !== undefined) {
      body = [];
      sections.push({ line, title: heading, body });
    } else {
      body.push({ line, text, code: false });
    }
  }
  if (frontmatter) problems.push({ line: 1, message: "unclosed frontmatter" });
  if (fence !== null) problems.push({ line: lines.length, message: "unclosed code fence" });
  if (!hasTitle) problems.push({ line: 1, message: "a nonempty H1 title is required" });

  for (const heading of HEADINGS) {
    const matching = sections.filter((section) => section.title === heading);
    if (matching.length !== 1) {
      problems.push({ line: matching[0]?.line ?? 1, message: `exactly one ## ${heading} section is required` });
      continue;
    }
    const section = matching[0];
    if (section !== undefined && !section.body.some((item) => filled(item.text.trim()))) {
      problems.push({ line: section.line, message: `${heading} needs substantive content` });
    }
  }

  const phases = sections.find((section) => section.title === "Phases");
  if (phases === undefined) return problems;
  const start = phases.body.findIndex((item) => !item.code && item.text.trim().startsWith("|"));
  const rows: Section["body"][number][] = [];
  for (const item of phases.body.slice(start)) {
    if (item.code || !item.text.trim().startsWith("|")) break;
    const previous = rows.at(-1);
    if (previous !== undefined && item.line !== previous.line + 1) break;
    rows.push(item);
  }
  const header = rows[0];
  if (header === undefined || cells(header.text).map((cell) => cell.toLowerCase()).join("|") !== COLUMNS.join("|")) {
    problems.push({ line: phases.line, message: "Phases requires Phase | Owner | Depends on | Check | Status columns in that order" });
    return problems;
  }
  const separator = rows[1];
  if (phases.body.slice(start + rows.length).some((item) => !item.code && item.text.trim().startsWith("|"))) {
    problems.push({ line: phases.line, message: "Phases must use one contiguous Markdown table" });
  }
  if (separator === undefined || cells(separator.text).length !== COLUMNS.length ||
      !cells(separator.text).every((cell) => /^:?-{3,}:?$/.test(cell))) {
    problems.push({ line: separator?.line ?? phases.line, message: "Phases table requires a Markdown separator row" });
    return problems;
  }
  if (rows.length < 3) problems.push({ line: phases.line, message: "Phases needs at least one work phase" });
  const seen = new Set<string>();
  for (const row of rows.slice(2)) {
    const values = cells(row.text);
    if (values.length !== COLUMNS.length) {
      problems.push({ line: row.line, message: "phase row must have five cells; escape literal pipes as \\|" });
      continue;
    }
    const [phase = "", owner = "", dependencies = "", check = "", status = ""] = values;
    for (const [label, value] of [["Phase", phase], ["Owner", owner], ["Check", check]] as const) {
      if (!filled(value)) problems.push({ line: row.line, message: `${label} must name a concrete value` });
    }
    if (seen.has(phase)) problems.push({ line: row.line, message: `duplicate phase ${phase}` });
    if (!STATUSES.has(status.toLowerCase())) {
      problems.push({ line: row.line, message: "Status must be pending, running, blocked, or done" });
    }
    if (!dependencies) {
      problems.push({ line: row.line, message: "Depends on must name earlier phases or none" });
    } else if (dependencies.toLowerCase() !== "none") {
      for (const dependency of dependencies.split(",").map((value) => value.trim())) {
        if (!seen.has(dependency)) problems.push({ line: row.line, message: `dependency ${dependency || "(empty)"} is not an earlier phase` });
      }
    }
    seen.add(phase);
  }
  return problems;
}

export async function main(args: readonly string[]): Promise<number> {
  if (args.length !== 1) {
    console.error("Usage: bun check-plan.ts <plan.md>");
    return 2;
  }
  const file = args[0];
  if (file === undefined) return 2;
  try {
    const problems = validatePlan(await readFile(file, "utf8"));
    for (const problem of problems) console.error(`${file}:${problem.line}: ${problem.message}`);
    console.log(`${problems.length} plan problems`);
    return problems.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
