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

export {
  findElementWithRoleContainingText,
  makeBrowserWindow,
  newTabInBrowser,
  delay,
}
