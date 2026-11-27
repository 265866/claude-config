import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "price-ladder.ts");

function run(args: string[], cwd = tmpdir()) {
  const p = Bun.spawnSync(["bun", script, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

interface Row {
  label: string;
  quoted: number;
  minimum: number;
  room: number;
}

function ladder(args: string[], cwd?: string) {
  const r = run([...args, "--json"], cwd);
  expect(r.code).toBe(0);
  const out = JSON.parse(r.out);
  return { ...out, rows: (out.tiers as Row[]).map((t) => [t.label, t.quoted, t.minimum]) };
}

describe("acceptance cases, pace unknown", () => {
  test("100 cases at $30, cost $18, from the script folder and from another directory", () => {
    for (const cwd of [import.meta.dir, tmpdir()]) {
      const r = ladder(["--list", "30", "--cost", "18", "--units", "100"], cwd);
      expect(r.rows).toEqual([
        ["1", 30, 30],
        ["10+", 28, 26],
        ["30+", 27, 25],
        ["All", 25, 23],
      ]);
      expect(r.listingLines).toEqual(["• 10+ = $28 ea", "• 30+ = $27 ea", "• All = $25 ea"]);
      expect(r.halt).toBeNull();
    }
  });

  test("390 cases at $30, cost $15", () => {
    expect(ladder(["--list", "30", "--cost", "15", "--units", "390"]).rows).toEqual([
      ["1", 30, 30],
      ["10+", 29, 27],
      ["30+", 27, 25],
      ["100+", 25, 23],
      ["All", 24, 21],
    ]);
  });

  test("3 machines at $300, cost $200", () => {
    expect(ladder(["--list", "300", "--cost", "200", "--units", "3"]).rows).toEqual([
      ["1", 300, 296],
      ["2", 286, 279],
      ["All 3", 280, 270],
    ]);
  });

  test("3 Henry pails at $210, cost unknown, anchor $381", () => {
    const r = ladder(["--list", "210", "--units", "3", "--retail", "381"]);
    expect(r.rows).toEqual([
      ["1", 210, 210],
      ["2", 203, 200],
      ["All 3", 199, 194],
    ]);
    expect(r.tiers[0].marginAtQuoted).toBeNull();
  });

  test("a firm $1,350 GPU gets one price and no tiers", () => {
    const r = ladder(["--list", "1350", "--cost", "1000", "--units", "1", "--firm"]);
    expect(r.rows).toEqual([["1", 1350, 1350]]);
    expect(r.listingLines).toEqual([]);
  });

  test("a single unit still gets its minimum and the cost check", () => {
    const r = ladder(["--list", "500", "--cost", "300", "--units", "1"]);
    expect(r.rows).toEqual([["1", 500, 475]]);
    expect(r.firstDiscounted).toEqual({ quantity: 1, minimum: 475 });
    expect(ladder(["--list", "30", "--cost", "31", "--units", "1"]).halt).toContain("at or below cost");
  });
});

describe("review findings", () => {
  test("3: a floor above the list is rejected", () => {
    const r = run(["--list", "24", "--original-list", "30", "--floor", "26", "--units", "70"]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("--floor $26 is above --list $24");
    expect(run(["--list", "30", "--original-list", "28", "--units", "70"]).err).toContain("--original-list $28 is below --list $30");
  });

  test("3: at the locked floor the ladder is one flat price", () => {
    const r = ladder(["--list", "24", "--original-list", "30", "--floor", "24", "--cost", "18", "--units", "70", "--pace", "10"]);
    expect(r.rows).toEqual([["1", 24, 24]]);
  });

  test("5: every bulk tier keeps at least $2 of room, or is left out", () => {
    expect(ladder(["--list", "30", "--units", "390", "--retail", "200"]).listingLines).toEqual([]);
    for (const args of [
      ["--list", "30", "--units", "390"],
      ["--list", "26", "--original-list", "30", "--floor", "24", "--cost", "18", "--units", "70", "--pace", "10"],
      ["--list", "15", "--units", "100"],
      ["--list", "100", "--cost", "80", "--units", "40", "--retail", "140"],
    ]) {
      for (const t of ladder(args).tiers.slice(1) as Row[]) expect(t.room).toBeGreaterThanOrEqual(2);
    }
  });

  test("6: --at prints the minimum at any quantity", () => {
    const r = ladder(["--list", "5", "--units", "200", "--at", "49,50", "--at", "200"]);
    expect(r.at.map((a: Row & { quantity: number }) => [a.quantity, a.quoted, a.minimum])).toEqual([
      [49, 5, 5],
      [50, 5, 4],
      [200, 5, 4],
    ]);
    expect(r.firstDiscounted).toEqual({ quantity: 50, minimum: 4 });
    expect(run(["--list", "5", "--units", "200", "--at", "201"]).code).toBe(1);
  });

  test("7: an ask above retail never goes past 30% off, and is flagged", () => {
    const r = ladder(["--list", "30", "--units", "390", "--retail", "20"]);
    const all = r.tiers.at(-1) as Row;
    expect(30 - all.minimum).toBeLessThanOrEqual(9);
    expect(r.warnings.join()).toContain("at or above the retail anchor");
  });

  test("9: cost that leaves no room is named, and negative margins print as -$", () => {
    expect(ladder(["--list", "30", "--cost", "29", "--units", "100"]).tiers[0].limit).toBe("cost");
    expect(run(["--list", "30", "--cost", "35", "--units", "1"]).out).toContain("-$5");
  });

  test("10: hex, exponent, and negative numbers are rejected with a clear message", () => {
    for (const [flag, value] of [
      ["--list", "0x1E"],
      ["--list", "1e1"],
      ["--list", "29.5"],
      ["--units", "2.5"],
      ["--cost", "-1"],
      ["--pace", "abc"],
    ] as const) {
      const args = ["--list", "30", "--units", "3"];
      const i = args.indexOf(flag);
      if (i >= 0) args[i + 1] = value;
      else args.push(flag, value);
      const r = run(args);
      expect(r.code).toBe(1);
      expect(r.err).toContain(`${flag} must be`);
      expect(r.err).toContain(`"${value}"`);
    }
    expect(ladder(["--list", "$1,350", "--units", "1", "--cost", "1,000.50"]).inputs).toMatchObject({ listPrice: 1350, unitCost: 1000.5 });
  });

  test("the table is the default output; JSON only with --json", () => {
    const r = run(["--list", "30", "--cost", "18", "--units", "100"]);
    expect(r.out).toContain("• All = $25 ea");
    expect(r.out).not.toContain("{");
  });
});
