import Poster from "./poster";
import { type Page } from 'puppeteer';

const START_POST_BUTTON_SELECTOR = '[aria-label="Start a post"]';

export default class LinkedInPoster extends Poster {
  constructor() {
    super('linkedin', 'https://www.linkedin.com/login');
  }

  override isLoggedIn = async (page: Page): Promise<boolean> => {
    // A logged-in session gets redirected from /login to the feed.
    return this.waitForLoginState(page, START_POST_BUTTON_SELECTOR, '#username, #password');
  };

  override login = async (page: Page, user: string, password: string) => {
    await page.type('#username', user);
    await page.type('#password', password);
    page.keyboard.press('Enter');
  };

  override loadNewPostPage = async (page: Page) => {
    const startPostButton = await page.waitForSelector(START_POST_BUTTON_SELECTOR);
    if (startPostButton) {
      await startPostButton.click();
    }
  };

  override addMainText = async (page: Page, text: string) => {
    const field = await page.waitForSelector('[aria-label="Text editor for creating content"]');
    if (field) {
      await field.focus();
    }
    await page.keyboard.type(text);
  };

  override getAddImageButton = async (page: Page) => {
    const galleryButton = await page.waitForSelector('[aria-label="Add media"]');
    return galleryButton;
  };

  override waitForImageAdded = async (page: Page) => {
    await page.waitForSelector('[aria-label="Next"]');
  };

}
