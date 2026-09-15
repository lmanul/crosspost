import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { type Browser, type Page } from 'puppeteer';

const delay = (seconds: number) => {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

const makeBrowserWindow = async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    userDataDir: '/home/manucornet/throwaway/chrome_puppeteer',
    headless: false,
    slowMo: 10,
  });
  return browser;
};

const newTabInBrowser = async (browser: Browser) => {
  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1024 });
  return page;
};

const findElementWithRoleContainingText = async (page: Page, role: string, text: string, timeout: number = 2000) => {
  await delay(timeout / 1000 * 3);
  console.log('Looking for ' + role + ' and ' + text);
  const classList = await page.evaluate(() => {
    const els = document.querySelectorAll('[role="' + role + '"]');
    console.log(els);
    for (let el of els) {
      if (el.textContent.includes(text)) {
        return el.classList.toString();
      }
    }
  });
  if (!classList) {
    return null;
  }

  const el = await page.waitForSelector(
    '.' + classList.replaceAll(' ', '.'), { timeout });
  return el;

};

// Never throws: a failed screenshot is only logged.
const saveScreenshot = async (page: Page, filePath: string) => {
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await page.screenshot({ path: filePath });
    console.log(`Screenshot saved to ${path.relative(process.cwd(), filePath)}`);
  } catch (e) {
    console.log(`Could not save screenshot: ${e instanceof Error ? e.message : String(e)}`);
  }
};

// Enough of the page to fix a stale selector without another session on
// the site (see "Go easy on real accounts" in CLAUDE.md).
// Never throws: a failed dump is only logged.
const saveDomDump = async (page: Page, filePath: string) => {
  try {
    const dump = await page.evaluate(() => {
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
        // Scoped to dialogs when there are any, to leave out the feed.
        images: Array.from(document.querySelectorAll(
          document.querySelector('[role="dialog"]') ? '[role="dialog"] img' : 'img'))
          .map(img => ({
            alt: img.getAttribute('alt'),
            src: (img.getAttribute('src') ?? '').slice(0, 60),
            width: (img as HTMLImageElement).width,
            height: (img as HTMLImageElement).height,
          }))
          .slice(0, 200),
        fields: Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
          .map(el => ({
            ...describe(el),
            placeholder: el.getAttribute('placeholder'),
            ariaPlaceholder: el.getAttribute('aria-placeholder'),
            // A failure on a login page must not write the password to disk.
            value: el.getAttribute('type') === 'password'
              ? '[redacted]'
              : (el as HTMLInputElement).value ?? (el as HTMLElement).innerText,
          })),
        interactive: Array.from(document.querySelectorAll(
          'button, [role="button"], [aria-label], [data-testid]'))
          .map(describe)
          .slice(0, 1000),
      };
    });
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(dump, null, 2));
    console.log(`DOM dump saved to ${path.relative(process.cwd(), filePath)}`);
  } catch (e) {
    console.log(`Could not save DOM dump: ${e instanceof Error ? e.message : String(e)}`);
  }
};

export {
  findElementWithRoleContainingText,
  makeBrowserWindow,
  newTabInBrowser,
  delay,
  saveDomDump,
  saveScreenshot,
}
