import puppeteer from 'puppeteer';
import { type Page } from 'puppeteer';

const delay = (seconds) => {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

const makeBrowserWindow = async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    headless: false,
    slowMo: 10,
  });
  return browser;
};

const newTabInBrowser = async (browser) => {
  const page: Page = await browser.newPage();
  await page.setViewport({width: 1080, height: 1024});
  return page;
};

export {
  makeBrowserWindow,
  newTabInBrowser,
  delay,
}
