# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

`crosspost` is a small personal automation tool that publishes the same post
(text + images with alt text) to several social networks by **driving a real
Chrome browser with Puppeteer** — there are no API clients here. Every
integration is UI scraping: it clicks buttons, types into `contenteditable`
fields, and waits for selectors.

Supported targets: Bluesky, Instagram, Mastodon, Threads, LinkedIn.
X/Twitter is deliberately not supported (see the FAQ in [README.md](README.md)).

**Important behavioral note:** the run intentionally stops *before* publishing.
It fills in every composer and leaves the tabs open so the user can review and
click "Post" manually. Do not add an automatic submit step unless explicitly
asked.

**Go easy on real accounts.** Every `./run`, `./test`, or ad-hoc Puppeteer
script logs into the user's real accounts and behaves like a bot (uploads, fast
typing, repeated composer sessions). Too much of that on one service in a short
time risks getting the account flagged, challenged, or locked. So:

- Don't loop retries against the same service. Each run should answer a
  specific question; if a service fails a couple of times, stop and report
  rather than keep trying variations.
- Get the most out of each session: one instrumented run (screenshots, DOM
  dumps, network and console logs) beats several blind reruns. Start from the
  screenshots in `tests/screenshots/` before launching anything new.
- Test selector and logic changes offline first where possible (e.g.
  `page.setContent()` in a throwaway headless browser, not the real profile).
- Only run the service you're working on (`./test mastodon`), not the whole
  suite.
- When it's unclear whether a failure is the site or the automation, ask the
  user to try the same thing by hand in the Puppeteer profile before
  automating further.

## Running it

```
./run              # the normal entry point (Python wrapper)
npm run start      # just the TypeScript part: ts-node index.ts
./test [service…]  # end-to-end tests (see below); wraps `npm test`
npx tsc --noEmit   # typecheck (currently clean; there is no linter)
```

[run](run) is a Python script that: runs `npm install`, primes `config.txt`
from the user's own password manager (only when `$USER == manucornet`), runs
`npm run start`, then `git checkout config.txt` to discard the credentials it
wrote. Anyone else gets their hand-edited `config.txt` left untouched.

Because Puppeteer launches with `headless: false`, running this needs a real
display.

### Puppeteer and its Chrome

Puppeteer is on 25.x, which bundles Chrome for Testing 153 (upgraded
2026-09-15 from 23.x / Chrome 131, whose Instagram composer failed with
"Something went wrong" even by hand, while Firefox worked). Two setup traps:

- npm (11+) blocks Puppeteer's `postinstall`, so `npm install` does **not**
  download Chrome. Install it explicitly.
- The user's `PATH` has personal scripts in `~/repos/sak/` that shadow system
  tools, notably `unzip` (and apparently `du`). Puppeteer's installer shells out
  to `unzip`, the script rejects its flags but exits 0, and the install
  "succeeds" with an empty `~/.cache/puppeteer/chrome/linux-<version>/` folder
  (then launches fail with "Could not find Chrome"). Delete that empty folder
  and install with the real tools first on `PATH`:

  ```
  PATH=/usr/bin:$PATH npx puppeteer browsers install chrome
  ```

