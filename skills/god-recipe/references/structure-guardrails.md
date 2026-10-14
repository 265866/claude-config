# Structure guardrails

Read this in strict mode, before you change any structural quantity in the base recipe and again
when you check the final recipe. These figures are sanity ranges for catching a broken synthesis.
They are not targets. A tested recipe that sits outside a range on purpose (a very sweet cookie, a
90% hydration focaccia) is right. Your change is what has to justify itself.

Where this file gives no range for a component, as with sugar, fat, and fruit in quick breads and
cakes, the spread across your tested candidates is the range. A change that lands outside every
tested candidate fails the check.

## Classic ratios, by weight

From Michael Ruhlman, *Ratio* (2009), which distills the CIA cheat sheet by Uwe Hestnar.

| Preparation | Ratio |
| --- | --- |
| Bread | 5 flour : 3 water, plus salt and yeast |
| Pasta | 3 flour : 2 egg |
| Pie dough | 3 flour : 2 fat : 1 water |
| Biscuit | 3 flour : 1 fat : 2 liquid |
| Cookie (shortbread-style base) | 3 flour : 2 fat : 1 sugar |
| Pound cake | 1 butter : 1 sugar : 1 egg : 1 flour |
| Pâte à choux | 2 water : 1 butter : 1 flour : 2 egg |
| Angel food cake | 3 egg white : 3 sugar : 1 flour |
| Popover | 2 liquid : 1 egg : 1 flour |
| Crêpe | 1 liquid : 1 egg : ½ flour |

Modern tested drop cookies carry far more sugar than the 3:2:1 base, often close to the flour
weight. Compare cookie candidates with one another, not with Ruhlman.

## Bread, in baker's percentages

Every ingredient is a percentage of total flour weight, which is 100%.

- **Hydration** usually runs 55 to 85%. Bagels and pretzels 50 to 55%, sandwich bread 60 to 65%,
  baguette 65 to 68%, ciabatta 75 to 80%, focaccia 78 to 85%.
- **Salt** runs 1.8 to 2.5%, with 2% the common default. Below 1.8% the dough ferments fast and
  tastes flat. Above 2.5% fermentation slows and the bread tastes salty.
- **Instant yeast** is about 1% for a same-day dough and about 0.5% for an overnight cold
  ferment, rarely above 1.5%. Fresh yeast is about 3 times the instant-yeast weight.
- Count the water in milk, eggs, and starter when you compute hydration. A levain at 100%
  hydration is half flour and half water.

## Chemical leavening

- **Baking powder:** about 1 tsp (4 g) per 120 to 125 g flour. Tested sources run up to
  1.5 to 2 tsp per cup.
- **Baking soda:** about ¼ tsp per 125 g flour, and it needs an acid (buttermilk, yogurt, natural
  cocoa, brown sugar, molasses, citrus). Strongly acidic batters take up to ½ tsp. Excess soda
  tastes soapy or metallic and over-browns. Soda is 3 to 4 times stronger than powder.
- More eggs need less chemical leavening.
- Swapping between powder and soda changes acidity, browning, and spread. Keep the base recipe's
  leavening system unless a tested source shows the swap working.

## Converting volume to weight

Cup weights differ by publisher because their scooping methods differ. A cup of all-purpose flour
is 120 g at King Arthur, 5 oz (about 142 g) at America's Test Kitchen, and 125 g at most other US
sources. A cup scooped straight from the bag can carry about 30% more flour than a spooned one.

- Use the weight the source prints next to its cup measure whenever it prints one.
- Otherwise convert with that publisher's own chart and state which chart you used.
- When the publisher has no chart, use the King Arthur figures below. For flour, use 125 g per cup
  instead, the common US default, and say so.
- Write salt in grams. Diamond Crystal and Morton kosher salt differ about 2 to 1 by volume. Bon
  Appétit prints 1¼ tsp Diamond Crystal and ¾ tsp Morton as the same 4 g.
- When a source blends flours (oat with all-purpose, say), keep each flour's weight separate and
  normalize to their total.
- Treat a "pinch" or "dash" as under ⅛ tsp, and never let one decide a ratio.
- Australian and other metric cups hold 250 ml, against about 240 ml for a US cup. Convert with
  the author's own grams when given, and note when the author says the difference does not matter.
- When a recipe says only "salt" or "coarse sea salt", whose weight varies by brand, use table
  salt for plain "salt" and say what you assumed. Leave a coarse salt out of the ratio check.

From the [King Arthur ingredient weight chart](https://www.kingarthurbaking.com/learn/ingredient-weight-chart):

| Ingredient | Volume | Grams |
| --- | --- | --- |
| All-purpose or bread flour | 1 cup | 120 |
| Whole wheat flour | 1 cup | 113 |
| Granulated sugar | 1 cup | 198 |
| Brown sugar, packed | 1 cup | 213 |
| Confectioners' sugar, unsifted | 1 cup | 113 |
| Butter | 8 tbsp (1 stick) | 113 |
| Vegetable oil | 1 cup | 198 |
| Milk, buttermilk, yogurt, or water | 1 cup | 227 |
| Honey | 1 tbsp | 21 |
| Mashed banana | 1 cup | 227 |
| Large egg, out of shell | 1 | 50 (yolk 14, white 30 to 35) |
| Cocoa, unsweetened | ½ cup | 42 |
| Chocolate chips, chunks, or chopped | 1 cup | 170 |
| Corn syrup | 1 cup | 312 |
| Cornstarch | ¼ cup | 28 |
| Baking powder | 1 tsp | 4 |
| Baking soda | ½ tsp | 3 |
| Table salt | 1 tbsp | 18 |
| Morton kosher salt | 1 tbsp | 16 |
| Diamond Crystal kosher salt | 1 tbsp | 8 |

## Pans and scaling

Scale batter by pan area, not by diameter. A 9-inch round is about 64 sq in, the same as an
8-inch square. A 9 by 5-inch loaf pan is 45 sq in, and a 9 by 13-inch pan is 117 sq in. A new depth
changes the bake time, so give a doneness cue rather than a converted time.

When the user's ingredient amount and pan both constrain the recipe, prefer a base written for
both. When you must scale, scale to the binding constraint, then check that the batter fills the
pan to the base recipe's depth. A short loaf or an overflowing pan means you chose the wrong base.

## Structure-critical cooking outside baking

These follow strict mode too:

- **Candy, caramel, and sugar work.** Keep the base recipe's target temperatures.
- **Custards, curds, and emulsions.** Keep the base recipe's egg-to-liquid and fat-to-liquid
  balance.
- **Brines, fermentation, and refrigerator pickles.** Salt and acid percentages decide safety and
  texture.

Home canning and nitrite cures are not synthesized at all. They follow
[tested-only.md](tested-only.md).

## Safe internal temperatures

The [USDA FSIS chart](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart)
sets these minimums. Read them with a thermometer before the food leaves the heat.

- Beef, pork, veal, and lamb steaks, chops, and roasts: 145°F (63°C) with a 3-minute rest.
- Ground meat: 160°F (71°C).
- All poultry, including ground poultry and stuffing: 165°F (74°C).
- Fish and shellfish: 145°F (63°C).
- Egg dishes, such as frittatas, quiches, and stirred custards: 160°F (71°C).
- Leftovers and casseroles: 165°F (74°C).

Baked goods that contain eggs use their own doneness cue. Breads, cakes, and quick breads finish
well above 160°F.

A tested recipe that deliberately cooks below these figures, such as sous vide chicken held at
temperature for a set time, or a medium-rare burger, keeps its method. State the USDA figure next
to it so the user chooses knowingly.
