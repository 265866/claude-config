---
name: god-recipe
description: "Build a \"god recipe\" for a dish: find the web's highest-rated, best-tested recipes, compare them side by side, and synthesize one best version, with strict ratio handling for baking and other structure-critical foods. Use when the user asks for the best recipe for a dish, how to make something exceptionally well, or what to make with ingredients they have."
---

# God recipe

Turn many good recipes for one dish into a single best one. The comparison is the evidence. Every
choice in the final recipe traces to the sources that support it.

## Inputs

- **The dish.** When the user names only ingredients ("2 Chinese eggplants"), pick the dish that
  best showcases them, usually the canonical dish for that ingredient in its home cuisine. Build
  the god recipe for that dish, and offer two alternatives in the template's opening lines so the
  user can ask for either. When a dish name covers genuinely
  different styles (Sichuan or Cantonese eggplant with garlic sauce, Texas or Cincinnati chili),
  pick the one the strongest sources treat as standard and say so. Ask only when the user's words
  point both ways.
- **Constraints, when given.** Ingredients on hand, servings, equipment (no oven, air fryer, stand
  mixer), diet, time, and pan size. Convert a count to weight with the sources' own statements,
  such as "1 lb (2 to 3 eggplants)". When they disagree, take the middle of their figures, state
  the weight you assumed, and tell the user to weigh.

## 1. Choose the mode

**Tested-only mode** covers home canning and nitrite cures. Their safety rests on a lab-tested
process, so read [tested-only.md](${CLAUDE_SKILL_DIR}/references/tested-only.md) and follow it
in place of steps 4 and 5.

**Strict mode** applies when proportions decide whether the food works: breads, cakes, cookies,
quick breads, pastry, choux, batters, custards, meringues, candy and caramel, pasta dough, brines,
and ferments.

**Loose mode** covers everything you can taste and adjust while cooking: stir-fries, braises,
soups, curries, salads, roasts, and most sauces.

For a mixed dish, apply strict mode to the structural component (a pie's crust, a dumpling's
wrapper) and loose mode to the rest.

## 2. Gather candidates

Collect 6 to 10 recipes with WebSearch. Prefer variety of trustworthy sources over volume:

- **Tested kitchens** that publish their testing: Serious Eats (especially J. Kenji López-Alt and
  Stella Parks), America's Test Kitchen and Cook's Illustrated, King Arthur Baking for baking, NYT
  Cooking, and Bon Appétit.
- **Cuisine authorities** for regional dishes: for example The Woks of Life, Made With Lau, and
  Fuchsia Dunlop for Chinese; Maangchi for Korean; Just One Cookbook for Japanese; Pailin
  Chongchitnant (Hot Thai Kitchen) for Thai; Rick Bayless for Mexican. Include at least one
  whenever the dish has a home cuisine. For American baking, the tested kitchens fill this role.
- **Crowd favorites** with large rating counts, such as Allrecipes and RecipeTin Eats.

Weigh evidence in this order:

1. Published testing.
2. Agreement among independent cuisine authorities.
3. Rating count. Judge it by count, not stars: a 4.6 from 19,000 ratings beats a 5.0 from 30.

This order ranks candidates for the same dish and style. A tested recipe for a different style of
dish is a comparison point, not the base. For a niche dish where every count is small, agreement
among authorities carries the decision.

Skip content farms, AI-generated pages, recipes without quantities, and copies of a recipe you
already hold. Keep a near-duplicate only when it is your tested evidence for a graft.

When WebSearch refuses a domain, run the extractor's `--links` mode on the site's own search page,
such as `https://www.allrecipes.com/search?q=chocolate+chip+cookies`. It lists the site's links
with their anchor text, which on Allrecipes includes rating counts. Never build a recipe URL
yourself. A URL that appears in search results, a summary, or a site's links is fine to try,
because the extractor confirms it. A WebSearch summary only points you to pages. Use no quantity,
technique, or claim that you saw only in a summary.

## 3. Extract quantities verbatim

Run the bundled extractor on candidate URLs as you find them, several at a time:

```bash
bun "${CLAUDE_SKILL_DIR}/scripts/recipe-extract.ts" [--reviews] [--text | --links] <url> [url...]
```

It prints JSON per recipe: name, author, rating and count, yield, times, ingredient lines exactly
as published, and instruction steps. It needs `curl` on PATH.

- **Data sources.** It reads the page's schema.org Recipe data. When the page has none, or
  Cloudflare blocks it, it falls back to the WP Recipe Maker API that many food blogs expose.
  The `source` field says which one it used.
- **`--reviews`** adds review and comment text, up to 100 per recipe. Most publishers embed 20 or
  fewer reviews in their recipe data, and some, such as America's Test Kitchen, embed none.
- **`--text`** returns the page's visible text instead. Use it for pages with no structured data,
  such as Smitten Kitchen, NCHFP, and publishers' weight charts. `--links` lists a page's
  same-site links instead, for site search pages. `--text` reads PDFs too, when Poppler's
  `pdftotext` is on PATH. Save the output to a temporary file and search it, since pages with
  comments can run past 200,000 characters.
