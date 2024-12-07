import puppeteer from 'puppeteer';
import Poster from './poster';

export default class ThreadsPoster extends Poster {

  constructor() {
    super('threads', 'https://threads.net');
  }

  override login = async (page, user, password) => {
    const signInButton = await page.waitForSelector('text/Log in');
    if (signInButton) {
      await signInButton.click();
      // await page.waitForNavigation({waitUntil: 'domcontentloaded'});
    }
    await page.waitForSelector('input[type="text"]');
    await page.type('input[type="text"]', user);
    await page.type('input[type="password"]', password);
    page.keyboard.press('Enter');
    await page.waitForNavigation();
  };

  override loadNewPostPage = async (page) => {
    const field = await page.waitForSelector('text/What\'s new?');
    await field.click();
    /* Fediverse consent, happened before.
    const fediOk = await page.waitForSelector('text/Continue sharing');
    console.log('Fedi ok? ', fediOk);
    if (fediOk) {
      await fediOk.click();
    }
    */
  }
}