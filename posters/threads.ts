import { delay } from '../util';
import { type Page } from 'puppeteer';
import Poster from './poster';

export default class ThreadsPoster extends Poster {

  constructor() {
    super('threads', 'https://threads.net/login');
  }

  override login = async (page, user, password) => {
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

  override addOneImage = async (page: Page, imgPath: string) => {
    const addButton = await page.waitForSelector('[aria-label="Attach media"]');

    // Clicking on the SVG itself doesn't seem to work. Let's click on the parent.
    const parentEl = await addButton.getProperty('parentElement');

    const [fileChooser] = await Promise.all([
      page.waitForFileChooser(),
      parentEl.click(),
    ]);
    await fileChooser.accept([imgPath]);
    this.uploadedImageCount++;
  };

  override addImageDescription = async (page: Page, description: string) => {
      const altButtons = await page.$$('text/Alt');
      // TODO: After 2 images, we need to scroll the carousel first.
      const buttonWeWant = altButtons[this.addedImageDescriptionCount];
      await buttonWeWant.click();
      // Wait for animation
      await delay(1.5);
      await page.waitForSelector('[role="textbox"]');
      await page.type('[role="textbox"]', description);
      const btn = await page.waitForSelector('text/Done');
      await btn.click();
      this.addedImageDescriptionCount++;
    };
}