import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { type Page } from 'puppeteer';
import parseConfig from '../configparser';
import composePost from '../compose';
import { ContentProvider } from '../provider';
import { makeBrowserWindow, newTabInBrowser } from '../util';
import SERVICES from '../posters/registry';
import Verifier, { type CheckResult } from './verifiers/verifier';
import BlueskyVerifier from './verifiers/bluesky';
import InstagramVerifier from './verifiers/instagram';
import MastodonVerifier from './verifiers/mastodon';

// Relative to the repo root, like CONTENT_DIR in index.ts.
const FIXTURE_CONTENT_DIR = 'tests/content';
// <service>.png per run, plus <service>-failure.{png,json} when something
// fails. Git-ignored.
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Services without an entry here are reported as skipped.
const VERIFIERS: Record<string, () => Verifier> = {
  bsky: () => new BlueskyVerifier(),
  instagram: () => new InstagramVerifier(),
  mastodon: () => new MastodonVerifier(),
};

type Outcome = 'PASS' | 'FAIL' | 'SKIP';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const keepOpen = args.includes('--keep-open');
  const requested = args.filter(a => !a.startsWith('--'));
  const unknown = requested.filter(name => !SERVICES[name]);
  if (unknown.length > 0) {
    console.error(`Unknown service(s): ${unknown.join(', ')}. Available: ${Object.keys(SERVICES).join(', ')}`);
    process.exit(2);
  }
  return { keepOpen, services: requested.length > 0 ? requested : Object.keys(SERVICES) };
};

const printResults = (results: CheckResult[]) => {
  for (const result of results) {
    console.log(`  ${result.passed ? '✓' : '✗'} ${result.name}: ${result.details}`);
  }
};

const main = async () => {
  const { keepOpen, services } = parseArgs();

  const outcomes: [string, Outcome, string][] = services
    .filter(name => !VERIFIERS[name])
    .map(name => [name, 'SKIP', 'no verifier yet']);
  const testable = services.filter(name => VERIFIERS[name]);

  const config = await parseConfig('config.txt');
  const bundle = await (new ContentProvider(FIXTURE_CONTENT_DIR).getContent());
  // Don't bother launching Chrome if every requested service is skipped.
  const browser = testable.length > 0 ? await makeBrowserWindow() : null;

  for (const name of testable) {
    if (!browser) {
      break;
    }
    console.log(`\n=== ${name} ===`);
    const poster = SERVICES[name]();
    const verifier = VERIFIERS[name]();
    const tab: Page = await newTabInBrowser(browser);

    // Composing must never publish. We can't generically block the request,
    // but we can notice it and fail the test.
    let publishAttempted = false;
    tab.on('request', request => {
      if (request.method() === verifier.publishRequest.method
        && verifier.publishRequest.urlPattern.test(request.url())) {
        publishAttempted = true;
        console.error(`!!! ${name}: a publish request was sent: ${request.method()} ${request.url()}`);
      }
    });

    const saveScreenshot = async (fileName: string) => {
      const screenshotPath = path.join(SCREENSHOTS_DIR, fileName);
      try {
        await mkdir(SCREENSHOTS_DIR, { recursive: true });
        await tab.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${path.relative(process.cwd(), screenshotPath)}`);
      } catch (e) {
        console.log(`Could not save screenshot: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    // Enough of the page to fix a stale selector without another session on
    // the site (see "Go easy on real accounts" in CLAUDE.md).
    const saveDomDump = async (fileName: string) => {
      const dumpPath = path.join(SCREENSHOTS_DIR, fileName);
      try {
        const dump = await tab.evaluate(() => {
          const describe = (el: Element) => ({
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            testId: el.getAttribute('data-testid'),
            ariaDisabled: el.getAttribute('aria-disabled'),
            text: (el.textContent ?? '').trim().slice(0, 80),
          });
          return {
            url: location.href,
            title: document.title,
            dialogs: document.querySelectorAll('[role="dialog"]').length,
            fields: Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
              .map(el => ({
                ...describe(el),
                placeholder: el.getAttribute('placeholder'),
                value: (el as HTMLInputElement).value ?? (el as HTMLElement).innerText,
              })),
            interactive: Array.from(document.querySelectorAll(
              'button, [role="button"], [aria-label], [data-testid]'))
              .map(describe)
              .slice(0, 1000),
          };
        });
        await mkdir(SCREENSHOTS_DIR, { recursive: true });
        await writeFile(dumpPath, JSON.stringify(dump, null, 2));
        console.log(`DOM dump saved to ${path.relative(process.cwd(), dumpPath)}`);
      } catch (e) {
        console.log(`Could not save DOM dump: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    // Don't let failure artifacts from an earlier run pass for this one's.
    for (const extension of ['png', 'json']) {
      await rm(path.join(SCREENSHOTS_DIR, `${name}-failure.${extension}`), { force: true });
    }

    try {
      await composePost(poster, tab, bundle, config[name]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`  ✗ compose: ${message}`);
      await saveScreenshot(`${name}-failure.png`);
      await saveDomDump(`${name}-failure.json`);
      outcomes.push([name, 'FAIL', 'compose step threw']);
      continue;
    }

    console.log('Verifying...');
    const results = await verifier.verify(tab, bundle);

    // Taken after verifying, so any dialogs the checks opened are closed again.
    await saveScreenshot(`${name}.png`);
    results.push({
      name: 'nothing published',
      passed: !publishAttempted,
      details: publishAttempted ? 'a publish request was sent!' : 'no publish request seen',
    });
    printResults(results);

    const failed = results.filter(r => !r.passed).length;
    if (failed > 0) {
      await saveDomDump(`${name}-failure.json`);
    }
    outcomes.push(failed === 0
      ? [name, 'PASS', `${results.length} checks`]
      : [name, 'FAIL', `${failed} of ${results.length} checks failed`]);
  }

  console.log('\n=== Summary ===');
  for (const [name, outcome, details] of outcomes) {
    console.log(`  ${outcome}  ${name} (${details})`);
  }
  const anyFailed = outcomes.some(([, outcome]) => outcome === 'FAIL');

  if (browser && keepOpen) {
    console.log('\nBrowser left open for inspection. Close it to exit.');
    await new Promise(resolve => browser.once('disconnected', resolve));
  } else if (browser) {
    await browser.close();
  }
  process.exit(anyFailed ? 1 : 0);
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
