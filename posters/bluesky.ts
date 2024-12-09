import Poster from './poster';
import { type Page } from 'puppeteer';

export default class BlueskyPoster extends Poster {
  constructor() {
    super('bsky', 'https://bsky.app');
  }

  override login = async (page, user, password) => {
    const signInButton = await page.waitForSelector('text/Sign in');
    if (signInButton) {
      await signInButton.click();
    } else {
      console.log('No sign in button!');
    }
    const uField = await page.waitForSelector('[autocomplete="username"]');
    await uField.type(user);
    const pField = await page.waitForSelector('[autocomplete="password"]');
    await pField.type(password);
    page.keyboard.press('Enter');
    await page.waitForNavigation();
  };

  override loadNewPostPage = async (page) => {
    const composeButton = await page.waitForSelector('[aria-label="New post"]');
    await composeButton.click();
  }
}