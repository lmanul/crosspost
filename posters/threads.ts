import { delay } from '../util';
import { type Page } from 'puppeteer';
import Poster from './poster';

export default class ThreadsPoster extends Poster {

  constructor() {
    super('threads', 'https://threads.net/login');
  }

  override login = async (page, user, password) => {
    // const continueBtn = await page.waitForSelector('text/Continue with Instagram');
    // await continueBtn.click();
    // await page.waitForNavigation();
    await page.waitForSelector('input[type="text"]');
    await page.type('input[type="text"]', user);
    await page.type('input[type="password"]', password);
    page.keyboard.press('Enter');
    await page.waitForNavigation();

    try {
      // Might not be here, no problem.
      let notNowButton = await page.waitForSelector('text/Not now', {
        timeout: 10,
      });
      if (notNowButton) {
        await notNowButton.click();
        await page.waitForNavigation();
      }
    } catch (e) { }

  };

  override maybeDismissDisclaimers = async (page: Page) => {
    try {
      const acceptCookiesButton = await page.waitForSelector('text/Allow all cookies',
          {timeout: 2000});
      await acceptCookiesButton.click();

    } catch(e) {
      // No big deal, there may be no disclaimers
      console.log('No cookies dialog, we might be outside of the EU');
    }
  };

  override loadNewPostPage = async (page) => {
    const field = await page.waitForSelector('[aria-label="Empty text field. Type to compose a new post."]');
    await field.click();
    /* Fediverse consent, happened before.
    const fediOk = await page.waitForSelector('text/Continue sharing');
    console.log('Fedi ok? ', fediOk);
    if (fediOk) {
      await fediOk.click();
    }
    */
  }

  override addMainText = async (page: Page, text: string) => {
    const field = await page.waitForSelector('[aria-placeholder="What\'s new?"]');
    await field.focus();
    await page.keyboard.type(text);
  };

  override addOneImage = async (page: Page, imgPath: string) => {

    // Threads only seems to support a single image per post?
    if (this.uploadedImageCount > 0) {
      console.log('Not adding more images, Threads only supports one.');
      return;
    }

    const addButton = await page.waitForSelector('[aria-label="Attach media"]');

    // Clicking on the SVG itself doesn't seem to work. Let's click on the parent.
    const parentEl = await addButton.getProperty('parentElement');

    const [fileChooser] = await Promise.all([
      page.waitForFileChooser(),
      parentEl.click(),
    ]);
    await fileChooser.accept([imgPath]);
    this.uploadedImageCount++;
      // Wait for animation
      await delay(1.5);
  };

  override addImageDescription = async (page: Page, description: string) => {
      if (this.uploadedImageCount > 0) {
        return;
      }
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
