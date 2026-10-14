// PostToolUse and PostToolUseFailure hook for WebFetch, and for curl, wget, Invoke-WebRequest, and
// Invoke-RestMethod in the Bash and PowerShell tools. When a public page refuses plain fetching, it
// reminds the agent to read the page through the agent-chrome skill instead of settling for
// secondary sources. Agents skipped that step in most blocked sessions.
// settings.json starts it with `bun -e` and no shell, so it runs the same under sh, Git Bash, and
// PowerShell. Shell handlers pass the program their `if` rule matched, a key of PROGRAMS.

type HookInput = {
  hook_event_name: string;
  tool_name: string;
  tool_input?: { url?: unknown; command?: unknown };
  tool_response?: unknown;
  error?: unknown;
};

// Transport errors are checked only on a failed WebFetch, since docs pages about them use the same words.
const FETCH_ERROR = /unable to fetch from|timeout of \d+ms exceeded|\b(ETIMEDOUT|ECONNRESET)\b|socket hang up|unable to verify the first certificate/i;
// WebFetch returns a model-written summary, so these match how a summary describes a block page,
// not words a summary of an ordinary page about HTTP errors or bot detection would use.
const SUMMARY_BLOCK =
  /The server returned HTTP (403|429)\b|Claude Code is unable to fetch from|having trouble accessing Google|Just a moment\b(?!,)|Attention Required|cf_chl|Pardon Our Interruption|Robot or human|(confirm|prove|verify|verifying)[^.]{0,30}\byou(['\u2019]re| are) (a )?human|human verification (page|screen|challenge|check)|are you a robot|not a robot|no robots allowed|bot[- ]?(verification|protection|detection|check) (page|screen|wall|challenge)|bot-verification|captcha (challenge|page|screen|wall|that|to be|must)|(Cloudflare|security|JavaScript|bot) challenge\b|security verification (step|page|screen)|performing security verification|(blocked|protected) by (Cloudflare|DataDome|PerimeterX|Akamai|Imperva)|blocked by network security|you['’](ve| have) been blocked|(is|shows|returned|displays|was) an? ["“]?Access Denied|requires JavaScript to (render|load|display)|JavaScript is (disabled|required)|(contains|contained|includes|included|has|had) only the (page['’]?s? )?title|only (contains|contained|includes|included|had|has|returned|showed) the (page['’]?s? )?title|(weren|wasn)['’]?t captured/i;
// curl and wget print the raw response, so these match block pages' own markup and messages.
const RAW_BLOCK =
  /returned error: (403|429)\b|(?:(?<![\s\S])|\n\r?\n)[ \t]*HTTP\/[\d.]+ (403|429)\b|^< HTTP\/[\d.]+ (403|429)\b|<title>\s*(403|429)\b[^<|]*<\/title>|<title>Error Page \| eBay|<title>\s*Access Denied|^curl: \(\d+\)[^\n]*?(timed out|SSL certificate problem|unable to get local issuer certificate|SEC_E_UNTRUSTED_ROOT)|failed: Connection timed out|Just a moment\.\.\.|Attention Required! \| Cloudflare|cf-mitigated|cf_chl|challenge-platform\/h\/[^/]+\/orchestrate|(?<!\d)px-captcha|Pardon Our Interruption|Robot or human|verif(y|ying) (that )?you['’]?(re| are) (a )?human|are you a robot|not a robot|no robots allowed|blocked by network security|you['’](ve| have) been blocked|Request blocked|unusual traffic|automated access to Amazon data|name="js_challenge"|anomaly-modal|\/httpservice\/retry\/enablejs|Unable to locally verify the issuer's authority|KPSDK\.start=KPSDK\.now/im;
// Readable server-rendered pages carry the same <noscript> notice, so this counts only when the
// page shows almost no text without JavaScript.
const JS_ONLY = /enable (JavaScript|JS)\b|JavaScript is (disabled|required)|requires JavaScript|turn on JavaScript/i;
const WGET_ERROR = /\bERROR (403|429): /;
// Invoke-WebRequest and Invoke-RestMethod errors in PowerShell 7 and Windows PowerShell 5.1. When the
// refusal has a body, PowerShell 7 prints the page's text instead of the status, so the common block
// pages' wording is here too. Checked only in error output, since pages about these errors use it.
const CMDLET_ERROR =
  /Response status code does not indicate success: (403|429)\b[^\r\n]*|The remote server returned an error: \((403|429)\)[^\r\n]*|HttpClient\.Timeout of \d+ seconds elapsing|The operation has timed out|The SSL connection could not be established|Could not establish trust relationship|You don['’]t have permission to access|Access to this page has been denied|Please enable JS and disable any ad blocker|Press & Hold/;
// Exit code alone: curl -s hides the message for a timeout (28) or certificate failure (60).
const CURL_EXIT = /^Exit code (28|60)\b/;
// A status code printed by -w '%{http_code}' starts its line, or follows the label the -w template
// puts before it, such as "<url>: 403" or "HTTP 403". Page prose can also contain such lines, so the
// label must match the template, and when the body is in the output only the line where -w printed
// the code is checked.
const STATUS_LINE = /^(403|429)(\s|$)/m;
const BODY_ELSEWHERE = /(^|\s)(-[a-zA-Z]*[oOI]|--output|--remote-name|--head)\b/;
const LINE_BREAK = /\\n|\n/;

type WriteOut = { label?: RegExp; linesAfter: number };

function parseWriteOut(command: string): WriteOut | undefined {
  const template = command.match(/(?:\s-[a-zA-Z]*w|\s--write-out)[ =]?\s*(?:"([^"]*)"|'([^']*)'|(\S+))/);
  const text = template ? (template[1] ?? template[2] ?? template[3]) : "";
  const at = text.search(/%\{(http|response)_code\}/);
  if (at < 0) return undefined;
  // Lines the template prints after the code, ignoring trailing line breaks.
  const linesAfter = text.slice(at).replace(/(\\n|\n)+$/, "").split(LINE_BREAK).length - 1;
  // The literal text between the last variable or line break and the code; curl prints \t as a tab.
  const label = text.slice(0, at).split(LINE_BREAK).pop()!.replace(/^.*(\}|\$\{?\w+\}?)/, "").replace(/\\t/g, "\t");
  if (label === "") return { linesAfter };
  if (label.trim() === "") return { label: /^\S+[ \t]+(403|429)[ \t]*$/m, linesAfter };
  return { label: new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(403|429)[ \\t]*$`, "m"), linesAfter };
}

// With the body elsewhere every line is -w output; otherwise only the line where -w printed the code.
function writeOutStatus(command: string, text: string, printed: string): RegExpMatchArray | null {
  if (!/%\{(http|response)_code\}/.test(command)) return null;
  const writeOut = parseWriteOut(command);
  const lines = BODY_ELSEWHERE.test(command) || !writeOut ? text : lineFromEnd(printed, writeOut.linesAfter);
  return lines.match(STATUS_LINE) ?? (writeOut?.label ? lines.match(writeOut.label) : null);
}

function lineFromEnd(text: string, offset: number): string {
  const lines = text.trimEnd().split(/\r?\n/);
  return lines[lines.length - 1 - offset] ?? "";
}
// Header-only commands print status lines anywhere, for example after an echoed URL in a loop.
const HEADER_STATUS = /(^|[:\s])HTTP\/[\d.]+ (403|429)\b/m;
const HEADER_ONLY: Record<string, RegExp> = {
  curl: /(^|\s)(--head|-[a-zA-Z]*I)\b/,
  wget: /(^|\s)(--server-response|-[a-zA-Z]*S)\b/,
};

// Length of the text a reader sees without JavaScript, in one linear pass: an unclosed <script>
// hides the rest of the page instead of being searched again for every later tag.
function visibleLength(html: string): number {
  const lower = html.toLowerCase();
  let visible = "";
  let i = 0;
  while (i < html.length) {
    const open = lower.indexOf("<", i);
    visible += html.slice(i, open === -1 ? html.length : open);
    if (open === -1) break;
    const hidden = lower.slice(open + 1, open + 9).match(/^(script|style|noscript|svg)\b/);
    if (hidden) {
      const close = lower.indexOf(`</${hidden[1]}`, open);
      if (close === -1) break;
      i = close + hidden[1].length + 2;
    }
    const end = lower.indexOf(">", hidden ? i : open);
    if (end === -1) break;
    visible += " ";
    i = end + 1;
  }
  return visible.replace(/\s+/g, " ").trim().length;
}

function jsOnlyPage(text: string): RegExpMatchArray | null {
  const hit = text.match(JS_ONLY);
  // JavaScript-only shells are a few KB; a larger page has content of its own.
  return hit && text.length < 100_000 && visibleLength(text) < 1000 ? hit : null;
}

// The names each program runs under. A command that runs several of them gets the reminder only
// from the handler for the first one listed, not from every handler its `if` rules matched.
const PROGRAMS: Record<string, string> = {
  curl: "curl",
  wget: "wget",
  iwr: "Invoke-WebRequest|iwr",
  irm: "Invoke-RestMethod|irm",
};

// Mirrors the wrappers the `if` permission filter strips, so the script sees what `if` matched.
// PowerShell also runs a command after an assignment, as in `$page = iwr …`, and its paths may use
// backslashes. Its command names ignore case.
const commandPrefix = (separators: string, dirs: string) =>
  String.raw`(^|[${separators}]|\$\()\s*((\w+=\S*|do|then|else|elif|if|while|until|!|time|nice|nohup|command|builtin|env|xargs|timeout\s+\S+|stdbuf\s+-\S+)\s+)*(\S*[${dirs}])?`;
const BASH_PREFIX = commandPrefix(String.raw`;&|(\x60{\n`, "/");
const POWERSHELL_PREFIX = commandPrefix(String.raw`;&|(\x60{\n=`, String.raw`/\\`);

function commandRuns(command: string, program: string, powershell: boolean): boolean {
  const prefix = powershell ? POWERSHELL_PREFIX : BASH_PREFIX;
  return new RegExp(`${prefix}(${PROGRAMS[program]})(\\.exe)?\\b`, powershell ? "i" : "").test(command);
}

// Local, private, test, and tailnet hosts are not what the agent Chrome is for.
function isLocal(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const mapped = h.match(/^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/);
  if (mapped) {
    const [hi, lo] = [parseInt(mapped[1], 16), parseInt(mapped[2], 16)];
    return isLocal(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (h.includes(":")) return h === "::1" || /^f[cd]/.test(h) || /^fe[89ab]/.test(h);
  if (!h.includes(".")) return true;
  if (/\.(localhost|localdomain|local|internal|lan|home\.arpa|ts\.net|test|example|invalid)$/.test(h)) return true;
  const ip = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
  );
}

function parseUrl(text: string): URL | undefined {
  try {
    return new URL(text);
  } catch {
    return undefined;
  }
}

function urlsIn(text: string): URL[] {
  return [...text.matchAll(/https?:\/\/[^\s"'`<>;|\\]+/g)].flatMap((m) => {
    const raw = m[0].includes("(") ? m[0] : m[0].replace(/\)+$/, "");
    return parseUrl(raw) ?? [];
  });
}

// Every URL in a command, plus bare host[:port]/path arguments, which curl accepts without a scheme.
function commandHosts(command: string): string[] {
  const bareHosts = command
    .split(/\s+/)
    .map((token) => token.replace(/^["']|["';)]+$/g, ""))
    .filter((token) => /^(localhost|\d+\.\d+\.\d+\.\d+|\[[\da-f:.]+\]|[\w-]+(\.[\w-]+)*\.[a-z][\w-]*)(:\d+)?(\/\S*)?$/i.test(token))
    .flatMap((token) => parseUrl(`http://${token}`)?.hostname ?? []);
  return [...urlsIn(command).map((u) => u.hostname), ...bareHosts];
}

// The page the command fetched, skipping URLs that are option values such as a referer or proxy.
function targetUrl(command: string, program: string): URL | undefined {
  if (program === "iwr" || program === "irm") {
    const cmdletValue = /(^|\s)-(Headers|Proxy|Body|UserAgent)(:|\s+)(@\{[^}]*\}|"[^"]*"|'[^']*'|\S+)/gi;
    return urlsIn(command.replace(cmdletValue, " "))[0];
  }
  // wget's -x, -d, -nd, and -nH take no value.
  const valueFlags = program === "wget" ? "eU" : "eHxAUd";
  const optionValue = new RegExp(String.raw`(^|\s)(-[a-zA-Z]*[${valueFlags}]|--referer|--proxy|--header|--user-agent|--data(-\w+)?)\s+("[^"]*"|'[^']*'|\S+)`, "g");
  return urlsIn(command.replace(optionValue, " "))[0];
}

function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function detect(input: HookInput, program: string | undefined): { url?: URL; signal: string } | undefined {
  const failure = input.hook_event_name === "PostToolUseFailure";
  if (input.tool_name === "WebFetch") {
    const url = parseUrl(asText(input.tool_input?.url));
    if (!url || isLocal(url.hostname)) return undefined;
    const hit = failure ? asText(input.error).match(FETCH_ERROR) ?? asText(input.error).match(SUMMARY_BLOCK) : asText(input.tool_response).match(SUMMARY_BLOCK);
    return hit ? { url, signal: hit[0] } : undefined;
  }
  const powershell = input.tool_name === "PowerShell";
  if ((input.tool_name === "Bash" || powershell) && program) {
    // Bounds regex time on huge heredoc commands; the fetch and its URL come early in real ones.
    const command = asText(input.tool_input?.command).slice(0, 20_000);
    if (!commandRuns(command, program, powershell)) return undefined;
    const earlier = Object.keys(PROGRAMS).slice(0, Object.keys(PROGRAMS).indexOf(program));
    if (earlier.some((other) => commandRuns(command, other, powershell))) return undefined;
    if (commandHosts(command).some(isLocal)) return undefined;
    const url = targetUrl(command, program);
    if (!url) return undefined;
    const response = input.tool_response as { stdout?: unknown; stderr?: unknown } | undefined;
    const text = failure ? asText(input.error) : `${asText(response?.stdout)}\n${asText(response?.stderr)}`;
    // Windows PowerShell 5.1 runs curl and wget as aliases of Invoke-WebRequest, so every program
    // there can fail with a cmdlet error.
    const errorText = failure ? text : asText(response?.stderr);
    const hit =
      text.match(RAW_BLOCK) ??
      jsOnlyPage(text) ??
      (powershell ? errorText.match(CMDLET_ERROR) : null) ??
      text.match(WGET_ERROR) ??
      (failure && program === "curl" ? text.match(CURL_EXIT) : null) ??
      writeOutStatus(command, text, failure ? text : asText(response?.stdout)) ??
      (HEADER_ONLY[program]?.test(command) ? text.match(HEADER_STATUS) : null);
    return hit ? { url, signal: hit[0].trim() } : undefined;
  }
  return undefined;
}

try {
  const input = JSON.parse(await Bun.stdin.text()) as HookInput;
  // `bun -e` puts the handler's argument right after bun; `bun blocked-fetch.ts curl` after the script.
  const found = detect(input, process.argv.slice(1).find((arg) => Object.hasOwn(PROGRAMS, arg)));
  if (found) {
    const additionalContext =
      `Plain fetching could not read ${found.url?.href ?? "this page"} (${found.signal}). ` +
      "Read it with the agent-chrome skill before you use search snippets or secondary sources, guess, or report it as unreadable. " +
      "If agent-chrome already reported this page or its site blocked, follow that skill's After the worker returns section instead. " +
      "An official CLI or API that already authenticates, such as gh for GitHub, comes first when it answers the question. " +
      "If you are a delegated worker whose brief does not assign you the agent Chrome, list this URL under blocked URLs in your result instead, so the coordinator can read it.";
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: input.hook_event_name, additionalContext } }));
  }
} catch {
  // A malformed event must never surface a hook error on every tool call.
}
