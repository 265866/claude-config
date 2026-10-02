---
name: marketplace-listing
description: "Drafts Facebook Marketplace listings: identifies the item, prices it against retail and sold comps, and writes the title and description in Colton's format. Use when the user wants to sell or list something, hands over a UPC, model number, or product photo, asks what an item is worth, or asks for bulk pricing tiers. Drafts only; the user posts it."
---

# Marketplace listing

Turn an item into a priced, ready-to-paste Facebook Marketplace listing. Research decides the
number, the copy quotes only retail, and the user does the posting.

## Inputs

Three things shape the listing. Ask for whatever is missing before researching:

- **The item.** UPC, model number, product name, photo, or a link.
- **Quantity.** One, or how many. More than one turns on the bulk block.
- **Handoff.** Pickup or local meetup, which picks the footer.

**Cost per unit** is optional and touches only the floor. Ask for one all-in number that already
folds in freight, pallet fees, and storage, since the skill needs the figure that decides the veto
rather than an itemized buy. It never appears in the listing.

Condition defaults to new and sealed, which is what usually moves through here. Ask when the item
looks used.

## 1. Identify, then confirm

Resolve the identifier to an exact product: brand, model number, variant (color, size, finish),
and unit of sale, including what one case or box contains. WebSearch the raw UPC first, which
usually lands the product page directly.

Report the match with its source URL and wait for the user to confirm before pricing. A wrong
variant poisons every number after it.

## 2. Anchor on retail

The **anchor** is what a buyer would pay at retail today, including tax. It is the only outside
price the listing quotes.

- Prefer the retailer the item actually comes from: Home Depot, Lowe's, Amazon, the manufacturer's
  own store.
- Take the shelf price for a store near San Rafael, then add sales tax. San Rafael's combined
  rate is 9.25% (6% state, 0.25% Marin County, 1% city, and 2% district taxes, per
  salestaxhandbook.com as of 2026). Recheck it against the California CDTFA rate lookup when a
  listing date is far from 2026, because district taxes change.
- When the item is discontinued or has no live retail page, say so and anchor on the nearest
  current equivalent, naming what you substituted.

## 3. Pull comps

**Comps** set the ask. They never appear in the copy.

Both sources sit behind a login, so both need the user's signed-in browser. Use the
**authenticated-browser** skill and run one worker per source; the two can run concurrently. In
each brief's task part, name the exact product and variant confirmed in step 1, so the worker skips
parts, accessories, and other models:

- **eBay sold, last 90 days.** Search the product, then filter to Sold Items. What actually sold
  beats active asks, which only show what sellers hoped for. Signed-out eBay hits a login wall on
  sold searches, so fetching a URL cannot do this step.
- **Local Facebook Marketplace.** Search the product within about 50 miles of San Rafael. Capture
  asking prices, how long listings have sat, and whether anyone else is moving the same volume.

Ask each worker for one row per comp: price, condition, quantity, date sold or posted, and URL.
Ten rows per source is plenty.

Handle a `blocked` or `partial` worker as the **authenticated-browser** skill directs, and rerun
that source only after its blocker is cleared. When a source still comes back empty, stop and tell
the user. Never fill the gap with an invented comp.

## 4. Set the ask

Open at **75% of the anchor**, then adjust:

- Sold comps landing well under 75% pull the ask down. Thin supply and no local competition let it
  hold or climb.
- For a lot, start high and discount hard on volume. The single-unit ask carries the margin; the
  tiers move the pile.
- Used, opened, or missing packaging drops it further, and the copy says why.

The listed price is an opening position. The user relists lower when something sits, so price for
room to fall rather than for a fast clear.

### Bulk tiers

Tiers appear only when quantity is above one. Unit price and pile depth decide the breaks together,
and they pull opposite ways: a $30 case and a $300 machine want completely different numbers. Derive
the breaks rather than reaching for a default ladder.

1. **First break is where the spend gets real.** Divide about $300 of total spend by the single-unit
   ask, then round to a number a buyer recognizes: 2, 3, 5, 10, 25, 50, 100. A $30 case lands near
   10. A $300 machine lands under 2, so clamp to 2, the smallest break that means anything.
2. **Each later break roughly triples the one before it.** Add one such break normally, a second
   only for a pile in the hundreds when the steps would otherwise jump too far, and never one that
   reaches the pile.
3. **The last tier is always `All`, and its price is the floor.** Set the floor first, then fill the
   middle tiers between it and the single-unit ask.

How deep the floor cuts tracks pile depth, not unit price:

- A handful, 2 to 5 units: 5% to 10% under the single-unit ask. There is little pile to move.
- Dozens or hundreds: 25% to 35% under. Start the single ask high and let volume do the work.

Known cost per unit caps how far the floor falls: the floor never lands at or below cost. Cost
constrains the floor and never lifts the ask. A buyer will not pay more because the pile cost more,
so a bad buy surfaces as a shallower ladder or a halt, never as a marked-up listing.

The two shapes this produces:

- 390 cases at $30 each: `10+ cases = $28 ea`, `30+ = $26 ea`, `All = $22 ea`.
- 3 machines at $300 each: `2 = $285 ea`, `All 3 = $270 ea`.

A pile in the hundreds can carry a fourth break when the steps would otherwise jump too far. Three
tiers is the normal shape; two is right for a handful.

Price every tier per unit and label it `ea`, so the buyer never does arithmetic.

### Margin check

Run this once the ask and tiers exist, before writing any copy. Skip it when cost per unit is
unknown.

Report one row per tier with price ea, margin ea, and margin %. Then two totals: what the pile cost
(cost times quantity), and what it returns if all of it clears at the floor.

