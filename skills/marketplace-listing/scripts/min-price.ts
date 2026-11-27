// Marketplace pricing: the quoted bulk ladder a listing shows and the minimum per-unit price the
// negotiating agent accepts for q units. Both come from one formula.
// Pure functions, no dependencies. Every price in and out is whole dollars.

/** Quoted tier: every quantity >= minQty is quoted `price` per unit. */
export interface LadderTier {
  minQty: number;
  price: number;
}

/** The six seller-tunable knobs. */
export interface Knobs {
  /** Order size at list price, in dollars, below which nobody gets a discount. */
  onsetSpend: number;
  /** What one more week of the pile sitting costs, as a fraction of price. Also the weekly drop, as a fraction of the original list. */
  weeklyTimeCost: number;
  /** The most the minimum may sit below the list price, as a fraction, for an ask at the normal share of retail. */
  maxDiscount: number;
  /** The most of the per-unit profit (list minus cost) any buyer can get off. */
  maxProfitShare: number;
  /** The usual ask as a share of the retail anchor; an ask further under retail gets proportionally less room. */
  normalAskShare: number;
  /** Share of each bulk tier's discount (list minus minimum) the listing holds back for haggling. The quote shows the rest, and sits at least $2 above the minimum when the price allows. */
  bargainingRoom: number;
}

export const DEFAULT_KNOBS: Readonly<Knobs> = {
  onsetSpend: 250,
  weeklyTimeCost: 0.05,
  maxDiscount: 0.3,
  maxProfitShare: 0.6,
  normalAskShare: 0.75,
  bargainingRoom: 1 / 3,
};

export interface Returnability {
  daysLeft: number;
  /** Refund per unit; defaults to unitCost. */
  refundPerUnit?: number | undefined;
  /** Trip and hassle per unit returned; defaults to 0. */
  returnCostPerUnit?: number | undefined;
}

export interface Item {
  /** Current single-unit ask P, whole dollars. */
  listPrice: number;
  /** List price when first posted, whole dollars, at or above listPrice; the onset is measured against it so a price drop never moves it. Defaults to listPrice. */
  originalListPrice?: number | undefined;
  /** All-in cost per unit (price paid plus sales tax), C. */
  unitCost: number;
  /** Units on hand now, N. */
  unitsOnHand: number;
  /** Retail anchor R: MSRP or store price including tax. Omit when unknown. */
  retailAnchor?: number | undefined;
  /** A ladder already posted by hand. The minimum never goes above it. Omit it and the quote comes from quoteLadder. */
  ladder?: LadderTier[] | undefined;
  firm?: boolean | undefined;
  /** Expected units sold per week at the current ladder. Omit when unknown. */
  unitsPerWeek?: number | undefined;
  /** Scheduled weekly drop of the list price, as a fraction of the current list. */
  weeklyPriceDrop?: number | undefined;
  /** The whole-pile minimum from the first pricing, before any drop, locked once weekly drops start; no minimum goes under it. Whole dollars, at or below listPrice. */
  priceFloor?: number | undefined;
  /** Present while the pile can still go back to the store. */
  returnable?: Returnability | undefined;
}

/** belowOnset: the order is too small for any discount, under the onset or with a curve discount under $1. */
export type Binding = "firm" | "belowOnset" | "curve" | "ladder" | "floor";

/** The specific limit that set a minimum: a finer reading of Binding. */
export type Limit =
  | "firm"
  | "belowOnset"
  /** Curve, with the whole-pile depth set by sales pace (the time model). */
  | "pace"
  /** Curve, with the whole-pile depth set by pile size because pace is unknown. */
  | "pileSize"
  /** Curve, with the whole-pile depth capped at maxDiscount (scaled by MSRP headroom). */
  | "maxDiscount"
  /** Curve, with the whole-pile depth capped at maxProfitShare of the profit per unit. */
  | "profitShare"
  | "postedLadder"
  /** Floor: the first whole dollar above cost. */
  | "cost"
  /** Floor: the net refund while the pile is returnable. */
  | "refund"
  /** Floor: the whole-pile minimum locked when drops reached it. */
  | "lockedFloor";

