#!/usr/bin/env bun
// Runs browser workers in the dedicated agent Chrome. See ../SKILL.md.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_DEVTOOLS_MCP = "chrome-devtools-mcp@1.10.1";
const SERVER = "chrome-devtools";
// Screenshots, select_page, and Lighthouse bring the minimized window to the front and take focus.
// Reading pages never needs upload_file.
const DISALLOWED_TOOLS = ["take_screenshot", "select_page", "lighthouse_audit", "upload_file"];
// The coordinator's Bash calls stop at 600 seconds. The lock wait gets whatever this budget leaves
// after the worker's timeout; starting, minimizing, and closing Chrome take the rest.
const RUN_BUDGET_SECONDS = 525;
const MAX_TIMEOUT_SECONDS = 300;
const START_SECONDS = 20;
const CLOSE_SECONDS = 15;
const LOCK_PORT = Number(process.env.AGENT_CHROME_LOCK_PORT ?? 47913);
const SCRIPT = import.meta.path;

const os = platform();
const profileDir = process.env.AGENT_CHROME_PROFILE ?? defaultProfileDir();

function defaultProfileDir(): string {
  if (os === "win32") return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "agent-chrome");
  if (os === "darwin") return join(homedir(), "Library", "Application Support", "agent-chrome");
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "agent-chrome");
}

function chromePath(): string {
  const candidates =
    os === "win32"
      ? [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA]
          .filter((base): base is string => Boolean(base))
          .map((base) => join(base, "Google", "Chrome", "Application", "chrome.exe"))
      : os === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : ["/opt/google/chrome/chrome"];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Google Chrome not found. Looked in: ${candidates.join(", ")}`);
  return found;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function poll<T>(seconds: number, interval: number, check: () => Promise<T | undefined> | T | undefined): Promise<T | undefined> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result !== undefined) return result;
    await Bun.sleep(interval);
  }
  return undefined;
}

type Chrome = { base: string; browserSocket: string };

// Chrome writes DevToolsActivePort into the profile it runs. Matching its WebSocket path against
// /json/version proves the listener is this profile's Chrome rather than another browser on that port.
async function endpoint(): Promise<Chrome | undefined> {
  const file = join(profileDir, "DevToolsActivePort");
  if (!existsSync(file)) return undefined;
  const [port, path] = readFileSync(file, "utf8").split(/\r?\n/);
  if (!port || !path) return undefined;
  const base = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(2000) });
    const { webSocketDebuggerUrl } = (await response.json()) as { webSocketDebuggerUrl?: string };
    return webSocketDebuggerUrl?.endsWith(path) ? { base, browserSocket: webSocketDebuggerUrl } : undefined;
  } catch {
    return undefined;
  }
}

// The path has to end where the argument ends, so a profile such as agent-chrome-old does not count.
const profileArgument = new RegExp(
  `--user-data-dir="?${profileDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}("|\\s|$)`,
  os === "win32" ? "i" : "",
);

function profileProcessRunning(): boolean {
  if (os === "win32") {
    return Bun.spawnSync([
      "powershell", "-NoProfile", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ForEach-Object { $_.CommandLine }",
    ])
      .stdout.toString()
      .split("\n")
      .some((line) => profileArgument.test(line));
  }
  // Only Chrome's own processes count; a shell or editor can have the profile path in its command line too.
  const chromeBinary = os === "darwin" ? "/Google Chrome.app/Contents/" : "/opt/google/chrome/";
  return Bun.spawnSync(["ps", "-axww", "-o", "command="])
    .stdout.toString()
    .split("\n")
    .some((line) => line.includes(chromeBinary) && profileArgument.test(line));
}

function powershell(script: string): void {
  const result = Bun.spawnSync(["powershell", "-NoProfile", "-NonInteractive", "-Command", script]);
  if (result.exitCode !== 0) throw new Error(`PowerShell failed: ${result.stderr.toString().trim()}`);
}

const psQuote = (value: string) => `'${value.replaceAll("'", "''")}'`;
// Start-Process joins its argument list with spaces, so a value containing a space needs its own quotes.
const startProcessArgument = (arg: string) =>
  psQuote(!arg.includes(" ") ? arg : arg.startsWith("--") ? arg.replace(/=(.*)$/, '="$1"') : `"${arg}"`);
