---
name: control-ui
description: Build or adapt a local browser/CDP harness to drive and inspect a web, IDE, or Electron UI. Use for local UI verification, screenshots, accessibility snapshots, perf profiles, visual diffs, or reproducing UI bugs, including when a host app's browser-preview tool is off. Use authenticated-browser for sites that need the user's sign-in.
---

# Control UI

Use local browser automation to verify UI behavior with evidence. First reuse the repo's own Playwright, browser, or Electron harness if it exists; otherwise use an available MCP browser tool that runs its own browser, or a local harness around the app's dev server or Chromium debug port. Do not attach to the agent Chrome that authenticated-browser runs from its `agent-chrome` profile; it holds the user's sign-ins. Discover the actual tool inventory; no built-in browser API is assumed. When a host app's browser-preview tool is off or missing, do not retry it; fall back to the repo's harness or the Generic Web Harness below. Never point automation at the user's own browser profiles. A site that needs the user's own sign-in goes to authenticated-browser.

## What It Is Used For

- Reproducing UI bugs that depend on real browser focus, keyboard input, scrolling, resizing, or rendering.
- Verifying visual or accessibility changes with screenshots and snapshots.
- Checking local web, IDE, or Electron behavior before shipping.
- Capturing console logs, network logs, CPU profiles, traces, or heap snapshots.
- Creating before/after evidence for the bundled verification and shipping workflows.

## Local verification

1. Start the app locally using the repo's documented dev command.
2. Discover existing local harnesses: Playwright tests, Cypress specs, Storybook, browser scripts, Electron launch scripts, or snapshot tools.
3. For a web app, connect to the local URL with the existing browser tooling.
4. For Electron/Chromium, enable a remote debugging port when supported.
5. Select the correct page by stable app markers, not by tab order alone.
6. Prefer accessibility roles, labels, and stable `data-*` selectors over coordinates.

## Generic Web Harness

Use the repo's installed browser tooling when possible. If the repo already has Playwright, a minimal one-off probe looks like:

```javascript
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://127.0.0.1:<port>");
await page.getByRole("button", { name: /submit/i }).click();
await page.screenshot({ path: "<absolute-evidence-dir>/ui-harness-after.png", fullPage: true });
await browser.close();
```

Do not add Playwright as a project dependency just for this probe without explicit approval. Prefer existing dev dependencies or external browser tools already available in the environment. A throwaway `playwright-core` install in a temporary directory outside the project needs no approval; run the script from that directory and change the examples' import to `playwright-core`. Pass `channel: "chrome"` or `channel: "msedge"` to `chromium.launch` to use an installed browser with a temporary profile instead of downloading one; fall back to `executablePath` when the channel is not found. With no installed Chrome or Edge, set `PLAYWRIGHT_BROWSERS_PATH` to that temporary directory and install Chromium there. Do not use `--with-deps`; installing system libraries needs approval.

## Generic CDP Harness

For Electron or a Chromium app launched with `--remote-debugging-port=<port>`, connect over CDP:

```javascript
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:<debug-port>");
const pages = browser.contexts().flatMap((context) => context.pages());
let page;
for (const candidate of pages) {
  if (await candidate.locator("<app-root-selector>").count()) {
    page = candidate;
    break;
  }
}

if (!page) {
  console.log(await Promise.all(pages.map(async (p) => ({
    title: await p.title(),
    url: p.url(),
  }))));
  throw new Error("No matching app page found");
}

await page.screenshot({ path: "<absolute-evidence-dir>/ui-harness-cdp.png", fullPage: true });
await browser.close();
```

Replace `<app-root-selector>` with a stable marker from the current repo, such as a root app node, landmark, or product-specific `data-*` attribute.

## Interaction Loop

1. Capture a page snapshot or screenshot before acting.
2. Choose a target from the latest page structure.
3. Perform exactly one structural action: click, type, keypress, drag, scroll, navigate, or resize.
4. Capture a fresh snapshot/screenshot.
5. Verify the expected state change.
6. Save artifacts for before/after comparisons when the user asked for proof.

## CDP Capabilities

Use raw CDP only when higher-level browser APIs are insufficient:

- Performance: CPU profiles, traces, paint flashing, FPS meter, layout shift inspection.
- Memory: heap snapshots and forced GC for leak investigations.
- Network: request blocking, throttling, cache disablement, request/response logs.
- Rendering: viewport changes, color scheme emulation, reduced motion, accessibility checks.
- Debugging: console streaming, exception capture, DOM snapshots.

## Page Selection

When multiple app windows/tabs share a debug port:

- Prefer a positive marker for the surface under test, such as an app root selector.
- Use a negative marker to avoid the wrong surface when necessary.
- If no page matches, list available page titles and URLs instead of guessing.

## Guardrails

- Do not rely on stale element references after navigation or structural changes.
- Avoid coordinate clicks unless a fresh screenshot was captured immediately before the click.
- Keep test data local and disposable.
- Do not store screenshots or heap snapshots from privacy-sensitive workspaces unless the user explicitly agrees.
- Do not hard-code selectors, ports, or script paths from another repository. Discover the current repo's local app markers.
- Bound every wait by an observable ready condition and a timeout. Supervise every background server or probe with an output/completion check.
- Clean up only dev servers, debug sessions, and temp profiles this run created. Keep evidence at its named path and confirm it survives teardown.
- External navigation or interaction must stay within the authorized task. Private SaaS/API operations and external mutations need explicit action approval.
