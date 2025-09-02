import { delay } from '../util';
import { type Page } from 'puppeteer';
import Poster from './poster';

export default class ThreadsPoster extends Poster {

  constructor() {
    super('threads', 'https://www.threads.com/login');
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
      console.log('Checking for a potential "not now" dialog');
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
        { timeout: 2000 });
      await acceptCookiesButton.click();

    } catch (e) {
      // No big deal, there may be no disclaimers
      console.log('No cookies dialog, we might be outside of the EU');
    }
  };

  override loadNewPostPage = async (page) => {
    const field = await page.waitForSelector('[aria-label="Empty text field. Type to compose a new post."]');
    await field.click();

    // Fediverse consent
    try {
      console.log('Checking for a potential "continue sharing" dialog');
      // Might not be here, no problem.
      let continueSharingButton = await page.waitForSelector('text/Continue sharing', {
        timeout: 1000,
      });
      if (continueSharingButton) {
        await continueSharingButton.click();
        await page.waitForNavigation();
      }
    } catch (e) { }
  }

  override addMainText = async (page: Page, text: string) => {
    const field = await page.waitForSelector('[aria-placeholder="What\'s new?"]');
    await field.focus();
    await page.keyboard.type(text);
  };


  override addOneImage = async (page: Page, imgPath: string) => {
    // const hiddenInput = await page.waitForSelector('input[type="file"]');
    const elementHandle = await page.$("input[type=file]");
    await elementHandle.uploadFile(imgPath);
    await this.waitForImageAdded(page);
    this.uploadedImageCount++;
    console.log('Added ' + this.uploadedImageCount + ' images.');
  };

  /*
    override getAddImageButton = async (page: Page) => {
      // Threads only seems to support a single image per post?
      if (this.uploadedImageCount > 0) {
        console.log('Not adding more images, Threads only supports one.');
        return null;
      }

      const addButtonSvg = await page.waitForSelector('[aria-label="Attach media"]');

      // Clicking on the SVG itself doesn't seem to work. Let's click on the
      // button ancestor.

      const allButtons = await page.$$('[role="button"]');

      let addButton;
      console.log('Looking for add button among ' + allButtons.length + ' buttons');
      // Get all the buttons, and find which one is an ancestor of the SVG.
      for (let button of allButtons) {
        // Checks if the first element is an ancestor of the second element
        const isAncestor = await page.evaluate(
          (ancestor, descendant) => {
            while (descendant) {
              if (descendant === ancestor) {
                return true;
              }
              descendant = descendant.parentElement;
            }
            return false;
          },
          button,
          addButtonSvg
        );
        if (isAncestor) {
          addButton = button;
          break;
        }
      }
      if (addButton) {
        console.log('Found the "Attach media" button');
        return addButton;
      } else {
        throw new Error('I could not find the parent of the "attach media SVG"');
      }
    };
  */

  override waitForImageAdded = async (page: Page) => {
    await delay(1.5);
  };

  override addImageDescription = async (page: Page, description: string) => {
    if (this.uploadedImageCount > 1) {
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