**Halt when any tier lands at or below cost.** Say which tier is underwater and by how much, then
wait for the user before writing anything. Polished copy for an underwater pile wastes the work and
invites posting it.

- A bulk tier underwater means the ladder reaches too deep. Raise the floor off cost and let the
  middle tiers compress, or drop the bottom tier and sell in smaller lots.
- The single-unit ask underwater means the market price sits below what the pile cost. No ladder
  fixes that. Holding, selling slowly at a loss, or eating it are all the user's call.

A thin but positive margin gets reported, not halted.

## 5. Write and hand off

Follow the title and description shapes below. Count the title. Return two plain blocks, title and
description, with nothing interleaved, so the user can copy each one straight into Facebook.

# Reference

## Title

```text
NEW <brand> <model or line> <variant> <key spec> (<unit size>)
```

- **100 characters, hard.** Count them before handing the title over. Facebook truncates past 100,
  and the tail is exactly where the specs live. Count with the command below. Do not use `wc -m`:
  under a C locale it counts bytes, and every curly inch mark inflates the total by 2.
- `NEW` leads only when the item is genuinely new and sealed.
- Front-load what a buyer types: brand, then model, then the distinguishing spec.
- Keep the manufacturer's spelling of model numbers and finishes. Those are search terms.

Count a title in the Bash tool. The quoted heredoc passes inch marks and quotes without escaping:

```bash
bun -e 'console.log((await Bun.stdin.text()).replace(/\r?\n$/, "").length)' <<'EOF'
<title>
EOF
```

Bad to good:

- `Flooring for sale - great deal!!` becomes
  `NEW TrafficMaster Bridge Coast Oak 7"x48" ClickLock Waterproof Vinyl Plank (23.77sqft/case)`.
  The first matches nothing a buyer searches: no brand, no model, no spec.
- `NEW TrafficMaster Bridge Coast Oak, 7" x 48" ClickLock Waterproof Luxury Vinyl Plank (23.77sqft/box)`
  lands on exactly 100 and fits, with no headroom left. Dropping the comma, tightening the
  dimension spacing, dropping `Luxury`, and using the retailer's unit `case` instead of `box`
  gives the 91-character version above, which keeps every search term and frees
  9 characters for a spec a buyer might filter on.

## Description

Blank line between every block:

```text
<full product name, longer than the title>

<2 to 4 specs that matter, comma separated>

<condition>

$<ask> <unit> — <N>% off <retailer> (~$<anchor> including tax)

<quantity> available (<derived total, when it helps>)

Open to offers, especially on bulk deals        [quantity > 1 only]

Bulk Discounts:                                 [quantity > 1 only]
• <break> = $<price> ea
• <break> = $<price> ea
• All = $<price> ea

<footer>
```

Rules that decide the numbers:

- Compute `% off` against the **with-tax anchor**, not the shelf price, and round to a clean 5%.
  The parenthetical shows that same with-tax figure, so the two always agree.
- Give the derived total whenever the unit is not obvious: `390 cases available (~9300 sq ft)`.
- The em dash in the price line is deliberate and stays. It is the established format.

## Footer

Pickup:

```text
Pickup in San Rafael.
Zelle or cash only. Sold as-is.

Message me to arrange pickup or ask questions!
```

Local meetup:

```text
Local meetup in San Rafael (ask before).
Zelle or cash only. Sold as-is.

Message me to arrange a time to meet or ask questions!
```

## Worked example

The benchmark listing, with its breaks set by the rule above. Step 5 hands these over as two blocks.

Title:

```text
NEW TrafficMaster Bridge Coast Oak 7"x48" ClickLock Waterproof Vinyl Plank (23.77sqft/case)
```

Description:

```text
TrafficMaster Bridge Coast Oak 7 in. W x 48 in. L Click-Lock Waterproof Luxury Vinyl Plank Flooring (23.77 sq ft/case)

6mil wear layer, waterproof, click-lock

Brand new, factory sealed in box

$30 case — 15% off Home Depot (~$36 including tax)

390 cases available (~9300 sq ft)

Open to offers, especially on bulk deals

Bulk Discounts:
• 10+ cases = $28 ea
• 30+ = $26 ea
• All = $22 ea

Pickup in San Rafael.
Zelle or cash only. Sold as-is.

Message me to arrange pickup or ask questions!
```

## Bad to good, whole listing

An earlier listing, and the same item normalized:

Bad:

```text
NEW Henry 887G Tropi-Cool Gray 100% Silicone Reflective Roof Coating 4.75 gal.

All new, unopened, still sealed

I have 3, selling $210 for 1 or $600 for 3

Retails for $349 on Home Depot, I'm selling as low as $200, that's $149 or 42% off

Local pickup and cash or Zelle only, first come first serve, item comes as is and all sales are final
```

Four problems. The quantity and the bulk price are mashed into one line that makes the buyer do
division. The discount is computed against the shelf price instead of the with-tax anchor. There
are no specs, only condition. The footer is a run-on that buries the call to action.

Good, as the title block and then the description block:

```text
NEW Henry 887G Tropi-Cool Gray 100% Silicone Reflective Roof Coating (4.75 gal.)
```

```text
Henry 887G Tropi-Cool 100% Silicone Reflective Roof Coating in Gray, 4.75 gallon pail

100% silicone, reflective finish, seals and waterproofs

Brand new, unopened, factory sealed

$210 each — 45% off Home Depot (~$381 including tax)

3 available

Open to offers, especially on bulk deals

Bulk Discounts:
• 2 = $200 ea
• All 3 = $190 ea

Pickup in San Rafael.
Zelle or cash only. Sold as-is.

Message me to arrange pickup or ask questions!
```