const startProcess = (file: string, args: string[]) =>
  `Start-Process -FilePath ${psQuote(file)} -ArgumentList @(${args.map(startProcessArgument).join(",")})`;

// debugging=false opens a normal, visible window for the user to sign in, with no debugging port that
// sign-in pages such as Google's may detect.
function launch(debugging: boolean): void {
  const args = [
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    ...(debugging
      ? [
          // Port 0 lets Chrome pick a free port and record it in DevToolsActivePort.
          "--remote-debugging-port=0",
          // With a debugging port open, Chrome otherwise reports navigator.webdriver, which sites use
          // to challenge or block automated browsers.
          "--disable-blink-features=AutomationControlled",
          // A minimized window otherwise throttles background tabs until navigations take tens of seconds.
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          "--disable-background-timer-throttling",
          "about:blank",
        ]
      : []),
  ];
  if (os === "win32") {
    if (!debugging) return powershell(startProcess(chromePath(), args));
    // Chrome restores its last window state over a minimized start, and it activates either way,
    // so minimize what appears and hand focus back to the window the user had.
    powershell(`Add-Type -Namespace AgentChrome -Name User32 -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int c);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
'@
$prev = [AgentChrome.User32]::GetForegroundWindow()
$p = ${startProcess(chromePath(), args)} -WindowStyle Minimized -PassThru
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) { $q = Get-Process -Id $p.Id -ErrorAction SilentlyContinue; if ($q -and $q.MainWindowHandle -ne 0) { break }; Start-Sleep -Milliseconds 50 }
$h = (Get-Process -Id $p.Id -ErrorAction SilentlyContinue).MainWindowHandle
if ($h) {
  if (-not [AgentChrome.User32]::IsIconic($h)) { [AgentChrome.User32]::ShowWindowAsync($h, 6) | Out-Null; Start-Sleep -Milliseconds 200 }
  if ($prev -ne [IntPtr]::Zero -and $prev -ne $h -and [AgentChrome.User32]::GetForegroundWindow() -eq $h) { [AgentChrome.User32]::SetForegroundWindow($prev) | Out-Null }
}`);
  } else if (os === "darwin") {
    const opened = Bun.spawnSync(["open", ...(debugging ? ["-g", "-j"] : []), "-na", "Google Chrome", "--args", ...args]);
    if (opened.exitCode !== 0) throw new Error(`open could not start Google Chrome: ${opened.stderr.toString().trim()}`);
  } else {
    // xdotool can minimize only X11 windows, so this Chrome runs under X11, or XWayland in a Wayland session.
    const minimize = debugging && Boolean(Bun.which("xdotool")) && Boolean(process.env.DISPLAY);
    const platformArgs = minimize ? ["--ozone-platform=x11"] : [];
    Bun.spawn(["setsid", "-f", chromePath(), ...platformArgs, ...args], { stdio: ["ignore", "ignore", "ignore"] });
    if (minimize) minimizeOnX11();
  }
}

function minimizeOnX11(): void {
  const chrome = chromePath();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    // The browser process is the Chrome binary itself with this profile; its helpers carry --type=,
    // and the crash handler is a different binary.
    const browserPid = Bun.spawnSync(["ps", "-axww", "-o", "pid=,command="])
      .stdout.toString()
      .split("\n")
      .map((line) => line.trim().match(/^(\d+)\s+(.*)$/))
      .find((match) => match?.[2]?.startsWith(`${chrome} `) && profileArgument.test(match[2]) && !match[2].includes("--type="))?.[1];
    const windows = browserPid
      ? Bun.spawnSync(["xdotool", "search", "--onlyvisible", "--pid", browserPid]).stdout.toString().split("\n").filter(Boolean)
      : [];
    if (windows.length > 0) {
      for (const window of windows) Bun.spawnSync(["xdotool", "windowminimize", window]);
      return;
    }
    Bun.sleepSync(100);
  }
}

