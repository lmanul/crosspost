import Poster from './poster';
import { type Page } from 'puppeteer';

const ADD_DESCRIPTION_BUTTON_SELECTOR = '[aria-label=\'Add alt text\']';

export default class BlueskyPoster extends Poster {
  constructor() {
    super('bsky', 'https://bsky.app');
    // Blues sky can be pretty slow...
    this.initialPageLoadTimeOutSeconds = 60;
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
  };

  override loadNewPostPage = async (page) => {
    const composeButton = await page.waitForSelector('[aria-label="New post"]');
    await composeButton.click();
  }

  override addOneImage = async (page: Page, imgPath: string) => {
    const galleryButton = await page.waitForSelector('[aria-label="Gallery"]');
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        galleryButton.click(),
      ]);
    await fileChooser.accept([imgPath]);
    await page.waitForSelector(ADD_DESCRIPTION_BUTTON_SELECTOR);
    this.uploadedImageCount++;
  };

  override addImageDescription = async (page: Page, description: string) => {
    const altButtons = await page.$$(ADD_DESCRIPTION_BUTTON_SELECTOR);
    // The UI has two such buttons for each image
    const buttonWeWant = altButtons[2 * (this.uploadedImageCount - 1)];
    await buttonWeWant.click();
    await page.type('[aria-label=\'Alt text\']', description);
    const doneButton = await page.waitForSelector('text/Save');
    await doneButton.click();
    this.addedImageDescriptionCount++;
  };
}