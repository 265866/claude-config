// Quoted bulk ladder for a listing, and the minimum behind each tier for the negotiating agent.
// Run `bun price-ladder.ts --help` for the options.
import { parseArgs } from "node:util";
import {
  DEFAULT_KNOBS,
  type Item,
  type Limit,
  type MinPriceResult,
  minPriceTable,
  onsetQuantity,
  quoteLadder,
  tierLabels,
} from "./min-price.ts";

const USAGE = `Usage: bun price-ladder.ts --list <dollars> --units <count> [options]

  --list <dollars>           single-unit ask, whole dollars (required)
  --units <count>            units on hand, whole number (required)
  --cost <dollars>           all-in cost per unit; omit when unknown
  --retail <dollars>         retail anchor including tax; omit when unknown
  --pace <units per week>    expected sales pace; omit when unknown
  --firm                     price is firm: no tiers, no haggling
  --original-list <dollars>  first posted ask, once weekly drops have lowered --list
  --floor <dollars>          the All minimum from the first run, before any drop; it is locked
                             when drops start, and the tiers disappear once --list reaches it
  --at <q[,q...]>            also print the quote and minimum at these quantities (repeatable)
  --json                     print JSON instead of the table`;

const money = (x: number) => `${x < 0 ? "-" : ""}$${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function fail(message: string): never {
  console.error(`price-ladder: ${message}\n\n${USAGE}`);
  process.exit(1);
}

const VALUE_FLAGS = ["--list", "--units", "--cost", "--retail", "--pace", "--original-list", "--floor", "--at"];

function parseInput(argv: string[]): { item: Item; costKnown: boolean; at: number[]; json: boolean } {
  // parseArgs reads "--cost -1" as a missing value; join it so the number check below reports it.
  const args: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];
    if (VALUE_FLAGS.includes(a) && next !== undefined && next.startsWith("-") && !next.startsWith("--")) {
      args.push(`${a}=${next}`);
      i++;
    } else args.push(a);
  }
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        list: { type: "string" },
        units: { type: "string" },
        cost: { type: "string" },
        retail: { type: "string" },
        pace: { type: "string" },
        firm: { type: "boolean" },
        "original-list": { type: "string" },
        floor: { type: "string" },
        at: { type: "string", multiple: true },
        json: { type: "boolean" },
        help: { type: "boolean" },
      },
      strict: true,
    }).values;
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  if (parsed.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const DECIMAL = /^\d+(\.\d+)?$/;
  const WHOLE = /^\d+$/;
  const num = (name: string, raw: string | undefined, pattern: RegExp, positive: boolean, rule: string): number | undefined => {
    if (raw === undefined) return undefined;
    const text = raw.trim().replace(/^\$/, "").replace(/,/g, "");
    const x = Number(text);
    if (!pattern.test(text) || (positive && x <= 0)) fail(`--${name} must be ${rule}, got "${raw}"`);
    return x;
  };
  const dollars = (name: string, raw: string | undefined) => num(name, raw, WHOLE, true, "a positive whole-dollar amount");
  const listPrice = dollars("list", parsed.list);
  const unitsOnHand = num("units", parsed.units, WHOLE, true, "a positive whole number");
  if (listPrice === undefined) fail("--list is required");
  if (unitsOnHand === undefined) fail("--units is required");
  const unitCost = num("cost", parsed.cost, DECIMAL, false, "zero or more, like 18 or 18.50");
  const originalListPrice = dollars("original-list", parsed["original-list"]);
  const priceFloor = dollars("floor", parsed.floor);
  if (priceFloor !== undefined && priceFloor > listPrice) {
    fail(`--floor ${money(priceFloor)} is above --list ${money(listPrice)}; drops stop at the floor, so --list cannot be under it`);
  }
  if (originalListPrice !== undefined && originalListPrice < listPrice) {
    fail(`--original-list ${money(originalListPrice)} is below --list ${money(listPrice)}; it is the first ask, before any drop`);
  }
  const at = (parsed.at ?? [])
    .flatMap((v) => v.split(","))
    .map((v) => {
      const q = num("at", v, WHOLE, true, `whole quantities from 1 to ${unitsOnHand}`)!;
      if (q > unitsOnHand) fail(`--at ${q} is more than the ${unitsOnHand} on hand`);
      return q;
    });
  const item: Item = {
    listPrice,
    unitsOnHand,
    unitCost: unitCost ?? 0,
    retailAnchor: num("retail", parsed.retail, DECIMAL, true, "a positive amount"),
    unitsPerWeek: num("pace", parsed.pace, DECIMAL, true, "a positive number of units per week"),
    firm: parsed.firm ?? false,
    originalListPrice,
    priceFloor,
  };
  return { item, costKnown: unitCost !== undefined, at: [...new Set(at)].sort((a, b) => a - b), json: parsed.json ?? false };
}

function limitText(limit: Limit): string {
  const k = DEFAULT_KNOBS;
  switch (limit) {
    case "firm":
      return "firm price";
    case "belowOnset":
      return `no discount: the order is too small (discounts start at ${money(k.onsetSpend)} at list)`;
    case "pace":
      return `curve to the whole-pile price set by sales pace (a waiting week costs ${Math.round(k.weeklyTimeCost * 100)}%)`;
    case "pileSize":
      return "curve to the whole-pile price set by pile size (pace unknown)";
    case "maxDiscount":
      return `curve to the whole-pile price, capped at ${Math.round(k.maxDiscount * 100)}% off list (less when the ask is under ${Math.round(
        k.normalAskShare * 100,
      )}% of retail)`;
    case "profitShare":
      return `curve to the whole-pile price, capped at ${Math.round(k.maxProfitShare * 100)}% of the profit per unit`;
    case "postedLadder":
      return "price already posted";
    case "cost":
      return "first whole dollar above cost";
    case "refund":
      return "return refund";
    case "lockedFloor":
      return "locked whole-pile floor";
    default: {
      const _exhaustive: never = limit;
      return _exhaustive;
    }
  }
}

function build(item: Item, costKnown: boolean, atQuantities: number[]) {
  const tiers = quoteLadder(item);
  const labels = tierLabels(tiers);
  const C = item.unitCost;
  const N = item.unitsOnHand;
  const margin = (price: number) =>
    costKnown ? { dollars: Math.round((price - C) * 100) / 100, percent: Math.round(((price - C) / price) * 100) } : null;
  const onset = onsetQuantity(item);
  const fromOnset = onset === undefined ? [] : Array.from({ length: N - onset + 1 }, (_, i) => onset + i);
  const [all] = minPriceTable({ item, quantities: [N] });
  const firstDiscounted = minPriceTable({ item, quantities: fromOnset }).find((r) => r.minimum < item.listPrice);
  const row = (r: MinPriceResult) => ({
    quantity: r.quantity,
    quoted: r.quoted,
    minimum: r.minimum,
    room: r.quoted - r.minimum,
    marginAtQuoted: margin(r.quoted),
    marginAtMinimum: margin(r.minimum),
    limit: r.limit,
    limitText: limitText(r.limit),
  });
  const warnings: string[] = [];
  if (item.retailAnchor !== undefined && item.listPrice >= item.retailAnchor) {
    warnings.push(
      `the ask ${money(item.listPrice)} is at or above the retail anchor ${money(item.retailAnchor)}: check the anchor or lower the ask`,
    );
  }
  return {
    inputs: {
      listPrice: item.listPrice,
      unitCost: costKnown ? C : null,
      retailAnchor: item.retailAnchor ?? null,
      unitsOnHand: N,
      unitsPerWeek: item.unitsPerWeek ?? null,
      firm: item.firm ?? false,
      originalListPrice: item.originalListPrice ?? null,
      priceFloor: item.priceFloor ?? null,
    },
    halt: costKnown && item.listPrice <= C ? `the single-unit ask ${money(item.listPrice)} is at or below cost ${money(C)}` : null,
    warnings,
    firstDiscounted: firstDiscounted ? { quantity: firstDiscounted.quantity, minimum: firstDiscounted.minimum } : null,
    /** Per-unit minimum for the whole pile: the --floor to pass once weekly drops start. */
    wholePileMinimum: all!.minimum,
    tiers: tiers.map((t, i) => ({
      label: labels[i]!,
      minQty: t.minQty,
      all: t.all,
      quoted: t.price,
      minimum: t.minimum,
      room: t.room,
      marginAtQuoted: margin(t.price),
      marginAtMinimum: margin(t.minimum),
      limit: t.limit,
      limitText: limitText(t.limit),
    })),
    listingLines: tiers.slice(1).map((t, i) => `• ${labels[i + 1]} = ${money(t.price)} ea`),
    at: minPriceTable({ item, quantities: atQuantities }).map(row),
    totals: {
      pileCost: costKnown ? Math.round(C * N * 100) / 100 : null,
      allAtQuoted: all!.quoted * N,
      allAtMinimum: all!.total,
    },
    knobs: DEFAULT_KNOBS,
  };
}

type Report = ReturnType<typeof build>;
type Margin = { dollars: number; percent: number } | null;

function grid(header: string[], rows: string[][]): string[] {
  const widths = header.map((h, c) => Math.max(h.length, ...rows.map((row) => row[c]!.length)));
  const line = (cells: string[]) =>
    cells
      .map((cell, c) => cell.padEnd(widths[c]!))
      .join("  ")
      .trimEnd();
  return [line(header), ...rows.map(line)];
}

function table(r: Report): string {
  const i = r.inputs;
  const facts = [
    `list ${money(i.listPrice)}`,
    i.unitCost === null ? "cost unknown" : `cost ${money(i.unitCost)}`,
    i.retailAnchor === null ? "retail anchor unknown" : `retail anchor ${money(i.retailAnchor)}`,
    `${i.unitsOnHand} on hand`,
    i.unitsPerWeek === null ? "pace unknown" : `${i.unitsPerWeek}/week`,
    ...(i.firm ? ["firm"] : []),
    ...(i.originalListPrice !== null ? [`first listed at ${money(i.originalListPrice)}`] : []),
    ...(i.priceFloor !== null ? [`floor locked at ${money(i.priceFloor)}`] : []),
  ];
  const pct = (m: Margin) => (m === null ? "-" : `${money(m.dollars)} (${m.percent}%)`);
  const out = [`Item: ${facts.join(" · ")}`];
  if (r.halt) out.push(`HALT: ${r.halt}.`);
  for (const w of r.warnings) out.push(`WARNING: ${w}.`);
  const fd = r.firstDiscounted;
  out.push(
    i.firm
      ? "Firm: one price for every quantity."
      : i.priceFloor !== null && i.priceFloor >= i.listPrice
        ? `At the locked floor: every quantity pays ${money(i.listPrice)}.`
        : fd === null
          ? "No discount at any quantity."
          : `The minimum first drops below list at ${fd.quantity} unit${fd.quantity === 1 ? "" : "s"}, to ${money(fd.minimum)}.`,
    "",
  );
  const head = ["Quoted ea", "Minimum ea", "Room", "Margin at quote", "Margin at minimum", "Minimum set by"];
  const cells = (t: {
    quoted: number;
    minimum: number;
    room: number;
    marginAtQuoted: Margin;
    marginAtMinimum: Margin;
    limitText: string;
  }) => [money(t.quoted), money(t.minimum), t.room > 0 ? money(t.room) : "-", pct(t.marginAtQuoted), pct(t.marginAtMinimum), t.limitText];
  out.push(
    ...grid(
      ["Tier", ...head],
      r.tiers.map((t) => [t.label, ...cells(t)]),
    ),
    "",
  );
  if (r.at.length)
    out.push(
      ...grid(
        ["Qty", ...head],
        r.at.map((a) => [String(a.quantity), ...cells(a)]),
      ),
      "",
    );
  out.push(
    r.listingLines.length
      ? ["Bulk Discounts lines for the listing:", ...r.listingLines].join("\n")
      : "No bulk tiers: leave the Bulk Discounts block out.",
  );
  const t = r.totals;
  out.push(
    "",
    [
      t.pileCost === null ? null : `pile cost ${money(t.pileCost)}`,
      `all at the quoted price ${money(t.allAtQuoted)}`,
      `all at the minimum ${money(t.allAtMinimum)}`,
    ]
      .filter((x) => x !== null)
      .join(" · "),
  );
  if (!i.firm) out.push(`Whole-pile minimum: ${money(r.wholePileMinimum)} ea (the --floor once weekly drops start).`);
  if (i.unitCost === null) out.push("Cost unknown: margins are not shown and the minimums are not checked against cost.");
  return out.join("\n");
}

const { item, costKnown, at, json } = parseInput(process.argv.slice(2));
let report: Report;
try {
  report = build(item, costKnown, at);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
console.log(json ? JSON.stringify(report, null, 2) : table(report));
