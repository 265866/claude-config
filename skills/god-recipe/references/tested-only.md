# Tested-only foods

Read this when the request involves home canning (water-bath or pressure), a nitrite cure, or any
other food whose shelf safety rests on a lab-tested process. For these foods, an untested change
can cause botulism. So the god recipe is the best choice among lab-tested recipes, delivered
verbatim. Nothing is synthesized.

## Sources

Use only recipes with a lab-tested process:

- The USDA-funded [National Center for Home Food Preservation](https://nchfp.uga.edu/), which
  carries the USDA *Complete Guide to Home Canning*.
- Ball and Bernardin.
- University extension services, such as Penn State Extension.

Untested crowd favorites stay out of the recipe. Their highly rated traits (thick, mild, smoky) may
still tell you which tested recipe best matches what cooks want. Say that this is how you used
them. Extension pages that list safe and unsafe changes are worth reading for the Variations
section.

Most of these pages carry no schema.org data. Read them with the extractor's `--text` mode, which
keeps the quantities verbatim and also reads extension PDFs.

This mode needs verbatim lines, so never use WebFetch quantities. Read a blocked tested page, such
as Ball's, through the **agent-chrome** skill. A line the worker flags makes that recipe unusable
until a rerun or a checked secondary copy confirms it. When a tested recipe is still readable only
through a secondary copy, check the copy against what you can see of the original, such as
search snippets or a second copy, and cite it as "<original> via <linked copy>".

Every safety statement you deliver, whether an allowed change, a warning, or a processing time,
must come from text you read on the source page. A search summary is never the source of a safety
claim.

## Choose

Collect every tested recipe for the dish, then choose by these criteria, in order:

1. Fit with what the user has: ingredient type (paste or slicing tomatoes), equipment (water-bath
   or pressure canner), and jar size.
2. A batch size the user can manage.
3. The style the user asked for, or the style crowd favorites point to.

When no tested recipe has every trait the user asked for, deliver the one with the trait that
defines the style, and describe the tested recipe with the other trait in one paragraph. Never
combine them.

Compare the candidates by the ratio their safety depends on. For acidified foods, that is low-acid
ingredients to acid, in each source's own units. Do not treat vinegar and bottled lemon juice as
interchangeable unless the source does.

## Deliver

Change the output template from SKILL.md as follows:

- **Ingredients:** the source's lines verbatim, in its own units. Do not convert to grams, because
  the process was tested by volume. Do not scale beyond what the source allows.
- **Makes and Time:** the yield as printed. Label any time the source does not print as an
  estimate. Give a cooling or curing period as its own clause, such as "plus 12 to 24 hours of
  cooling".
- **Method:** keep every step. Include headspace, the processing table by jar size and altitude,
  cooling, the seal check, and what to do with jars that did not seal. Processing and simmer times
  are fixed. A doneness cue may describe what the food looks like, but it never replaces or
  shortens a timed step.
- **Altitude:** use the recipe's own altitude table. When the recipe defers to a chart you cannot
  read, use an extension service's altitude chart for the same canning method, and name it.
- **Why it works:** say why this tested recipe beat the other tested candidates, and quote the
  source's own warning about changes. When the source prints none, quote NCHFP's general warning
  for that kind of food and say whose warning it is.
- **Variations:** only changes that the source or an extension service explicitly calls safe,
  each with its citation. An allowance without an amount, such as "slight adjustments in spices",
  permits only a small change to spices the recipe already uses. Label any amount you choose as
  your judgment. Changes the sources call unsafe go in as warnings.
- **Sources:** mark every untested recipe as compared only, not used.

## Nitrite cures

Keep the source's cure-to-meat weight ratio and its salt, time, and temperature exactly. Scale only
by weighing the meat and applying that ratio.
