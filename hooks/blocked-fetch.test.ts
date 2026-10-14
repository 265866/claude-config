import { expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Cases come from real block pages, WebFetch summaries, and the false positives each review round found.
const HOOK = `${import.meta.dir}/blocked-fetch.ts`;
type Case = [name: string, want: boolean | string, arg: string, input: unknown];
const wf = (url: string, result: string) => ({ hook_event_name: "PostToolUse", tool_name: "WebFetch", tool_input: { url }, tool_response: { code: 200, result } });
const wff = (url: string, error: string) => ({ hook_event_name: "PostToolUseFailure", tool_name: "WebFetch", tool_input: { url }, error });
const sh = (command: string, stdout: string) => ({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command }, tool_response: { stdout, stderr: "" } });
const shf = (command: string, error: string) => ({ hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: { command }, error });
const ps = (command: string, stdout: string, stderr = "") => ({ ...sh(command, stdout), tool_name: "PowerShell", tool_response: { stdout, stderr } });
const psf = (command: string, error: string) => ({ ...shf(command, error), tool_name: "PowerShell" });

const cases: Case[] = [
  // real WebFetch block texts and summaries
  ["wf 403", true, "", wf("https://www.homedepot.com/p/1", "The server returned HTTP 403 Forbidden.\n\nThe response body was not retrieved.")],
  ["wf 429", true, "", wf("https://chefman.com/x", "The server returned HTTP 429 Too Many Requests. Retry-After: 60")],
  ["wf timeout", true, "", wff("https://www.bestbuy.com/x", "timeout of 60000ms exceeded")],
  ["wf unable", true, "", wff("https://www.reddit.com/r/x", "Claude Code is unable to fetch from www.reddit.com")],
  ["wf cert", true, "", wff("https://www.cdph.ca.gov/x", "unable to verify the first certificate")],
  ["wf samsclub", true, "", wf("https://www.samsclub.com/x", "The page is a Sam's Club bot-verification screen (\"Let us know you're human\").")],
  ["wf only title", true, "", wf("https://a.com/x", "The page content I received contains only the title Pricing.")],
  ["wf weren't captured", true, "", wf("https://a.com/x", "The pricing tables likely load dynamically and weren’t captured.")],
  ["wf bot-protection", true, "", wf("https://a.com/x", "This appears to be a bot-protection page, not the product.")],
  ["wf captcha challenge", true, "", wf("https://a.com/x", "The content is a CAPTCHA challenge.")],
  ["wf perimeterx", true, "", wf("https://a.com/x", "A human verification challenge (PerimeterX).")],
  ["wf walmart", true, "", wf("https://www.walmart.com/ip/1", "Robot or human? Activate and hold the button to confirm that you’re human.")],
  ["wf reddit", true, "", wf("https://www.reddit.com/x", "You have been blocked by network security.")],
  ["wf cf verification", true, "", wf("https://a.com/x", "Performing security verification")],
  ["wf just a moment", true, "", wf("https://a.com/x", "The page only says \"Just a moment\" while it checks the browser.")],
  ["wf cloudflare challenge", true, "", wf("https://a.com/x", "The fetch returned a Cloudflare security challenge instead of content.")],
  ["wf datadome", true, "", wf("https://a.com/x", "The site is protected by DataDome and showed a captcha that must be solved.")],
  ["wf akamai access denied", true, "", wf("https://a.com/x", "The page is an Access Denied error from Akamai.")],
  ["wf needs js", true, "", wf("https://a.com/x", "The page requires JavaScript to render its listings.")],
  // WebFetch summaries of ordinary pages
  ["wf MDN 403", false, "", wf("https://developer.mozilla.org/x", "The HTTP 403 Forbidden client error response status code indicates the server understood the request.")],
  ["wf GitHub rate docs", false, "", wf("https://docs.github.com/x", "The API returns HTTP 429 or HTTP 403 when you exceed the rate limit.")],
  ["wf S3 docs", false, "", wf("https://docs.aws.amazon.com/x", "How to troubleshoot Access Denied (403 Forbidden) errors in Amazon S3.")],
  ["wf next docs", false, "", wf("https://nextjs.org/x", "The component is rendered client-side after hydration.")],
  ["wf MDN noscript", false, "", wf("https://developer.mozilla.org/x", "The noscript element shows a message to enable JavaScript.")],
  ["wf react lazy", false, "", wf("https://react.dev/x", "Components can be loaded dynamically with lazy().")],
  ["wf captcha vendor", false, "", wf("https://2captcha.com/x", "Yes, 2Captcha lists TikTok Captcha as a supported task type.")],
  ["wf bot detection article", false, "", wf("https://a.com/x", "TikTok uses bot detection and device fingerprinting.")],
  ["wf local", false, "", wff("http://localhost:3000/x", "timeout of 60000ms exceeded")],
  ["wf .test host", false, "", wff("http://myapp.test/x", "timeout of 60000ms exceeded")],
  // curl/wget blocks
  ["curl -f fail", "https://www.lowes.com/pd/x", "curl", shf("curl -fsSL https://www.lowes.com/pd/x", "Exit code 22\ncurl: (22) The requested URL returned error: 403")],
  ["cd && curl -I 429", true, "curl", sh("cd /tmp && curl -sI https://www.ebay.com/x", "HTTP/2 429")],
  ["timeout curl title", true, "curl", sh("timeout 20 curl -s https://x.example.org/a", "<html><title>403 Forbidden</title>")],
  ["time curl cloudflare", true, "curl", sh("time curl -s https://www.coinbase.com/ | grep -o '<title>.*</title>'", "<title>Just a moment...</title>")],
  ["for loop http_code", true, "curl", sh("for u in https://www.coinbase.com/ https://openai.com/; do curl -s -o /dev/null -w '%{http_code}\\n' \"$u\"; done", "403\n403")],
  ["xargs curl", true, "curl", sh("echo https://www.zillow.com/x | xargs curl -s", "<div id=\"px-captcha\"></div>")],
  ["subshell capture", "https://www.coinbase.com/", "curl", sh("x=$(curl -s https://www.coinbase.com/); echo \"$x\" | head -c 200", "<title>Just a moment...</title>")],
  ["referer first", "https://www.zillow.com/homes/x", "curl", sh("curl -s -H 'Referer: https://www.google.com/' https://www.zillow.com/homes/x", "px-captcha")],
  ["-e referer", "https://www.zillow.com/homes/x", "curl", sh("curl -s -e https://www.google.com/ https://www.zillow.com/homes/x", "px-captcha")],
  ["wikipedia parens", "https://en.wikipedia.org/wiki/Foo_(bar)", "curl", sh("curl -s https://en.wikipedia.org/wiki/Foo_(bar)", "HTTP/1.1 403")],
  ["akamai title", true, "curl", sh("curl -s https://www.homedepot.com/x", "<HTML><HEAD><TITLE>Access Denied</TITLE>")],
  ["curl tls openssl", true, "curl", shf("curl -s https://www.cdph.ca.gov/x", "Exit code 60\ncurl: (60) SSL certificate problem: unable to get local issuer certificate")],
  ["curl tls schannel", true, "curl", shf("curl -s https://www.cdph.ca.gov/x", "Exit code 35\ncurl: (35) schannel: next InitializeSecurityContext failed: SEC_E_UNTRUSTED_ROOT")],
  ["http_code status first", true, "curl", sh("curl -s -o /dev/null -w '%{http_code} %{size_download}' https://www.ebay.com/sch", "403 1832")],
  ["wget 403", true, "wget", sh("wget -q https://www.zoro.com/x", "ERROR 403: Forbidden.")],
  // should stay silent
  ["discord cf jsd", false, "curl", sh("curl -s https://discord.com/", "<script src=\"/cdn-cgi/challenge-platform/scripts/jsd/main.js\"></script>")],
  ["curl localhost bare", false, "curl", sh("curl -s localhost:3000/api/items", "{\"error\":\"Access Denied\"}")],
  ["curl local + Origin", false, "curl", sh("curl -s -H \"Origin: https://app.example.com\" http://localhost:3000/api", "Request blocked")],
  ["curl $API", false, "curl", sh("curl -s \"$API/items\"", "<title>Access Denied</title>")],
  ["curl ts.net", false, "curl", sh("curl -sI https://moss.tail7dd884.ts.net:8317/", "HTTP/1.1 403")],
  ["curl mapped v6 local", false, "curl", sh("curl -sI http://[::ffff:127.0.0.1]:3000/", "HTTP/1.1 403")],
  ["local in subshell", false, "curl", sh("curl -s https://x.com/p; (curl -s http://localhost:3000)", "HTTP/1.1 403")],
  ["echo mentions curl", false, "curl", sh("f(){ :; }; f; echo \"see curl https://example.net output: returned error: 403\"", "see curl https://example.net output: returned error: 403")],
  ["git message mentions curl", false, "curl", sh("git log --oneline | head", "abc fix curl returned error: 403 handling")],
  ["wget defers to curl", false, "wget", sh("curl -f https://a.com/x && wget https://b.com/y", "ERROR 403")],
  ["body line 429 status 200", false, "curl", sh("curl -s -w '\\n%{http_code}' https://api.example.org/items", "items:\n  count 429 total\n200")],
  ["curl ok 200", false, "curl", sh("curl -s -o /dev/null -w %{http_code} https://example.com", "200")],
  ["malformed", false, "", "not json"],
  ["UA Windows NT 10.0", true, "curl", sh("curl -s -A \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/154\" https://www.coinbase.com/", "<title>Just a moment...</title>")],
  ["loop with sleep 0.5", true, "curl", sh("for q in a b; do curl -s -o /dev/null -w '%{http_code}\\n' \"https://www.ebay.com/sch/i.html?_nkw=$q\"; sleep 0.5; done", "429\n429")],
  ["wget UA 10.0", true, "wget", sh("wget -U 'Mozilla/5.0 (Windows NT 10.0; Win64)' https://www.zoro.com/x", "ERROR 403: Forbidden.")],
  ["wf nodejs errors docs", false, "", wf("https://nodejs.org/api/errors.html", "ECONNRESET: A connection was forcibly closed by a peer. ETIMEDOUT: A connect or send request failed.")],
  ["wf axios issue", false, "", wf("https://github.com/axios/axios/issues/1", "Users report 'timeout of 5000ms exceeded' when the server is slow.")],
  ["wf apple js-only", true, "", wf("https://developer.apple.com/documentation/swiftui/navigationstack", "The page content only included the title, so this answer is based on general knowledge.")],
  ["curl -s exit 28", true, "curl", shf("curl -s https://www.bestbuy.com/", "Exit code 28")],
  ["ebay error page", true, "curl", sh("curl -s 'https://www.ebay.com/sch/i.html?_nkw=ps5'", "<title>Error Page | eBay</title> SORRY Something went wrong")],
  ["wikipedia HTTP_403 page", false, "curl", sh("curl -s https://en.wikipedia.org/wiki/HTTP_403", "<title>HTTP 403 - Wikipedia</title> ... Error 403 ... <pre>HTTP/1.1 403 Forbidden</pre>")],
  ["mdn 403 page", false, "curl", sh("curl -s https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403", "<title>403 Forbidden - HTTP | MDN</title><pre>HTTP/1.1 403 Forbidden</pre>")],
  ["curl -v 403 still fires", true, "curl", sh("curl -sv https://www.lowes.com/x 2>&1 | head", "* Connected\n< HTTP/2 403\n< server: AkamaiGHost")],
  ["googlebot UA naming", "https://www.zillow.com/x", "curl", sh("curl -s -A \"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\" https://www.zillow.com/x", "px-captcha")],
  ["-sH referer naming", "https://www.zillow.com/x", "curl", sh("curl -sH 'Referer: https://www.google.com/' https://www.zillow.com/x", "px-captcha")],
  ["wf human in the loop", false, "", wf("https://docs.example.org/agents", "The agent should confirm risky actions with a human before they run.")],
  ["wf human-readable", false, "", wf("https://docs.example.org/x", "Use this flag to verify the output is human-readable.")],
  ["response_code", true, "curl", sh("curl -s -o /dev/null -w '%{response_code}' https://www.ebay.com/sch", "403")],
  ["javadoc noscript readable", false, "curl", sh("curl -s https://docs.oracle.com/javase/8/docs/api/java/lang/String.html", "<noscript><div>JavaScript is disabled on your browser.</div></noscript><main>" + "The String class represents character strings. ".repeat(60) + "</main>")],
  ["apple js-only shell", true, "curl", sh("curl -s https://developer.apple.com/documentation/swiftui", "<html><body><noscript>This page requires JavaScript. Please turn on JavaScript in your browser and refresh the page.</noscript><div id=app></div><script>var x=1</script></body></html>")],
  ["datadome js shell", true, "curl", sh("curl -s https://www.etsy.com/listing/1", "<html><body><p>Please enable JS and disable any ad blocker</p><script src=https://ct.captcha-delivery.com/c.js></script></body></html>")],
  ["reddit js_challenge", true, "curl", sh("curl -s https://www.reddit.com/r/programming/", "<form name=\"js_challenge\" method=post><input name=solution></form>")],
  ["amazon bot page", true, "curl", sh("curl -s https://www.amazon.com/dp/B08N5WRWNW", "To discuss automated access to Amazon data please contact api-services-support@amazon.com.")],
  ["rfc example 429", false, "curl", sh("curl -s https://httpwg.org/specs/rfc6585.html", "<h2>429 Too Many Requests</h2><pre>\nHTTP/1.1 429 Too Many Requests\nContent-Type: text/html\n</pre>")],
  ["-sIL 301 then 403", true, "curl", sh("curl -sIL https://www.lowes.com/x", "HTTP/2 301\r\nlocation: https://www.lowes.com/y\r\n\r\nHTTP/2 403\r\nserver: AkamaiGHost\r\n")],
  ["wf github issue summary", false, "", wf("https://github.com/github/docs/issues/17358", "Users report curl requests to docs.github.com returned HTTP 403 with a bot page.")],
  ["wf cloudflare docs", false, "", wf("https://developers.cloudflare.com/cloudflare-challenges/", "Cloudflare Challenges check whether a visitor is human.")],
  ["wget -nd naming", "https://www.zoro.com/x", "wget", sh("wget -nd https://www.zoro.com/x", "ERROR 403: Forbidden.")],
  ["errno man page", false, "curl", sh("curl -sL https://man7.org/linux/man-pages/man3/errno.3.html", "<dt>ETIMEDOUT</dt><dd>Connection timed out (POSIX.1-2001).</dd><dt>EPROTO</dt><dd>SSL certificate problem docs</dd>")],
  ["curl -sS timeout stderr", true, "curl", shf("curl -sS https://www.bestbuy.com/", "Exit code 28\ncurl: (28) Operation timed out after 30002 milliseconds with 0 bytes received")],
  ["windows curl connect timeout", true, "curl", shf("curl -sS https://www.bestbuy.com/", "Exit code 28\ncurl: (28) Failed to connect to www.bestbuy.com port 443 after 21045 ms: Timed out")],
  ["wget connect timeout", true, "wget", shf("wget https://www.bestbuy.com/", "Exit code 4\nConnecting to www.bestbuy.com|23.1.2.3|:443... failed: Connection timed out.")],
  ["duckduckgo anomaly", true, "curl", sh("curl -sL 'https://html.duckduckgo.com/html/?q=bun+runtime'", "<div class=\"anomaly-modal__title\">Unfortunately, bots use DuckDuckGo too.</div>")],
  ["google enablejs", true, "curl", sh("curl -sL 'https://www.google.com/search?q=bun+runtime'", "<meta http-equiv=\"refresh\" content=\"0;url=/httpservice/retry/enablejs?sei=x\">")],
  ["wf google fallback", true, "", wf("https://www.google.com/search?q=bun", "The content is a Google Search fallback message saying \"If you're having trouble accessing Google Search, please click here.\"")],
  ["loop echo url then -sI", true, "curl", sh("for u in https://www.lowes.com/ https://www.homedepot.com/; do echo \"$u\"; curl -sI \"$u\" | head -1; done", "https://www.lowes.com/\nHTTP/1.1 403 Forbidden\nhttps://www.homedepot.com/\nHTTP/1.1 403 Forbidden")],
  ["-w url label", true, "curl", sh("for u in https://www.ebay.com/sch/i.html; do curl -s -o /dev/null -w \"$u HTTP %{http_code}\\n\" \"$u\"; done", "https://www.ebay.com/sch/i.html HTTP 403")],
  ["-si rfc example silent", false, "curl", sh("curl -si https://httpwg.org/specs/rfc6585.html", "HTTP/1.1 200 OK\ncontent-type: text/html\n\n<pre>\nHTTP/1.1 429 Too Many Requests\n</pre>")],
  ["wikipedia thumbnail px-captcha", false, "curl", sh("curl -s https://en.wikipedia.org/wiki/CAPTCHA | grep -o 'src=[^ ]*png'", "src=//upload.wikimedia.org/thumb/250px-captcha.png")],
  ["-w body with prose ending 403", false, "curl", sh("curl -s -w '\\n%{http_code}\\n' https://docs.aws.amazon.com/AmazonS3/latest/userguide/troubleshoot-403-errors.html", "<p>The request was\nrejected with an HTTP 403\nwhen the policy denies it.</p>\n200\n")],
  ["-D file rfc silent", false, "curl", sh("curl -s -D /tmp/h.txt https://httpwg.org/specs/rfc6585.html", "<pre>\nContent-Type: text/html\nHTTP/1.1 429 Too Many Requests\n</pre>")],
  ["-o /dev/null url: 403", true, "curl", sh("for u in https://www.ebay.com/a; do curl -s -o /dev/null -w \"$u: %{http_code}\\n\" \"$u\"; done", "https://www.ebay.com/a: 403")],
  ["-w HTTP label after body", true, "curl", sh("curl -s -w '\\nHTTP %{http_code}\\n' https://www.hyatt.com/", "<html><body>Access to this page has been denied.</body></html>\nHTTP 403\n")],
  ["-w Status label after empty body", true, "curl", sh("curl -s -w '\\nStatus: %{http_code}\\n' https://crates.io/", "\nStatus: 403\n")],
  ["-fs -w failure", true, "curl", shf("curl -fs -w '\\nHTTP_CODE:%{http_code}' https://www.petco.com/", "Exit code 22\n\nHTTP_CODE:403")],
  ["kasada challenge", true, "curl", sh("curl -sL https://www.chewy.com/", "<script>window.KPSDK={};KPSDK.now=typeof performance!=='undefined'?performance.now.bind(performance):Date.now.bind(Date);KPSDK.start=KPSDK.now();</script><script src=\"/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/ips.js?KP_UIDz=x\"></script>")],
  ["kasada readable page", false, "curl", sh("curl -sL https://www.nike.com/", "<script>KPSDK.configure([{protocol:'https:',method:'POST'}])</script><main>" + "Just Do It. Shop the latest shoes. ".repeat(50) + "</main>")],
  ["save then sed docs page", false, "curl", sh("curl -sL -o /tmp/p.html -w '%{http_code}\\n' https://docs.aws.amazon.com/AmazonS3/latest/userguide/troubleshoot-403-errors.html && sed -n 150,170p /tmp/p.html", "200\nrequests that specify SSE-C encryption will be rejected with an HTTP 403\nwhen the key is wrong.")],
  ["--write-out= label", true, "curl", sh("curl -s -o /dev/null --write-out='code=%{http_code}\\n' https://www.ebay.com/sch", "code=403")],
  ["-sw combined label", true, "curl", sh("curl -sw 'HTTP %{http_code}' -o /dev/null https://www.hyatt.com/", "HTTP 403")],
  ["url space code", true, "curl", sh("for u in https://www.ebay.com/a; do curl -s -o /dev/null -w \"%{url_effective} %{http_code}\\n\" \"$u\"; done", "https://www.ebay.com/a 403")],
  ["tab label", true, "curl", sh("curl -s -o NUL -w '%{url_effective}\\t%{http_code}\\n' https://httpbin.org/status/403", "https://httpbin.org/status/403\t403\r\n")],
  ["tab label 200 silent", false, "curl", sh("curl -s -o NUL -w '%{url_effective}\\t%{http_code}\\n' https://example.com/", "https://example.com/\t200\r\n")],
  ["code not on last line", true, "curl", sh("curl -s -w '\\nHTTP: %{http_code}\\nTime: %{time_total}s\\n' https://www.hyatt.com/", "<html>denied</html>\nHTTP: 403\nTime: 0.284029s\n")],
  ["body line starting 429", false, "curl", sh("curl -s -w '\\n%{http_code}\\n' https://raw.githubusercontent.com/o/r/main/addresses.txt", "Jane Doe\n429 Main Street\nSpringfield\n200\n")],
  ["wget cert", true, "wget", shf("wget https://www.cdph.ca.gov/x", "Exit code 5\nERROR: cannot verify www.cdph.ca.gov's certificate. Unable to locally verify the issuer's authority.")],
  // PowerShell tool, from a recorded Windows session with PowerShell 7.6 and from Windows PowerShell 5.1
  ["ps curl.exe -w 403", true, "curl", ps("curl.exe -sS -o NUL -w \"%{http_code}\" https://httpbin.org/status/403", "403")],
  ["ps curl -i 429", true, "curl", ps("curl -sS -i https://httpbin.org/status/429", "HTTP/1.1 429 TOO MANY REQUESTS\r\nDate: Wed, 14 Oct 2026 18:47:46 GMT\r\nContent-Length: 0")],
  ["ps curl.exe akamai piped", "https://www.homedepot.com/", "curl", ps("curl.exe -s https://www.homedepot.com/ | Select-Object -First 5", "<HTML><HEAD>\r\n<TITLE>Access Denied</TITLE>\r\n</HEAD><BODY>\r\n<H1>Access Denied</H1>")],
  ["ps assigned curl.exe", true, "curl", ps("$page = curl.exe -s https://www.homedepot.com/; $page", "<HTML><HEAD>\r\n<TITLE>Access Denied</TITLE>")],
  ["ps iwr 403", true, "iwr", psf("Invoke-WebRequest -UseBasicParsing https://httpbin.org/status/403", "Exit code 1\nInvoke-WebRequest: Response status code does not indicate success: 403 (FORBIDDEN).")],
  ["ps iwr akamai body", "https://www.homedepot.com/", "iwr", psf("iwr https://www.homedepot.com/", "Exit code 1\nInvoke-WebRequest: \r\nAccess Denied\r\n\r\nAccess Denied\r\n \r\nYou don't have permission to access \"http&#58;&#47;&#47;www&#46;homedepot&#46;com&#47;\" on this server.")],
  ["ps irm 403", true, "irm", psf("Invoke-RestMethod https://httpbin.org/status/403", "Exit code 1\nInvoke-RestMethod: Response status code does not indicate success: 403 (FORBIDDEN).")],
  ["ps iwr timeout", true, "iwr", psf("Invoke-WebRequest https://www.bestbuy.com/", "Exit code 1\nInvoke-WebRequest: The request was canceled due to the configured HttpClient.Timeout of 100 seconds elapsing.")],
  ["ps lowercase cmdlet", true, "iwr", psf("invoke-webrequest https://www.lowes.com/", "Exit code 1\nInvoke-WebRequest: Response status code does not indicate success: 403 (Forbidden).")],
  ["ps error on stderr of a later success", true, "iwr", ps("iwr https://www.lowes.com/; 'done'", "done", "Invoke-WebRequest: Response status code does not indicate success: 403 (Forbidden).")],
  ["ps 5.1 curl alias", true, "curl", psf("curl https://httpbin.org/status/403 -UseBasicParsing", "Exit code 1\ncurl : The remote server returned an error: (403) Forbidden.\nAt line:1 char:1")],
  ["ps 5.1 wget alias", true, "wget", psf("wget https://httpbin.org/status/429 -UseBasicParsing", "Exit code 1\nwget : The remote server returned an error: (429) TOO MANY REQUESTS.\nAt line:1 char:1")],
  ["ps iwr referer header skipped", "https://www.homedepot.com/", "iwr", psf("iwr -Headers @{Referer='https://www.google.com/'} https://www.homedepot.com/", "Exit code 1\nInvoke-WebRequest: Response status code does not indicate success: 403 (Forbidden).")],
  ["ps iwr 200 silent", false, "iwr", ps("$r = Invoke-WebRequest https://example.com; $r.StatusCode", "200")],
  ["ps iwr docs page about errors silent", false, "iwr", ps("(iwr https://learn.microsoft.com/powershell/iwr).Content", "Invoke-WebRequest: Response status code does not indicate success: 403 (Forbidden). The operation has timed out.")],
  ["ps iwr localhost silent", false, "iwr", psf("iwr http://localhost:3000/", "Exit code 1\nInvoke-WebRequest: Response status code does not indicate success: 403 (Forbidden).")],
  ["ps curl and iwr: iwr defers", false, "iwr", psf("curl.exe -s https://a.com/; iwr https://www.lowes.com/", "Exit code 1\nInvoke-WebRequest: Response status code does not indicate success: 403 (Forbidden).")],
  ["ps iwr and irm: irm defers", false, "irm", psf("iwr https://a.com/; irm https://www.lowes.com/", "Exit code 1\nInvoke-RestMethod: Response status code does not indicate success: 403 (Forbidden).")],
];