async function startChrome(): Promise<Chrome> {
  const existing = await endpoint();
  if (existing) return existing;
  if (profileProcessRunning()) {
    throw new Error(
      `The agent Chrome (${profileDir}) is open without its debugging endpoint, usually for sign-in. Close that Chrome window when signing in is done, then run again.`,
    );
  }
  launch(true);
  const started = await poll(START_SECONDS, 250, endpoint);
  if (!started) throw new Error(`The agent Chrome did not open its debugging endpoint within ${START_SECONDS} seconds.`);
  return started;
}

// Chrome closes after every run, because any local process can use its unauthenticated debugging
// port to read every cookie while it is open.
async function closeChrome(chrome: Chrome): Promise<boolean> {
  try {
    const socket = new WebSocket(chrome.browserSocket);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
      setTimeout(() => reject(new Error("timeout")), 5000);
    });
    socket.send(JSON.stringify({ id: 1, method: "Browser.close" }));
  } catch {
    return false;
  }
  // Wait for the process itself, so the next run does not find the profile still in use.
  return (await poll(CLOSE_SECONDS, 250, () => (profileProcessRunning() ? undefined : true))) ?? false;
}

type Target = { id: string; type: string; url: string; title: string };

async function pages(base: string): Promise<Target[]> {
  const response = await fetch(`${base}/json/list`, { signal: AbortSignal.timeout(5000) });
  return ((await response.json()) as Target[]).filter((target) => target.type === "page");
}

// Workers run one at a time, because each run closes the Chrome that all workers would share. A
// listening port is the lock because the OS releases it when the holder exits, however it exits.
function tryLock(): boolean {
  try {
    Bun.listen({ hostname: "127.0.0.1", port: LOCK_PORT, socket: { data() {} } });
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "EADDRINUSE") return false;
    throw new Error(`Cannot take the worker lock on 127.0.0.1:${LOCK_PORT}: ${message(error)}`);
  }
}

async function locked(): Promise<boolean> {
  try {
    const socket = await Bun.connect({ hostname: "127.0.0.1", port: LOCK_PORT, socket: { data() {} } });
    socket.end();
    return true;
  } catch {
    return false;
  }
}

// On macOS and Linux this kills only the worker; its MCP server exits when the worker's pipe closes.
function stopWorker(pid: number): void {
  if (os === "win32") Bun.spawnSync(["taskkill", "/PID", String(pid), "/T", "/F"]);
  else process.kill(pid, "SIGKILL");
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Chrome and the watchdog start outside this script's process tree and process group, so they
// survive when the coordinator kills a run. The watchdog then stops the worker, closes Chrome, and
// removes the run's files.
function startWatchdog(workerPid: number, workDir: string): void {
  const args = [SCRIPT, "watchdog", String(process.pid), String(workerPid), workDir];
  if (os === "win32") powershell(`${startProcess(process.execPath, args)} -WindowStyle Hidden`);
  // A short-lived helper starts the watchdog in a new session and exits, so the watchdog is
  // neither a descendant of this run nor in its process group.
  else {
    const helper = Bun.spawnSync([process.execPath, SCRIPT, "detach", ...args]);
    if (helper.exitCode !== 0) throw new Error(`Could not start the watchdog: ${helper.stderr.toString().trim()}`);
  }
}

async function watchdog(runPid: number, workerPid: number, workDir: string): Promise<void> {
  while (alive(runPid)) await Bun.sleep(1000);
  if (alive(workerPid)) stopWorker(workerPid);
  rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  // A run that finished normally already closed Chrome. When another run holds the lock, Chrome is its.
  if (!tryLock()) return;
  const chrome = await endpoint();
  if (chrome) await closeChrome(chrome);
}

function configuredModel(): string | undefined {
  try {
    const settings = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "settings.json");
    return (JSON.parse(readFileSync(settings, "utf8")) as { model?: string }).model;
  } catch {
    return undefined;
  }
}

// The worker reads untrusted pages, so it gets only what it needs to run and reach the model:
// nothing that ties it to the coordinator's session or carries other credentials.
const WORKER_ENV =
  /^(ANTHROPIC_\w+|API_TIMEOUT_MS|MCP_\w+|DISABLE_TELEMETRY|CLAUDE_CODE_(ENABLE_GATEWAY_MODEL_DISCOVERY|ATTRIBUTION_HEADER|DISABLE_\w+)|HTTPS?_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS|SSL_CERT_\w+|PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|USERPROFILE|HOMEDRIVE|HOMEPATH|HOME|USER|USERNAME|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMW6432|COMMONPROGRAMFILES|TEMP|TMP|TMPDIR|LANG|LC_\w+|TERM|SHELL)$/i;

