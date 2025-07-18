import { type Page } from 'puppeteer';
import Poster from './poster';

const UPLOAD_MODAL_DESCRIPTION_SELECTOR = '#upload-modal__description';
const WARNING_ICON_SELECTOR = '.icon.icon-warning';

export default class MastodonPoster extends Poster {

  constructor() {
    // TODO: Make server configurable
    super('mastodon', 'https://macaw.social');
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
  };

  override loadNewPostPage = async (page) => {
    const newPostButton = await page.waitForSelector('text/New post');
    await newPostButton.click();
  };

  override addMainText = async(page: Page, text: string) => {
    await page.type('textarea', text);
  };

  override addOneImage = async (page: Page, imgPath: string) => {
    // const hiddenInput = await page.waitForSelector('input[type="file"]');
    const elementHandle = await page.$("input[type=file]");
    await elementHandle.uploadFile(imgPath);
    await this.waitForImageAdded(page);
    this.uploadedImageCount++;
    console.log('Added ' + this.uploadedImageCount + ' images.');
  };

  // override getAddImageButton = async (page: Page) => {
  //   const uploadButtonSelector = 'button[aria-label^=\'Add images\']';
  //   const button = await page.waitForSelector(uploadButtonSelector);
  //   return button;
  // };

  override waitForImageAdded = async (page: Page) => {
    await page.waitForSelector('text/Uploading...', { hidden: true });
    // Wait until the UI warns us that we are missing a description.
    await page.waitForSelector(WARNING_ICON_SELECTOR);
  };

  override addImageDescription = async (page: Page, description: string) => {
    const iconWarning = await page.waitForSelector(WARNING_ICON_SELECTOR);
    await iconWarning.click();
    await page.waitForSelector(UPLOAD_MODAL_DESCRIPTION_SELECTOR);
    await page.type(UPLOAD_MODAL_DESCRIPTION_SELECTOR, description);
    const btn = await page.waitForSelector('text/Apply');
    await btn.click();

    // Wait until we're back at the thumbnails view
    await page.waitForSelector(UPLOAD_MODAL_DESCRIPTION_SELECTOR, { hidden: true });
    this.addedImageDescriptionCount++;
  };
};
