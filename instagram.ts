import puppeteer from 'puppeteer';
import Poster from './poster';

export default class InstagramPoster extends Poster {

  constructor() {
    super('instagram', 'https://www.instagram.com');
  }

  override login = async (page, user, password) => {
    const uField = await page.waitForSelector('[name="username"]');
    if (uField) {
      await page.type('[name="username"]', user);
      await page.type('[name="password"]', password);
      page.keyboard.press('Enter');
      await page.waitForNavigation();
    }
    // "Save your login info"?
    let notNowButton = await page.waitForSelector('text/Not now');
    if (notNowButton) {
      await notNowButton.click();
      await page.waitForNavigation();
    }
  };
}