type Outcome = Record<string, unknown>;

async function runWorker(brief: string, timeoutSeconds: number): Promise<Outcome> {
  const lockWait = RUN_BUDGET_SECONDS - timeoutSeconds;
  if (!(await poll(lockWait, 1000, () => (tryLock() ? true : undefined)))) {
    return { status: "busy", detail: `Another worker held the agent Chrome for over ${lockWait} seconds.` };
  }
  let chrome: Chrome;
  try {
    chrome = await startChrome();
  } catch (error) {
    return { status: "chrome_unavailable", detail: message(error) };
  }
  let workDir: string | undefined;
  let outcome: Outcome;
  try {
    workDir = mkdtempSync(join(tmpdir(), "agent-chrome-worker-"));
    outcome = await runInChrome(chrome.base, workDir, brief, timeoutSeconds);
  } catch (error) {
    outcome = { status: "error", detail: message(error) };
  }
  const chromeClosed = await closeChrome(chrome).catch(() => false);
  if (workDir) {
    try {
      rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {}
  }
  return { ...outcome, chromeClosed };
}

async function runInChrome(base: string, workDir: string, brief: string, timeoutSeconds: number): Promise<Outcome> {
  // Tabs a session restored or a killed run left behind would otherwise sit beside the worker's.
  for (const page of (await pages(base)).slice(1)) {
    await fetch(`${base}/json/close/${page.id}`, { signal: AbortSignal.timeout(2000) }).catch(() => undefined);
  }

  // The worker gets its own temp directory, which is also the only place the MCP server writes
  // files, and an empty config directory, so it loads none of the user's instructions or settings.
  const tempDir = join(workDir, "tmp");
  const configDir = join(workDir, "config");
  mkdirSync(tempDir);
  mkdirSync(configDir);
  const mcpConfig = join(workDir, "mcp.json");
  writeFileSync(
    mcpConfig,
    JSON.stringify({
      mcpServers: {
        [SERVER]: {
          command: process.execPath,
          args: [
            "x", "--bun", CHROME_DEVTOOLS_MCP,
            "--browserUrl", base,
            "--no-usage-statistics",
            "--no-performance-crux",
            "--no-javascript-evaluation",
            "--no-category-performance",
            "--no-category-network",
            "--no-category-emulation",
            "--no-category-memory",
          ],
          env: {
            CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: "1",
            CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
            TEMP: tempDir,
            TMP: tempDir,
            TMPDIR: tempDir,
          },
        },
      },
    }),
  );

  const claude = process.env.CLAUDE_CODE_EXECPATH ?? Bun.which("claude");
  if (!claude) throw new Error("The claude CLI is not on PATH.");
  const model = configuredModel();
  const env: Record<string, string> = { CLAUDE_CONFIG_DIR: configDir, MAX_MCP_OUTPUT_TOKENS: "60000" };
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined && WORKER_ENV.test(key)) env[key] = value;

  const worker = Bun.spawn(
    [
      claude, "-p",
      "--no-session-persistence",
      "--restricted",
      "--strict-mcp-config", "--mcp-config", mcpConfig,
      // Claude Code saves a large page snapshot to a file in the run folder and returns its path, so the
      // worker reads it back with Read and Grep; restricted mode keeps those tools inside that folder.
      "--tools", "ToolSearch,Read,Grep",
      "--allowedTools", `mcp__${SERVER},Read,Grep`,
      "--disallowedTools", DISALLOWED_TOOLS.map((tool) => `mcp__${SERVER}__${tool}`).join(","),
      "--permission-prompts", "none",
      "--output-format", "json",
      ...(model ? ["--model", model] : []),
    ],
    { cwd: workDir, env, stdin: new Blob([brief]), stdout: "pipe", stderr: "pipe" },
  );
  try {
    startWatchdog(worker.pid, workDir);
  } catch (error) {
    stopWorker(worker.pid);
    throw error;
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    stopWorker(worker.pid);
  }, timeoutSeconds * 1000);
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(worker.stdout).text(),
    new Response(worker.stderr).text(),
    worker.exited,
  ]);
  clearTimeout(timer);
  if (timedOut) return { status: "worker_timeout", timeoutSeconds };
  let report: unknown = stdout.trim();
  try {
    report = JSON.parse(stdout);
  } catch {}
  const failed = exitCode !== 0 || typeof report !== "object" || (report as { is_error?: boolean }).is_error === true;
  return {
    status: failed ? "worker_failed" : "finished",
    exitCode,
    worker: report,
    ...(stderr.trim() ? { stderr: stderr.trim().slice(-2000) } : {}),
  };
}

