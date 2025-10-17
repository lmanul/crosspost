import Poster from "./poster";
import { type Page } from 'puppeteer';

export default class LinkedInPoster extends Poster {
    constructor() {
      super('linkedin', 'https://www.linkedin.com/login');
    }

    override login = async (page, user, password) => {
    await page.type('#username', user);
    await page.type('#password', password);
    page.keyboard.press('Enter');
  };

    override loadNewPostPage = async (page) => {
    const startPostButton = await page.waitForSelector('[aria-label="Start a post"]');
    await startPostButton.click();
  };

  override addMainText = async (page: Page, text: string) => {
      const field = await page.waitForSelector('[aria-label="Text editor for creating content"]');
      await field.focus();
      await page.keyboard.type(text);
    };
}