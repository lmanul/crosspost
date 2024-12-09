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
    await page.waitForNavigation();
  };

  override loadNewPostPage = async (page) => {
    const newPostButton = await page.waitForSelector('text/New post');
    if (newPostButton) {
      await newPostButton.click();
    }
  };

  override addMainText = async(page: Page, text: string) => {
    await page.type('textarea', text);
  };

  override addOneImage = async (page: Page, imgPath: string) => {
    const uploadButtonSelector = 'button[aria-label^=\'Add images\']';

    const [fileChooser] = await Promise.all([
      page.waitForFileChooser(),
      page.click(uploadButtonSelector),
    ]);
    await fileChooser.accept([imgPath]);
    await page.waitForSelector('text/Uploading...', { hidden: true });
    // Wait until the UI warns us that we are missing a description.
    await page.waitForSelector(WARNING_ICON_SELECTOR);
    this.uploadedImageCount++;
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