function parseRunOptions(args: string[]): { brief?: string; timeout: number } {
  const options = { brief: undefined as string | undefined, timeout: MAX_TIMEOUT_SECONDS };
  for (let i = 0; i < args.length; i += 2) {
    const [flag, value] = [args[i], args[i + 1]];
    if (value === undefined) throw new Error(`${flag} needs a value.`);
    if (flag === "--brief") options.brief = value;
    else if (flag === "--timeout") {
      options.timeout = Number(value);
      if (!Number.isInteger(options.timeout) || options.timeout < 1 || options.timeout > MAX_TIMEOUT_SECONDS) {
        throw new Error(`--timeout takes whole seconds from 1 to ${MAX_TIMEOUT_SECONDS}.`);
      }
    } else throw new Error(`Unknown option ${flag}.`);
  }
  return options;
}

const USAGE = `Usage: agent-chrome.ts <command>
  run --brief <file> [--timeout <seconds>]
            Run one browser worker and print its outcome as JSON. The timeout defaults to ${MAX_TIMEOUT_SECONDS} seconds.
  signin    Open the agent Chrome as a normal window, without debugging, for the user to sign in.
  status    Report whether the agent Chrome is open, whether it has its debugging port, whether a worker runs, and open tabs.
  close     Close an agent Chrome that a killed run left open with its debugging port.`;

async function main(command: string | undefined, rest: string[]): Promise<void> {
  switch (command) {
    case "run": {
      const options = parseRunOptions(rest);
      if (!options.brief) throw new Error("Pass the brief with --brief <file>.");
      const brief = readFileSync(options.brief, "utf8");
      if (!brief.trim()) throw new Error(`The brief file ${options.brief} is empty.`);
      console.log(JSON.stringify(await runWorker(brief, options.timeout), null, 2));
      return;
    }
    case "signin": {
      if (!tryLock()) throw new Error("A worker is running. Run signin after it finishes.");
      const chrome = await endpoint();
      if (chrome) {
        if (!(await closeChrome(chrome))) throw new Error("The agent Chrome did not close.");
      } else if (profileProcessRunning()) {
        throw new Error("The agent Chrome is already open. Sign in there, then close its window.");
      }
      launch(false);
      console.log("The agent Chrome is open for sign-in. Sign in, then close its window.");
      return;
    }
    case "status": {
      const chrome = await endpoint();
      const open = chrome ? (await pages(chrome.base).catch(() => [])).map(({ title, url }) => ({ title, url })) : [];
      console.log(JSON.stringify({ profileDir, running: Boolean(chrome) || profileProcessRunning(), debugging: Boolean(chrome), workerRunning: await locked(), pages: open }, null, 2));
      return;
    }
    case "close": {
      if (!tryLock()) throw new Error("A worker is running; it closes Chrome when it finishes.");
      const chrome = await endpoint();
      if (!chrome) return console.log("The agent Chrome has no debugging port open.");
      console.log((await closeChrome(chrome)) ? "Closed the agent Chrome." : "The agent Chrome did not close.");
      return;
    }
    case "watchdog":
      return watchdog(Number(rest[0]), Number(rest[1]), String(rest[2]));
    case "detach":
      spawn(process.execPath, rest, { detached: true, stdio: "ignore" }).unref();
      return;
    default:
      console.error(USAGE);
      process.exit(2);
  }
}

const [command, ...rest] = process.argv.slice(2);
try {
  await main(command, rest);
  process.exit(0);
} catch (error) {
  if (command === "run") console.log(JSON.stringify({ status: "error", detail: message(error) }, null, 2));
  else console.error(message(error));
  process.exit(1);
}
