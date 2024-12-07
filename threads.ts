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
      await page.waitForNavigation({waitUntil: 'domcontentloaded'});
    } else {
      console.log('No sign in button!');
    }
    await page.waitForSelector('input[type="text"]');
    await page.type('input[type="text"]', user);
    await page.type('input[type="password"]', password);
    page.keyboard.press('Enter');
    await page.waitForNavigation();
  };
}