export interface MinPriceResult {
  quantity: number;
  listPrice: number;
  quoted: number;
  minimum: number;
  /** quantity × minimum. */
  total: number;
  /** listPrice − minimum. */
  offListPerUnit: number;
  /** quantity × (listPrice − minimum): what the buyer saves against list at the minimum. */
  offListTotal: number;
  /** True when the order is big enough in dollars to earn a discount. */
  pastOnset: boolean;
  /** Discount the curve asks for at this quantity, as a fraction of P, before rounding, ladder, and floor. */
  curveDiscount: number;
  /** Lowest acceptable whole-dollar price given cost, refund value, and a locked floor. */
  hardFloor: number;
  profitPerUnit: number;
  binding: Binding;
  limit: Limit;
  warnings: string[];
}

export interface TakeAllDepth {
  /** Discount, as a fraction of P, the whole-pile buyer may get. */
  depth: number;
  source: "demand" | "fallback";
  /** Depth before the caps: the time model's answer, or the pile-size fallback. */
  modelDepth: number;
  /** min(maxDiscount × headroom, maxProfitShare × profit share of price). */
  cap: number;
  capBy: "maxDiscount" | "profitShare";
  /** Ask relative to the normal share of retail; 1 when the anchor is unknown. */
  headroom: number;
  weeksToClear?: number;
}

/** Pile size at which the no-data fallback reaches the full cap. */
const FALLBACK_FULL_DEPTH_PILE = 60;
const INTEGRATION_STEPS = 4000;
const EPS = 1e-9;

