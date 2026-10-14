// Prints recipe data from recipe pages, verbatim, as JSON.
// Usage: bun recipe-extract.ts [--reviews] [--text | --links] <url> [url...]

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

type Recipe = {
  url: string;
  source: "schema.org" | "wp-recipe-maker";
  name?: string;
  author?: string;
  rating: { value?: string; count?: string } | null;
  yield?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  ingredients: string[];
  instructions: string[];
  reviews?: string[];
};
type PageText = { url: string; source: "page-text"; text: string };
type PageLinks = { url: string; source: "page-links"; links: { text: string; href: string }[] };
type Failure = { url: string; error: string };
type Result = Recipe | PageText | PageLinks | Failure;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const STATUS_MARKER = "\n__RECIPE_EXTRACT_STATUS__\t";

type Page = { status: number; url: string; body: string; cloudflareChallenge: boolean };

// Publishers such as Allrecipes and Serious Eats return 403 to Bun's fetch whatever its
// headers, but serve curl with a browser user agent, so every request goes through curl.
async function fetchPage(url: string): Promise<Page> {
  const proc = Bun.spawn(
    [
      "curl",
      "--silent",
      "--location",
      "--compressed",
      "--max-time",
      "30",
      "--user-agent",
      BROWSER_UA,
      "--header",
      "Accept: text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "--header",
      "Accept-Language: en-US,en;q=0.9",
      "--write-out",
      `${STATUS_MARKER}%{http_code}\t%header{cf-mitigated}\t%{url_effective}`,
      url,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [output, errors, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const markerAt = output.lastIndexOf(STATUS_MARKER);
  if (exitCode !== 0 || markerAt === -1) {
    throw new Error(`curl exited ${exitCode}${errors.trim() ? `: ${errors.trim()}` : ""}`);
  }
  const [status, mitigated, finalUrl] = output.slice(markerAt + STATUS_MARKER.length).split("\t");
  const body = output.slice(0, markerAt);
  return {
    status: Number(status),
    url: finalUrl?.trim() || url,
    body,
    cloudflareChallenge: mitigated === "challenge" || body.includes("challenge-platform"),
  };
}

const isOk = (page: Page) => page.status >= 200 && page.status < 300;

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function clean(value: Json | undefined): string | undefined {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return undefined;
  const text = decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return text || undefined;
}

const present = (values: (string | undefined)[]) => values.filter((v): v is string => Boolean(v));

// schema.org JSON-LD

function collectNodes(node: Json, byId: Map<string, JsonObject>, recipes: JsonObject[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectNodes(child, byId, recipes);
    return;
  }
  if (!isObject(node)) return;
  if (typeof node["@id"] === "string" && Object.keys(node).length > 1) byId.set(node["@id"], node);
  const type = node["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) recipes.push(node);
  for (const child of Object.values(node)) collectNodes(child, byId, recipes);
}

function flattenInstructions(node: Json | undefined, section?: string): string[] {
  if (typeof node === "string") return present([clean(node)]);
  if (Array.isArray(node)) return node.flatMap((child) => flattenInstructions(child, section));
  if (!isObject(node)) return [];
  if (node["@type"] === "HowToSection") return flattenInstructions(node.itemListElement, clean(node.name));
  const text = clean(node.text) ?? clean(node.name);
  if (!text) return [];
  return [section ? `[${section}] ${text}` : text];
}

function schemaRecipe(recipe: JsonObject, byId: Map<string, JsonObject>, url: string, withReviews: boolean): Recipe {
  const resolve = (value: Json | undefined): Json | undefined =>
    isObject(value) && typeof value["@id"] === "string" && Object.keys(value).length === 1
      ? (byId.get(value["@id"]) ?? value)
      : value;
  const names = (value: Json | undefined): string[] =>
    Array.isArray(value)
      ? value.flatMap(names)
      : present([isObject(resolve(value)) ? clean((resolve(value) as JsonObject).name) : clean(value)]);
  const rating = resolve(recipe.aggregateRating);
  const yields = recipe.recipeYield;
  const reviews = Array.isArray(recipe.review) ? recipe.review : isObject(recipe.review) ? [recipe.review] : [];
  return {
    url,
    source: "schema.org",
    name: clean(recipe.name),
    author: names(recipe.author).join(", ") || undefined,
    rating: isObject(rating)
      ? { value: clean(rating.ratingValue), count: clean(rating.ratingCount) ?? clean(rating.reviewCount) }
      : null,
    yield: Array.isArray(yields) ? present(yields.map(clean)).join(" / ") : clean(yields),
    prepTime: clean(recipe.prepTime),
    cookTime: clean(recipe.cookTime),
    totalTime: clean(recipe.totalTime),
    ingredients: Array.isArray(recipe.recipeIngredient) ? present(recipe.recipeIngredient.map(clean)) : [],
    instructions: flattenInstructions(recipe.recipeInstructions),
    reviews: withReviews
      ? present(
          reviews.map((review) => {
            if (!isObject(review)) return undefined;
            const body = clean(review.reviewBody);
            const stars = isObject(review.reviewRating) ? clean(review.reviewRating.ratingValue) : undefined;
            return body && (stars ? `[${stars}] ${body}` : body);
          }),
        )
      : undefined,
  };
}

async function fromSchemaOrg(html: string, url: string, withReviews: boolean): Promise<Recipe[]> {
  const blocks: string[] = [];
  let current: string | null = null;
  await new HTMLRewriter()
    .on('script[type="application/ld+json"]', {
      element(el) {
        current = "";
        el.onEndTag(() => {
          if (current !== null) blocks.push(current);
          current = null;
        });
      },
      text(chunk) {
        if (current !== null) current += chunk.text;
      },
    })
    .transform(new Response(html))
    .text();

  const byId = new Map<string, JsonObject>();
  const recipes: JsonObject[] = [];
  for (const block of blocks) {
    try {
      collectNodes(JSON.parse(block) as Json, byId, recipes);
    } catch {
      // A malformed JSON-LD block elsewhere on the page should not hide a valid recipe block.
    }
  }
  return recipes.map((recipe) => schemaRecipe(recipe, byId, url, withReviews));
}

// WP Recipe Maker, a WordPress plugin used by many food blogs. Its REST API often stays
// reachable when Cloudflare challenges the HTML page.

async function fetchJson(url: string): Promise<Json | undefined> {
  const page = await fetchPage(url);
  if (!isOk(page)) return undefined;
  try {
    return JSON.parse(page.body) as Json;
  } catch {
    return undefined;
  }
}

function wprmRecipe(recipe: JsonObject, url: string, reviews: string[] | undefined): Recipe {
  const minutes = (value: Json | undefined) => {
    const text = clean(value);
    return text && text !== "0" ? `${text} min` : undefined;
  };
  const groups = (value: Json | undefined) => (Array.isArray(value) ? value.filter(isObject) : []);
  const rating = isObject(recipe.rating) ? recipe.rating : undefined;
  return {
    url,
    source: "wp-recipe-maker",
    name: clean(recipe.name),
    author: clean(recipe.author_name),
    rating: rating && clean(rating.count) !== "0" ? { value: clean(rating.average), count: clean(rating.count) } : null,
    yield: present([clean(recipe.servings), clean(recipe.servings_unit)]).join(" ") || undefined,
    prepTime: minutes(recipe.prep_time),
    cookTime: minutes(recipe.cook_time),
    totalTime: minutes(recipe.total_time),
    ingredients: groups(recipe.ingredients).flatMap((group) => {
      const section = clean(group.name);
      return groups(group.ingredients).flatMap((item) => {
        const line = present([clean(item.amount), clean(item.unit), clean(item.name), clean(item.notes)]).join(" ");
        return line ? [section ? `[${section}] ${line}` : line] : [];
      });
    }),
    instructions: groups(recipe.instructions).flatMap((group) => {
      const section = clean(group.name);
      return present(groups(group.instructions).map((step) => clean(step.text))).map((text) =>
        section ? `[${section}] ${text}` : text,
      );
    }),
    reviews,
  };
}

async function fromWpRecipeMaker(url: string, withReviews: boolean): Promise<Recipe[]> {
  const { origin, pathname } = new URL(url);
  const slug = pathname.split("/").filter(Boolean).pop();
  if (!slug) return [];
  for (const type of ["posts", "pages"]) {
    const posts = await fetchJson(`${origin}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(slug)}&_fields=id,content`);
    const post = Array.isArray(posts) ? posts.find(isObject) : undefined;
    const html = post && isObject(post.content) ? post.content.rendered : undefined;
    if (!post || typeof html !== "string") continue;

    const ids = [...new Set([...html.matchAll(/wprm-recipe-container-(\d+)/g)].map((m) => m[1]))];
    let reviews: string[] | undefined;
    if (withReviews) {
      const comments = await fetchJson(`${origin}/wp-json/wp/v2/comments?post=${post.id}&per_page=100&_fields=content`);
      reviews = Array.isArray(comments)
        ? present(comments.map((c) => (isObject(c) && isObject(c.content) ? clean(c.content.rendered) : undefined)))
        : [];
    }
    const recipes: Recipe[] = [];
    for (const id of ids) {
      const record = await fetchJson(`${origin}/wp-json/wp/v2/wprm_recipe/${id}`);
      if (isObject(record) && isObject(record.recipe)) recipes.push(wprmRecipe(record.recipe, url, reviews));
    }
    return recipes;
  }
  return [];
}

// Extension services publish many safety sheets as PDFs, which need Poppler's pdftotext.
async function pdfText(url: string): Promise<PageText | Failure> {
  const dir = mkdtempSync(join(tmpdir(), "recipe-extract-"));
  const file = join(dir, "page.pdf");
  try {
    const download = Bun.spawn(
      ["curl", "--silent", "--location", "--max-time", "60", "--user-agent", BROWSER_UA, "--output", file, url],
      { stdout: "ignore", stderr: "ignore" },
    );
    if ((await download.exited) !== 0) return { url, error: "PDF download failed" };
    let proc;
    try {
      proc = Bun.spawn(["pdftotext", "-layout", file, "-"], { stdout: "pipe", stderr: "pipe" });
    } catch {
      return { url, error: "page is a PDF and pdftotext (Poppler) is not on PATH" };
    }
    const [text, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    if (exitCode !== 0) return { url, error: `pdftotext exited ${exitCode}` };
    return { url, source: "page-text", text: text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Visible page text, for pages that publish a recipe without structured data.

function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// Same-site links with their anchor text, for finding recipe URLs on a site's own search page.
async function pageLinks(page: Page): Promise<PageLinks> {
  const origin = new URL(page.url).origin;
  const links = new Map<string, string>();
  let current: { href: string; text: string } | null = null;
  await new HTMLRewriter()
    .on("a[href]", {
      element(el) {
        const href = el.getAttribute("href");
        if (!href) return;
        try {
          const absolute = new URL(href, page.url);
          if (absolute.origin !== origin) return;
          absolute.hash = "";
          current = { href: absolute.href, text: "" };
          el.onEndTag(() => {
            const link = current;
            current = null;
            const text = link && clean(link.text);
            if (link && text && !links.has(link.href)) links.set(link.href, text);
          });
        } catch {
          // An unparseable href is not a link the caller can use.
        }
      },
      text(chunk) {
        if (current) current.text += chunk.text;
      },
    })
    .transform(new Response(page.body))
    .text();
  return { url: page.url, source: "page-links", links: [...links].map(([href, text]) => ({ text, href })) };
}

async function extract(url: string, withReviews: boolean, wantText: boolean, wantLinks: boolean): Promise<Result[]> {
  const page = await fetchPage(url);
  if (isOk(page) && wantLinks) return [await pageLinks(page)];
  if (isOk(page)) {
    if (wantText) {
      if (page.body.startsWith("%PDF")) return [await pdfText(page.url)];
      return [{ url: page.url, source: "page-text", text: visibleText(page.body) }];
    }
    const recipes = await fromSchemaOrg(page.body, page.url, withReviews);
    if (recipes.length > 0) return recipes;
  }
  if (page.status !== 404 && page.status !== 410) {
    const recipes = await fromWpRecipeMaker(page.url, withReviews);
    if (recipes.length > 0) return recipes;
  }
  if (isOk(page)) {
    return [{ url, error: "no structured recipe data on page; rerun with --text to read the page text verbatim" }];
  }
  if (page.cloudflareChallenge) {
    return [{ url, error: `HTTP ${page.status}: Cloudflare bot challenge, so the page may still exist` }];
  }
  return [{ url, error: `HTTP ${page.status}` }];
}

const args = Bun.argv.slice(2);
const withReviews = args.includes("--reviews");
const wantText = args.includes("--text");
const wantLinks = args.includes("--links");
const urls = args.filter((arg) => !arg.startsWith("--"));
if (urls.length === 0) {
  console.error("Usage: bun recipe-extract.ts [--reviews] [--text | --links] <url> [url...]");
  process.exit(2);
}

const results = (
  await Promise.all(
    urls.map((url) =>
      extract(url, withReviews, wantText, wantLinks).catch((error: unknown) => [{ url, error: String(error) }]),
    ),
  )
).flat();
console.log(JSON.stringify(results, null, 2));
if (results.every((result) => "error" in result)) process.exit(1);

