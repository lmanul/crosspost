import Poster from './poster';
import { type Page } from 'puppeteer';
import { delay } from '../util';

const ADD_DESCRIPTION_BUTTON_SELECTOR = '[aria-label=\'Add alt text\']';

export default class BlueskyPoster extends Poster {
  constructor() {
    super('bsky', 'https://bsky.app');
    // Blues sky can be pretty slow...
    this.initialPageLoadTimeOutSeconds = 60;
  }

  override maybeDismissDisclaimers = async (page: Page): Promise<void> => {
    try {
      const modalCloseButton = await page.waitForSelector('[aria-label="Close welcome modal"]', { timeout: 3000 });
      if (modalCloseButton) {
        await modalCloseButton.click();
        await delay(2);
      }
    } catch (error) {

    }
  };

  override login = async (page, user, password) => {
    const signInButton = await page.waitForSelector('text/Sign in');
    if (signInButton) {
      await signInButton.click();
    } else {
      console.log('No sign in button!');
    }
    const uField = await page.waitForSelector('[autocomplete="username"]');
    await uField.type(user);
    const pField = await page.waitForSelector('[autocomplete="current-password"]');
    await pField.type(password);
    page.keyboard.press('Enter');
  };

  override loadNewPostPage = async (page) => {
    const composeButton = await page.waitForSelector('[aria-label="New post"]');
    await composeButton.click();
  }

  override getAddImageButton = async (page: Page) => {
    const galleryButton = await page.waitForSelector(
      '[aria-label="Add media to post"]');
    return galleryButton;
  };
  override waitForImageAdded = async (page: Page) => {
    await page.waitForSelector(ADD_DESCRIPTION_BUTTON_SELECTOR);
  };

  override addImageDescription = async (page: Page, description: string) => {
    const altButtons = await page.$$(ADD_DESCRIPTION_BUTTON_SELECTOR);
    // The UI has two such buttons for each image
    const buttonWeWant = altButtons[2 * (this.uploadedImageCount - 1)];
    await buttonWeWant.click();
    await page.waitForSelector('[aria-label="Alt text"]');
    await page.type('[aria-label="Alt text"]', description);
    const doneButton = await page.waitForSelector('[aria-label="Save"]');
    await doneButton.click();
    this.addedImageDescriptionCount++;
  };
}