function tidy(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Smallest whole-dollar price strictly above `price`. */
function dollarAbove(price: number): number {
  return Math.floor(price + EPS) + 1;
}

/** Smallest whole-dollar price at or above `price`. */
function dollarAtLeast(price: number): number {
  return Math.ceil(price - EPS);
}

/** Quoted price for q units: the lowest tier the buyer qualifies for, never above the list price. */
export function ladderPrice(item: Item, q: number): number {
  let price = item.listPrice;
  for (const tier of item.ladder ?? []) {
    if (q >= tier.minQty) price = Math.min(price, tier.price);
  }
  return price;
}

const isDollars = (x: number) => Number.isInteger(x) && x > 0;

function validate(item: Item, knobs: Knobs): void {
  const bad = (msg: string) => {
    throw new RangeError(msg);
  };
  if (!isDollars(item.listPrice)) bad("listPrice must be a positive whole-dollar amount");
  if (!(item.unitCost >= 0 && Number.isFinite(item.unitCost))) bad("unitCost must be non-negative and finite");
  if (!Number.isInteger(item.unitsOnHand) || item.unitsOnHand < 1) bad("unitsOnHand must be a positive integer");
  if (item.retailAnchor !== undefined && !(item.retailAnchor > 0 && Number.isFinite(item.retailAnchor))) {
    bad("retailAnchor must be positive and finite when given");
  }
  if (item.unitsPerWeek !== undefined && !(item.unitsPerWeek > 0)) bad("unitsPerWeek must be positive when given");
  if (item.priceFloor !== undefined && !isDollars(item.priceFloor)) bad("priceFloor must be a positive whole-dollar amount");
  if (item.priceFloor !== undefined && item.priceFloor > item.listPrice) bad("priceFloor must be at or below listPrice: drops stop at the floor");
  if (item.originalListPrice !== undefined && !isDollars(item.originalListPrice)) bad("originalListPrice must be a positive whole-dollar amount");
  if (item.originalListPrice !== undefined && item.originalListPrice < item.listPrice) bad("originalListPrice must be at or above listPrice");
  const drop = item.weeklyPriceDrop ?? 0;
  if (!(drop >= 0 && drop < 1)) bad("weeklyPriceDrop must be in [0, 1)");
  for (const t of item.ladder ?? []) {
    if (!(Number.isInteger(t.minQty) && t.minQty >= 1)) bad("ladder minQty must be a positive integer");
    if (!isDollars(t.price)) bad("ladder prices must be positive whole-dollar amounts");
  }
  const r = item.returnable;
  if (r && !(Number.isFinite(r.daysLeft) && (r.refundPerUnit ?? 0) >= 0 && (r.returnCostPerUnit ?? 0) >= 0)) {
    bad("returnable needs a finite daysLeft and non-negative refund and return cost");
  }
  if (!(knobs.onsetSpend >= 0 && Number.isFinite(knobs.onsetSpend))) bad("onsetSpend must be non-negative and finite");
  if (!(knobs.weeklyTimeCost >= 0 && knobs.weeklyTimeCost < 1)) bad("weeklyTimeCost must be in [0, 1)");
  if (!(knobs.maxDiscount >= 0 && knobs.maxDiscount < 1)) bad("maxDiscount must be in [0, 1)");
  if (!(knobs.maxProfitShare >= 0 && knobs.maxProfitShare <= 1)) bad("maxProfitShare must be in [0, 1]");
  if (!(knobs.normalAskShare > 0 && knobs.normalAskShare <= 1)) bad("normalAskShare must be in (0, 1]");
  if (!(knobs.bargainingRoom >= 0 && knobs.bargainingRoom < 1)) bad("bargainingRoom must be in [0, 1)");
}

/** Per-week continuous decay rate implied by the time cost or the scheduled drop, whichever is larger. */
function decayRate(item: Item, knobs: Knobs): number {
  const g = Math.max(knobs.weeklyTimeCost, item.weeklyPriceDrop ?? 0);
  return -Math.log(1 - g);
}

/** Net refund per unit while the return window is still open. */
function refundValue(item: Item): number | undefined {
  const r = item.returnable;
  if (!r || r.daysLeft <= 0) return undefined;
  return (r.refundPerUnit ?? item.unitCost) - (r.returnCostPerUnit ?? 0);
}

/**
 * Average value, as a fraction of P, of the pile sold the slow way: one sale at a
 * time over weeksToClear, each unit worth P * e^(-k t) in today's money. While the
 * pile is returnable the seller can send back the slow tail before the deadline, so a
 * unit is worth the larger of its sale value and the net refund.
 */
export function normalCourseValue(item: Item, knobs: Knobs, weeksToClear: number): number {
  const P = item.listPrice;
  const k = decayRate(item, knobs);
  const V = refundValue(item);
  const dt = weeksToClear / INTEGRATION_STEPS;
  let total = 0;
  for (let i = 0; i < INTEGRATION_STEPS; i++) {
    const sell = P * Math.exp(-k * (i + 0.5) * dt);
    total += V === undefined ? sell : Math.max(sell, V);
  }
  return total / INTEGRATION_STEPS / P;
}

/** Ask relative to the normal share of retail, at most 1: an ask at or above that share, even above retail, never earns more than maxDiscount. */
export function headroom(item: Item, knobs: Knobs = DEFAULT_KNOBS): number {
  const R = item.retailAnchor;
  if (R === undefined) return 1;
  return Math.min(1, item.listPrice / (knobs.normalAskShare * R));
}

/** How far below P the minimum may go for the whole pile. */
export function takeAllDepth(item: Item, knobs: Knobs = DEFAULT_KNOBS): TakeAllDepth {
  validate(item, knobs);
  const P = item.listPrice;
  const N = item.unitsOnHand;
  const h = headroom(item, knobs);
  const priceCap = knobs.maxDiscount * h;
  const profitCap = P > item.unitCost ? (knobs.maxProfitShare * (P - item.unitCost)) / P : 0;
  const cap = Math.min(priceCap, profitCap);
  const capBy = profitCap < priceCap ? "profitShare" : "maxDiscount";
  if (item.unitsPerWeek === undefined) {
    const scale = Math.min(1, Math.log(N + 1) / Math.log(FALLBACK_FULL_DEPTH_PILE + 1));
    const modelDepth = priceCap * scale;
    return { depth: Math.min(cap, modelDepth), source: "fallback", modelDepth, cap, capBy, headroom: h };
  }
  const weeksToClear = N / item.unitsPerWeek;
  const modelDepth = 1 - normalCourseValue(item, knobs, weeksToClear);
  return { depth: Math.max(0, Math.min(cap, modelDepth)), source: "demand", modelDepth, cap, capBy, headroom: h, weeksToClear };
}

/** Lowest whole-dollar price the seller ever accepts: above cost, at least the refund, at least a locked floor. */
export function hardFloor(item: Item, knobs: Knobs = DEFAULT_KNOBS): number {
  validate(item, knobs);
  const V = refundValue(item);
  return Math.max(dollarAbove(item.unitCost), V === undefined ? 0 : dollarAtLeast(V), item.priceFloor ?? 0);
}

const onsetPrice = (item: Item) => item.originalListPrice ?? item.listPrice;

/** Smallest quantity whose order at the original list reaches onsetSpend, or undefined when even the whole pile does not. */
export function onsetQuantity(item: Item, knobs: Knobs = DEFAULT_KNOBS): number | undefined {
  validate(item, knobs);
  if (item.firm) return undefined;
  const q = Math.max(1, Math.ceil(knobs.onsetSpend / onsetPrice(item) - EPS));
  return q <= item.unitsOnHand ? q : undefined;
}

/**
 * Where a q-unit order sits between "no discount" (0) and "the whole pile" (1), measured
 * on a log scale of order dollars counted from the smaller of one unit's price and onsetSpend.
 * For an item cheaper than onsetSpend this is ln q / ln N; for a dearer one it is
 * ln(qP / S) / ln(NP / S), so a single expensive unit already sits part-way along.
 */
export function orderShare(item: Item, q: number, knobs: Knobs = DEFAULT_KNOBS): number {
  const P = item.listPrice;
  const N = item.unitsOnHand;
  if (q >= N) return 1;
  const base = knobs.onsetSpend > 0 ? Math.min(P, knobs.onsetSpend) : P;
  return Math.max(0, Math.log((q * P) / base) / Math.log((N * P) / base));
}

export interface MinPriceRequest {
  item: Item;
  quantity: number;
  knobs?: Knobs | undefined;
}

/** A tier of the quoted ladder, with the minimum behind it. */
export interface QuoteTier extends LadderTier {
  /** The take-everything tier: minQty is unitsOnHand. */
  all: boolean;
  /** Lowest per-unit price the agent accepts at minQty. Never shown in the listing. */
  minimum: number;
  /** price − minimum: what the agent can still give a buyer who haggles. */
  room: number;
  binding: Binding;
  limit: Limit;
}

/** Below this much room a meet-in-the-middle counter has no whole dollar between the quote and the minimum. */
const MIN_ROOM_DOLLARS = 2;
/** Numeric breaks after the first must leave the pile at least this many times larger, so `All` stays a real step. */
const ALL_STEP = 2;
const MAX_NUMERIC_BREAKS = 3;
const BREAK_GROWTH = 3;

/** Quantities buyers recognize: 2, 3, 5, 10, 20, 25, 30, 50, 100, 200, 250, 300, 500, 1000, ... */
function niceQuantities(upTo: number): number[] {
  const out: number[] = [];
  for (let decade = 1; decade <= upTo * 10; decade *= 10) {
    for (const step of [1, 2, 2.5, 3, 5]) {
      const v = step * decade;
      if (Number.isInteger(v) && v >= 2) out.push(v);
    }
  }
  return out;
}

/**
 * Numeric bulk breaks, smallest first, each under the pile. The first is the smallest recognizable
 * quantity at or above the onset (and at least 2); each later one is the recognizable quantity
 * nearest three times the one before, kept while the pile is still at least twice it.
 */
export function breakQuantities(item: Item, knobs: Knobs = DEFAULT_KNOBS): number[] {
  const onset = onsetQuantity(item, knobs);
  const N = item.unitsOnHand;
  if (onset === undefined) return [];
  const nice = niceQuantities(BREAK_GROWTH * N);
  const first = nice.find((v) => v >= Math.max(2, onset));
  if (first === undefined || first >= N) return [];
  const breaks = [first];
  while (breaks.length < MAX_NUMERIC_BREAKS) {
    const prev = breaks[breaks.length - 1]!;
    const target = BREAK_GROWTH * prev;
    const next = nice
      .filter((v) => v > prev)
      .reduce((best, v) => (Math.abs(Math.log(v / target)) < Math.abs(Math.log(best / target)) ? v : best));
    if (next * ALL_STEP > N) break;
    breaks.push(next);
  }
  return breaks;
}

interface Formula {
  minimum: number;
  discount: number;
  pastOnset: boolean;
  binding: Binding;
  limit: Limit;
}

/** Shared per-item state, so a ladder and a table of minimums integrate the time model once. */
function pricer(item: Item, knobs: Knobs) {
  validate(item, knobs);
  const P = item.listPrice;
  const N = item.unitsOnHand;
  const floor = hardFloor(item, knobs);
  const V = refundValue(item);
  const floorLimit: Limit =
    item.priceFloor === floor ? "lockedFloor" : V !== undefined && dollarAtLeast(V) === floor ? "refund" : "cost";
  const depth = item.firm ? undefined : takeAllDepth(item, knobs);
  const depthLimit: Limit =
    depth === undefined
      ? "firm"
      : depth.depth >= depth.cap - EPS
        ? depth.capBy
        : depth.source === "demand"
          ? "pace"
          : "pileSize";

  /** The minimum from the formula alone, ignoring any posted ladder. */
  const formula = (q: number): Formula => {
    if (depth === undefined) return { minimum: P, discount: 0, pastOnset: false, binding: "firm", limit: "firm" };
    const pastOnset = q * onsetPrice(item) >= knobs.onsetSpend - EPS;
    const discount = pastOnset ? depth.depth * orderShare(item, q, knobs) : 0;
    const raw = discount === 0 ? P : Math.round(P * (1 - discount));
    // A tie goes to the floor once a discount is due, or when the floor leaves no room under the list at all.
    if (raw < floor || (raw === floor && (pastOnset || floor >= P))) {
      return { minimum: floor, discount, pastOnset, binding: "floor", limit: floorLimit };
    }
    return pastOnset && raw < P
      ? { minimum: raw, discount, pastOnset, binding: "curve", limit: depthLimit }
      : { minimum: raw, discount, pastOnset, binding: "belowOnset", limit: "belowOnset" };
  };

  const ladder: QuoteTier[] = (() => {
    const one = formula(1);
    const tiers: QuoteTier[] = [
      { minQty: 1, price: P, all: N === 1, minimum: one.minimum, room: P - one.minimum, binding: one.binding, limit: one.limit },
    ];
    if (item.firm || N === 1) return tiers;
    for (const q of [...breakQuantities(item, knobs), ...(onsetQuantity(item, knobs) === undefined ? [] : [N])]) {
      const f = formula(q);
      const wanted = Math.max(MIN_ROOM_DOLLARS, Math.round(knobs.bargainingRoom * (P - f.minimum)));
      const price = Math.min(f.minimum + wanted, P - 1);
      // Quotes never rise with quantity, so a tie means the smaller tier already covers q.
      if (price - f.minimum < MIN_ROOM_DOLLARS || price >= tiers[tiers.length - 1]!.price) continue;
      tiers.push({ minQty: q, price, all: q === N, minimum: f.minimum, room: price - f.minimum, binding: f.binding, limit: f.limit });
    }
    return tiers;
  })();

  const at = (q: number): MinPriceResult => {
    if (!Number.isInteger(q) || q < 1 || q > N) throw new RangeError(`quantity must be an integer in [1, ${N}]`);
    const C = item.unitCost;
    const posted = item.ladder;
    const quoted = ladderPrice({ ...item, ladder: posted ?? ladder }, q);
    const warnings: string[] = [];
    const result = (minimum: number, f: Omit<Formula, "minimum">): MinPriceResult => {
      if (minimum > quoted) warnings.push(`quoted ${quoted} is below the hard floor ${floor}: fix the ladder or the price plan`);
      return {
      quantity: q,
      listPrice: P,
      quoted,
      minimum,
      total: q * minimum,
      offListPerUnit: P - minimum,
      offListTotal: q * (P - minimum),
      pastOnset: f.pastOnset,
      curveDiscount: Math.round(f.discount * 10000) / 10000,
      hardFloor: floor,
      profitPerUnit: tidy(minimum - C),
      binding: f.binding,
      limit: f.limit,
      warnings,
    };
    };

    if (posted) {
      const sorted = [...posted].sort((a, b) => a.minQty - b.minQty);
      if (sorted.some((t, i) => t.price > P || (i > 0 && t.price > sorted[i - 1]!.price))) {
        warnings.push("ladder has a tier above the list price or above a smaller tier; the lower price is used");
      }
    }
    if (item.firm) {
      if (quoted <= C) warnings.push("firm price is at or below cost");
      return result(quoted, { discount: 0, pastOnset: false, binding: "firm", limit: "firm" });
    }
    if (V !== undefined && V >= P) warnings.push("refund value is at or above list price: returning beats selling");

    const f = formula(q);
    if (posted && quoted < f.minimum) {
      if (quoted < floor) return result(floor, { ...f, binding: "floor", limit: floorLimit });
      return result(quoted, { ...f, binding: "ladder", limit: "postedLadder" });
    }
    return result(f.minimum, f);
  };

  return { ladder, at };
}

/**
 * The quoted ladder a listing shows, with the minimum behind each tier. The first row is one unit at
 * the list price. Each bulk tier quotes its minimum plus bargainingRoom of that tier's discount, at
 * least $2 and never at or above the list; a tier that cannot sit $2 above its minimum and under the
 * list, or that ties a smaller tier, is left out. A posted `item.ladder` is ignored here.
 */
export function quoteLadder(item: Item, knobs: Knobs = DEFAULT_KNOBS): QuoteTier[] {
  return pricer({ ...item, ladder: undefined }, knobs).ladder;
}

/** Largest pile whose take-everything tier names its count ("All 3"); a bigger one reads "All". */
const NAMED_ALL_MAX = 5;

/** How the listing names each tier: "1", "10+", "2" when the next tier starts at 3, "All", or "All 3" for a handful. */
export function tierLabels(tiers: QuoteTier[]): string[] {
  return tiers.map((t, i) => {
    if (t.minQty === 1) return "1";
    if (t.all) return t.minQty <= NAMED_ALL_MAX ? `All ${t.minQty}` : "All";
    return tiers[i + 1]?.minQty === t.minQty + 1 ? String(t.minQty) : `${t.minQty}+`;
  });
}

export function minPrice({ item, quantity, knobs = DEFAULT_KNOBS }: MinPriceRequest): MinPriceResult {
  return pricer(item, knobs).at(quantity);
}

export function minPriceTable({
  item,
  quantities,
  knobs = DEFAULT_KNOBS,
}: {
  item: Item;
  quantities: number[];
  knobs?: Knobs | undefined;
}): MinPriceResult[] {
  const p = pricer(item, knobs);
  return quantities.map((q) => p.at(q));
}
