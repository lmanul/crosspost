import puppeteer from 'puppeteer';
import Poster from './poster';

export default class MastodonPoster extends Poster {

  constructor() {
    // TODO: Make server configurable
    super('https://macaw.social');
  }

  override login = async (page, user, password) => {
    const signInButton = await page.waitForSelector('text/Login');
    if (signInButton) {
      await signInButton.click();
      await page.waitForNavigation();
    }
    await page.type('#user_email', user);
    await page.type('#user_password', password);
    page.keyboard.press('Enter');
    await page.waitForNavigation();
  };

  override loadNewPostPage = async (page) => {
    const newPostButton = await page.waitForSelector('text/New post');
    if (newPostButton) {
      await newPostButton.click();
    }
  };
};