- **Errors.** A URL that fails comes back with an `error` field. A Cloudflare challenge says so,
  because the page may still exist. The script exits 1 only when every URL failed.

When the extractor fails, try these in order:

1. `--text`, unless the failure was an HTTP error. It sends the same request, so it fails the same
   way.
2. WebFetch, asking for the ingredient list. It paraphrases and rounds, so mark those quantities
   as unverified. In strict mode, never let an unverified number decide a ratio.
3. A secondary copy, only when the original is unreadable. Check the copy against whatever you can
   see of the original, such as a search snippet or a second copy. Cite it as "<original> via
   <linked copy>".

When every route fails, drop the source and do not link it.

Mine the `--reviews` output and recipe notes for changes that cooks repeat ("cut the sugar by a
third", "double the garlic"). Report how many reviews you read. A tweak that a meaningful share of
them repeat is evidence. One reviewer is an anecdote.

## 4. Compare

Normalize every candidate to one basis, then build a comparison table with one row per ingredient
and one column per source:

- **Strict mode:** grams per 100 g flour, or per 100 g of the main structural ingredient. Convert
  cups with each source's own printed weights, per
  [structure-guardrails.md](${CLAUDE_SKILL_DIR}/references/structure-guardrails.md).
- **Loose mode:** quantities per 500 g of the main ingredient, or per serving.

Compare technique as well as ingredients: prep (salting, brining, marinating), heat and order of
operations, timing, resting, and doneness cues. Mark where sources agree, where they split, and
where one source stands alone with a stated reason.

## 5. Synthesize

**Loose mode.** Start from the consensus quantities. Adopt a technique when several strong sources
share it, or when one tested source explains why it works. Seasonings may move toward the
reviewers' consensus. Give a range where the sources honestly spread. When one choice changes
another (salting the eggplant calls for less soy), set them together and say so.

When sources split between a method that gives the better result and an easier one (deep-frying
versus pan-frying), choose the better result. Choose the easier method only when a tested source,
or two independent authorities, say the difference is small. Offer the other as a variation.

**Strict mode.** Never average ratios across recipes. An average of a fudgy brownie and a cakey one
is neither. Choose one base recipe and keep its structure intact. Structure means the quantities of
flour, fat, sugar, eggs, liquid, leavening, and salt in the dough or batter. It also means the
mixing method and the fat's state: creamed, melted, or browned butter, and whipped or stirred
eggs. A finishing salt or other topping is not structure.

Choose the base by these criteria, in order:

1. It fits the user's constraints natively, such as their banana count or pan size.
2. It has the strongest testing.
3. It is closest to the target style. A tested recipe whose stated goal matches the user's words
   wins here.

When candidates still tie, apply step 2's evidence order: agreement among sources, then rating
count.

Graft other candidates' improvements onto the base only in these two cases:

- **Flavor or technique that leaves the structure unchanged.** Examples: an added spice, a
  topping, an overnight rest, or browned butter with its lost water replaced.
- **A structural change that a tested candidate with the same structure already makes
  successfully.** The same structure means the same leavening system, the same mixing method, and
  ratios within the candidate spread. Cite that candidate next to the change.

A same-weight swap between ingredients that behave differently counts as a structural change.
Examples: white sugar for brown, butter for oil, all-purpose flour for bread flour.

A graft can change how the base bakes, as chilled or rested dough does. Keep the base's
temperature, lead with its doneness cue, and label any time adjustment that no source states as an
estimate.

Check every changed structural quantity against
[structure-guardrails.md](${CLAUDE_SKILL_DIR}/references/structure-guardrails.md).

## 6. Check the result

- Recompute every scaled quantity, the yield, and the pan area and fill.
- In strict mode, recompute the final ratios and compare them with the base recipe and the
  guardrails. Explain any value outside a range.
- Keep oven temperature and bake time consistent with the base recipe. Add a doneness cue to every
  timed cooking step.
- For meat, poultry, fish, and egg dishes, state the USDA minimum from the guardrails file.

## 7. Deliver

```markdown
# <Dish>: the god recipe

<One or two sentences saying what makes this version best, and the style it targets.>
<When you chose the dish from ingredients: "Also good with these: <dish>, <dish>. Ask for either.">
**Makes:** <yield> · **Time:** <active> active, <total> total

## Ingredients
<Strict mode: grams first, then volume, as in "250 g (2 cups) all-purpose flour".
Loose mode: volume, with grams for the main ingredients.>

## Method
<Numbered steps. Each timed step also has a cue: "until deep golden, about 6 minutes".>

## Why it works
<One bullet per material decision: what you chose, which sources agree, and what you rejected.>

## Variations and make-ahead
<Optional. Only what the sources support.>

## Sources
<Every recipe you compared, as markdown links, with rating and count when known.
Mark any source whose quantities came through the WebFetch fallback or a secondary copy.>
```

Sources rarely publish active time. Label any time you estimated as an estimate. Link only pages you
actually read. Keep the step 4 comparison table out of the deliverable unless the user asks. The
"Why it works" bullets summarize it. When the comparison shows two styles that are both excellent, deliver the god recipe
for the requested or canonical style and describe the other in one paragraph rather than splitting
the difference.