Upgrading Chrome upgrades the shared profile (`util.ts`'s `userDataDir`) on
first launch, and older Chrome builds may refuse it afterwards. The profile as it
was under Chrome 131 is backed up at
`/media/manucornet/Data/throwaway/chrome_puppeteer-chrome131-backup-20260915`.
Puppeteer 25 removed `click({ clickCount })`; use `click({ count })`.

## Architecture

| File | Role |
| --- | --- |
| [index.ts](index.ts) | Orchestrator: builds the poster list, reads config + content, opens a tab per service, calls `composePost` |
| [compose.ts](compose.ts) | `composePost` — the per-service posting sequence, shared by `index.ts` and the tests |
| [posters/poster.ts](posters/poster.ts) | `Poster` base class — the lifecycle every service implements |
| [posters/registry.ts](posters/registry.ts) | `SERVICES`: poster name → factory. Add new posters here |
| [posters/*.ts](posters/) | One subclass per service, overriding whatever that site's UI requires |
| [tests/](tests/) | End-to-end test harness, per-service verifiers, fixture post |
| [provider.ts](provider.ts) | Reads `content/` into a `ContentBundle` (`mainText` + `images[]`) |
| [configparser.ts](configparser.ts) | Parses `config.txt` into `{ service: [user, pass] }` |
| [util.ts](util.ts) | Browser/tab creation, `delay()`, a role+text element finder |

### The Poster lifecycle

[compose.ts](compose.ts) calls these in order for each service:

1. `loadInitialPage` — `page.goto(baseUrl)`
2. `maybeDismissDisclaimers` — cookie banners, welcome modals
3. `isLoggedIn` → if false, `login(page, user, password)`
4. `loadNewPostPage` — click the composer open
5. For each image: `addOneImage` (via `getAddImageButton` + `waitForImageAdded`), then `addImageDescription`
6. `addMainText`

Base-class methods are mostly no-ops or generic `[contenteditable=true][role=textbox]`
handling; subclasses override what they need. `uploadedImageCount` and
`addedImageDescriptionCount` are instance counters that several posters rely on
to pick the *n*-th alt-text button in the DOM.

Note the methods are **arrow-function class properties**, not prototype
methods, so subclasses use `override name = async (...) => {}`. Keep that style
when adding a poster.

### Service-specific quirks worth knowing

- **Instagram** is the odd one out in two ways: it is skipped entirely when
  there are no images, and its alt texts must be entered *after* the caption
  (`addMainText` is what advances through the crop/filter steps and expands the
  Accessibility panel). [index.ts](index.ts) (skip) and
  [compose.ts](compose.ts) (ordering) special-case `instanceof InstagramPoster`.
- **Instagram and Threads share credentials** — [configparser.ts](configparser.ts)
  copies the `instagram` entry to `threads` automatically.
- **Mastodon** hardcodes the server `https://macaw.social` (there is a `TODO`
  to make it configurable) and uploads via a hidden `input[type=file]` rather
  than a file chooser.
- **Threads** has a large commented-out `getAddImageButton` block documenting a
  failed attempt at clicking the attach-media SVG; it currently uses the hidden
  file input instead. Alt text lives behind each image's "•••" button (text
  "Attachment actions") → "Add alt text" menu item; the editor then replaces
  the composer view inside the same dialog (no new `role="dialog"`), with
  "Back" (discard) and "Done" (save). `openAltTextEditor` /
  `closeAltTextEditor` in [posters/threads.ts](posters/threads.ts) are exported
  and shared with the test's verifier. The image strip scrolls sideways; on
  Chrome 153 a click on the 4th image's "•••" missed while it was still moving,
  so `openAltTextEditor` scrolls the button into view, waits for it to stop
  moving, and retries the click once. Threads also copies saved alt texts into
  each preview's `img[alt]`, which could let the verifier read them without
  opening the editor.
- **LinkedIn**'s feed is a newer React app with hashed class names, but the
  share box (composer and media editor) is an older Ember app rendered inside
  `#interop-outlet`'s **shadow root**, where `document.querySelector` can't see
  it. Reach it with Puppeteer's pierce combinator: `#interop-outlet >>> .ql-editor`.
  Its classes (`share-actions__primary-action`, `media-editor-*`) and icon ids
  (`svg[data-test-icon="alt-text-medium"]`, `add-medium`, `edit-small`) are
  stable and language-independent; prefer them over labels. Flow: the feed's
  `a[href*="/preload/sharebox"]` opens the composer; "Add media" opens a file
  chooser and switches to the media editor; later images come from the editor's
  own "Add" and become the selected image; alt text is a tool on the selected
  image (textarea, then the primary "Add" button); "Next" returns to the
  composer, which can take several seconds to re-render. Alt texts can only be
  read back by reopening the editor ("Edit media preview"). Images aren't
  uploaded until "Post" is clicked. Wait for share box elements with
  `waitForInterop` in [posters/linkedin.ts](posters/linkedin.ts), which polls
  the shadow root and also requires visibility. (On Puppeteer 23,
  `page.waitForSelector('#interop-outlet >>> …')` never noticed elements added
  to the shadow root later and timed out with the element on screen; Puppeteer
  25 no longer has that bug, but `waitForInterop` stays. Immediate
  `page.$('#interop-outlet >>> …')` queries have always been fine.)
- **LinkedIn login**: the logged-out pages follow the browser locale (Japanese
  here), even though the logged-in UI is English. The login page has no
  `<form>` and renders two copies of its fields, one hidden, with generated
  ids: `login()` types into the visible `input[type="email"]` /
  `input[type="password"]` and submits with Enter. LinkedIn may answer with an
  email verification code (`/checkpoint/challenge/`); `login()` then throws, and
  the user has to complete it by hand in the Puppeteer profile.
- **Bluesky** gets a 60s initial page-load timeout because it is slow, and its
  UI renders two "Add alt text" buttons per image (hence the `2 * (n-1)`
  indexing).
- **Threads / Instagram** sometimes need class-list scraping to find a button
  (`page.evaluate` → read `classList` → `waitForSelector('.a.b.c')`), because
  the markup has no stable label. `findElementWithRoleContainingText` in
  [util.ts](util.ts) is the generic form of this trick.

### Errors

`TimeoutError` from one service is caught, logged, and the loop moves on to the
next. Setting `DEBUG = true` in [index.ts](index.ts#L13) re-throws instead —
useful when a selector has rotted.

## Content and config format

`content/` holds the post:

- `main.txt` — the post body (required; throws if missing)
- `descriptions.txt` — alt texts, separated by **blank lines**, in filename-sorted
  order of the images. The count must match the image count exactly or
  `ContentProvider` throws.
- `*.png` / `*.jpg` — attachments, used in sorted filename order (hence the
  `1_`, `2_`, … prefixes in the test fixture)

`config.txt` is `service:username:password`, one per line, `#` for comments.
Two gotchas:

- The key must match the poster's `name` field, **not** the site's brand name.
  Bluesky's poster is named `bsky`, so the line is `bsky:user:pass`. The
  commented sample in [config.txt](config.txt) still says `bluesky:` and has no
  `linkedin:` line — it is stale; [run](run) writes the correct keys.
- `line.split(':', 3)` means a password containing `:` gets truncated.

## End-to-end tests

### Definition

An **end-to-end test** for one service means:

1. Pick a single service (e.g. `mastodon`).
2. Launch a browser with the same `userDataDir` as [util.ts](util.ts) (i.e. via
   `makeBrowserWindow`), so existing logged-in sessions are reused.
3. Perform everything the main loop in [index.ts](index.ts) does for that
   service: load page, dismiss disclaimers, log in if needed, open the
   composer, attach every image with its alt text, type the main text.
4. **Never actually post anything.**
5. Verify, using Puppeteer, that everything worked: the main text body matches,
   every image is attached, every alt text is set, and the post is genuinely
   ready to be created (the submit control is enabled).

The test suite runs this for every available service.

### Running

```
./test                        # every service; ones without a verifier are SKIPped
./test mastodon               # one service
./test mastodon --keep-open   # leave Chrome open afterwards to inspect the composer
```

[test](test) is a Python wrapper mirroring [run](run): it imports `run` to reuse
`prepare`/`prime_config_file`/`cleanup` (so credentials come from the same
place), runs `npm test -- <args>`, and restores `config.txt` in a `finally`.
Exit code is 1 if any service fails, 2 for an unknown service name.

Because the tests share the Chrome profile with `./run`, they cannot run while
a `./run` browser window is still open (Chrome's profile lock).

### Structure

- [tests/e2e.ts](tests/e2e.ts) — harness. Uses the fixture post in
  [tests/content/](tests/content/) (4 images, deterministic text), **not** the
  user's `content/`, so tests never compose a real pending post. Calls the same
  `composePost` as `index.ts`, then the service's verifier.
- After verifying, the harness saves a screenshot of the composed post to
  `tests/screenshots/<service>.png` (git-ignored, overwritten each run). It is
  taken whenever composing succeeded, even if checks failed, and a failed
  screenshot is logged but doesn't fail the test. If composing itself throws,
  the page is saved as `<service>-failure.png` instead: look at it first.
- On any failure (compose or check), the harness also writes
  `tests/screenshots/<service>-failure.json`: URL, dialog count, images with
  their `alt` attributes, every input /
  textarea / contenteditable with its value, and every button, `aria-label`,
  and `data-testid` on the page. Fix stale selectors from this file instead of
  opening another session on the site. Old failure files are deleted at the
  start of each service's run.
- [tests/verifiers/verifier.ts](tests/verifiers/verifier.ts) — abstract
  `Verifier`. Subclasses implement `checkMainText`, `checkImagesAttached`,
  `checkReadyToPost`, `checkImageDescriptions`; each resolves with a short
  success summary or throws an explanation. `verify` runs all of them so one
  failure doesn't hide the others.
- `isPublishRequest` on each verifier recognizes the network request that
  would publish (for Mastodon, `POST /api/v1/statuses`; it gets the whole
  `HTTPRequest`, so it can look at a GraphQL body when the URL isn't enough). The harness listens for it
  and adds a "nothing published" check. It detects, it does not block —
  verifiers themselves must only *read* the submit button, never click it.

Status: all five services pass, each re-run after the Puppeteer 25 / Chrome 153
upgrade (2026-09-15). [tests/verifiers/mastodon.ts](tests/verifiers/mastodon.ts) passes.
[tests/verifiers/bluesky.ts](tests/verifiers/bluesky.ts) passes too; it is
registered under the poster name `bsky` (so `./test bsky`, not `./test bluesky`).
Bluesky's web app exposes React Native test ids as `data-testid`
(`composerPublishBtn`, `altTextButton`, `removePhotoButton`, …); prefer those
over `aria-label`s, several of which are ambiguous.
[tests/verifiers/threads.ts](tests/verifiers/threads.ts) passes as well. It
reuses the poster's alt text helpers, counts one "Remove" button per image, and
reads each alt text by opening the editor and leaving with "Back", so nothing is
saved.
[tests/verifiers/linkedin.ts](tests/verifiers/linkedin.ts) passes as well (first
run 2026-09-15). It reads alt texts by reopening the media editor and leaving
each alt text tool without saving, then returns to the composer; it reuses the
poster's exported share box helpers. Its `isPublishRequest` deliberately ignores
the POSTs that merely open the composer (`voyagerContentcreationDashSharebox`,
`sharing.LaunchShareboxTracking`); the actual create-post request has never been
observed, since nothing was ever posted, so its patterns are educated guesses.
[tests/verifiers/instagram.ts](tests/verifiers/instagram.ts) passes too, since
the Puppeteer 25 / Chrome 153 upgrade (2026-09-15). Before that, on Chrome 131,
Instagram's post dialog showed "Something went wrong" right after the images
were added, even when posting by hand in that browser; pauses and slower typing
didn't help. The caption box is now labelled "Add a caption..." (was "Write a
caption..."); `CAPTION_SELECTOR` in [posters/instagram.ts](posters/instagram.ts)
matches the dialog's contenteditable textbox and is shared with the verifier.
The verifier finds "Share" by exact text, since the dialog also has a "Share to"
section header.
To add a service, write a `Verifier` subclass and register it in
`VERIFIERS` in [tests/e2e.ts](tests/e2e.ts).

Verifier selectors rot exactly like poster selectors. The Mastodon verifier
leans on `.compose-form__upload`, `.icon-edit`, and the `#description` modal;
when a check fails with a "still the right selector?" hint, re-inspect the page
(`--keep-open` helps) before assuming the poster is broken.

## Conventions

- TypeScript with `strict: true`, run directly through `ts-node` — nothing is
  ever built to `dist/`.
- 2-space indent, semicolons, single quotes, `async`/`await` throughout.
- Selector constants live at the top of each poster file in `SCREAMING_SNAKE_CASE`.
- Progress is reported with plain `console.log`.
- Commit messages are short imperative one-liners ("Fix Bluesky login page",
  "Clean up tsconfig"), no body, no prefixes.
- `util.ts` hardcodes a persistent Chrome profile at
  `/home/manucornet/throwaway/chrome_puppeteer`, which is why sessions usually
  survive between runs and `login()` is often skipped.
- Paths in [provider.ts](provider.ts) are built from `__dirname` plus the
  relative `content` dir, so the tool expects to be run from the repo root.

## Maintenance reality

Most of the git history is "fix X for updated UI". When something breaks, the
cause is almost always that a site changed its DOM — the fix is to re-inspect
the live page and update the selector in that one poster, not to restructure
anything.

Each poster implements `isLoggedIn`; the base version throws. Most use
`waitForLoginState(page, loggedInSelector, loggedOutSelector)`, which resolves
to whichever marker appears first. By convention the logged-in marker is what
`loadNewPostPage` waits for, and the logged-out marker is the field `login()`
types into, so keep them in sync when a selector changes. Mastodon's sign-in page
is server-rendered, so it just checks for `#user_email` right after load.
