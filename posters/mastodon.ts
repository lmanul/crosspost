import { type Page } from 'puppeteer';
import Poster from './poster';

const UPLOAD_MODAL_DESCRIPTION_SELECTOR = '#description';
const WARNING_ICON_SELECTOR = '.icon.icon-warning';
const EMAIL_FIELD_SELECTOR = '#user_email';

export default class MastodonPoster extends Poster {

  constructor() {
    // TODO: Make server configurable
    super('mastodon', 'https://macaw.social/auth/sign_in');
  }

  // The sign-in page only shows the login form when the session has expired;
  // otherwise it redirects to the web app.
  override isLoggedIn = async (page: Page): Promise<boolean> => {
    return (await page.$(EMAIL_FIELD_SELECTOR)) === null;
  };

  override login = async (page: Page, user: string, password: string) => {
    await page.type(EMAIL_FIELD_SELECTOR, user);
    await page.type('#user_password', password);
    await Promise.all([
      page.waitForNavigation(),
      page.keyboard.press('Enter'),
    ]);
  };

  override loadNewPostPage = async (page: Page) => {
    const newPostButton = await page.waitForSelector('text/New Post');
    if (newPostButton) {
      await newPostButton.click();
    }
  };

  override addMainText = async(page: Page, text: string) => {
    await page.type('textarea', text);
  };

  override addOneImage = async (page: Page, imgPath: string) => {
    const selector = 'input[type="file"]';
    await page.waitForSelector(selector);
    const elementHandle = await page.$(selector);
    if (elementHandle) {
      await elementHandle.uploadFile(imgPath);
      await this.waitForImageAdded(page);
      this.uploadedImageCount++;
      console.log('Added ' + this.uploadedImageCount + ' images.');
    }
  };

  override waitForImageAdded = async (page: Page) => {
    await page.waitForSelector('text/Uploading...', { hidden: true });
    // Wait until the UI warns us that we are missing a description.
    await page.waitForSelector(WARNING_ICON_SELECTOR);
  };

  override addImageDescription = async (page: Page, description: string) => {
    const iconWarning = await page.waitForSelector(WARNING_ICON_SELECTOR);
    if (iconWarning) {
      await iconWarning.click();
    }
    await page.waitForSelector(UPLOAD_MODAL_DESCRIPTION_SELECTOR);
    await page.type(UPLOAD_MODAL_DESCRIPTION_SELECTOR, description);
    const btn = await page.waitForSelector('text/Done');
    if (btn) {
      await btn.click();
    }

    // Wait until we're back at the thumbnails view
    await page.waitForSelector(UPLOAD_MODAL_DESCRIPTION_SELECTOR, { hidden: true });
    this.addedImageDescriptionCount++;
  };
};