test.each(cases)("%s", async (_name, want, arg, input) => {
  const proc = Bun.spawn(["bun", HOOK, ...(arg ? [arg] : [])], {
    stdin: new TextEncoder().encode(typeof input === "string" ? input : JSON.stringify(input)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  const context: string = out ? JSON.parse(out).hookSpecificOutput.additionalContext : "";
  if (typeof want === "string") expect(context.match(/could not read (\S+) \(/)?.[1]).toBe(want);
  else expect(Boolean(context)).toBe(want);
});

// Runs every handler in settings.json the way Claude Code runs exec form: `command` with `args` as
// written and no shell, so the same handlers work under sh, Git Bash, and PowerShell.
type Handler = { type: string; command: string; args?: string[]; if?: string };
const settings = (await Bun.file(`${import.meta.dir}/../settings.json`).json()) as {
  hooks: Record<string, { matcher: string; hooks: Handler[] }[]>;
};
const handlers = Object.entries(settings.hooks)
  .filter(([event]) => event === "PostToolUse" || event === "PostToolUseFailure")
  .flatMap(([event, groups]) => groups.flatMap((group) => group.hooks.map((handler) => ({ event, matcher: group.matcher, handler }))))
  .filter(({ handler }) => handler.args?.join(" ").includes("blocked-fetch.ts"));
// A blocked PostToolUse input and a blocked PostToolUseFailure input for each handler's rule.
const curlFailure = "Exit code 22\ncurl: (22) The requested URL returned error: 403";
const iwrError = (cmdlet: string) => `${cmdlet}: Response status code does not indicate success: 403 (Forbidden).`;
const blocked: Record<string, [unknown, unknown]> = {
  WebFetch: [
    wf("https://www.homedepot.com/p/1", "The server returned HTTP 403 Forbidden."),
    wff("https://www.homedepot.com/p/1", "Claude Code is unable to fetch from www.homedepot.com"),
  ],
  "Bash(curl *)": [sh("curl -s -o /dev/null -w '%{http_code}' https://www.lowes.com/", "403"), shf("curl -fsS https://www.lowes.com/", curlFailure)],
  "Bash(wget *)": [sh("wget -O - https://www.lowes.com/ 2>&1", "ERROR 403: Forbidden."), shf("wget https://www.lowes.com/", "Exit code 8\nERROR 403: Forbidden.")],
  "PowerShell(curl *)": [ps("curl.exe -s -o NUL -w '%{http_code}' https://www.lowes.com/", "403"), psf("curl.exe -fsS https://www.lowes.com/", curlFailure)],
  "PowerShell(wget *)": [
    ps("wget https://www.lowes.com/; 'next'", "next", "wget : The remote server returned an error: (403) Forbidden."),
    psf("wget https://www.lowes.com/", "Exit code 1\nwget : The remote server returned an error: (403) Forbidden."),
  ],
  "PowerShell(Invoke-WebRequest *)": [
    ps("Invoke-WebRequest https://www.lowes.com/; 'next'", "next", iwrError("Invoke-WebRequest")),
    psf("Invoke-WebRequest https://www.lowes.com/", `Exit code 1\n${iwrError("Invoke-WebRequest")}`),
  ],
  "PowerShell(Invoke-RestMethod *)": [
    ps("Invoke-RestMethod https://www.lowes.com/; 'next'", "next", iwrError("Invoke-RestMethod")),
    psf("Invoke-RestMethod https://www.lowes.com/", `Exit code 1\n${iwrError("Invoke-RestMethod")}`),
  ],
};

async function runHandler(handler: Handler, input: unknown, env: Record<string, string | undefined>): Promise<string> {
  const proc = Bun.spawn([handler.command, ...(handler.args ?? [])], {
    stdin: new TextEncoder().encode(JSON.stringify(input)),
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  const [out, err] = [await new Response(proc.stdout).text(), await new Response(proc.stderr).text()];
  expect(err).toBe("");
  expect(await proc.exited).toBe(0);
  return out;
}

test("settings.json covers every shell tool and fetch program", () => {
  const rules = new Set(handlers.map(({ event, handler }) => `${event} ${handler.if ?? "WebFetch"}`));
  for (const event of ["PostToolUse", "PostToolUseFailure"])
    for (const rule of Object.keys(blocked)) expect(rules).toContain(`${event} ${rule}`);
});

test.each(handlers.map((h) => [`${h.event} ${h.handler.if ?? h.matcher}`, h] as const))("settings handler %s", async (_name, { event, handler }) => {
  expect(handler.args).toBeDefined();
  const input = blocked[handler.if ?? "WebFetch"][event === "PostToolUse" ? 0 : 1];
  const profile = `${import.meta.dir}/..`;
  const out = await runHandler(handler, input, { ...process.env, CLAUDE_CONFIG_DIR: profile });
  expect(JSON.parse(out).hookSpecificOutput.additionalContext).toContain("agent-chrome");
});

test("settings handler finds the hook in ~/.claude when CLAUDE_CONFIG_DIR is unset", async () => {
  const home = mkdtempSync(join(tmpdir(), "blocked-fetch-home-"));
  try {
    mkdirSync(join(home, ".claude", "hooks"), { recursive: true });
    copyFileSync(`${import.meta.dir}/blocked-fetch.ts`, join(home, ".claude", "hooks", "blocked-fetch.ts"));
    const { CLAUDE_CONFIG_DIR: _, ...env } = process.env;
    const { handler } = handlers.find(({ handler }) => !handler.if)!;
    const out = await runHandler(handler, blocked.WebFetch[0], { ...env, HOME: home, USERPROFILE: home });
    expect(JSON.parse(out).hookSpecificOutput.additionalContext).toContain("agent-chrome");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
