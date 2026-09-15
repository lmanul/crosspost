import { ElementHandle, type Page } from 'puppeteer';

const INPUT_FIELD_SELECTOR = '[contenteditable=true][role=textbox]';

export default class Poster {
  name: string;
  baseUrl: string;
  initialPageLoadTimeOutSeconds: number;
  uploadedImageCount: number;
  addedImageDescriptionCount: number;

  constructor(name: string, baseUrl: string) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.initialPageLoadTimeOutSeconds = 30;
    this.uploadedImageCount = 0;
    this.addedImageDescriptionCount = 0;
  }

  loadInitialPage = async (page: Page) => {
    await page.goto(this.baseUrl, { timeout: this.initialPageLoadTimeOutSeconds * 1000 });
    console.log('\nPosting on ' + this.name + '...');
    return page;
  }

  maybeDismissDisclaimers = async (page: Page) => { };

  // Must be overridden. Assuming a live session by default meant login() was
  // silently skipped whenever the session had expired.
  isLoggedIn = async (page: Page): Promise<boolean> => {
    throw new Error('isLoggedIn is not implemented for ' + this.name);
  };

  // Waits until the page shows either a logged-in or a logged-out marker, and
  // resolves true or false depending on which appeared first.
  waitForLoginState = async (
    page: Page,
    loggedInSelector: string,
    loggedOutSelector: string,
    timeoutSeconds: number = 15,
  ): Promise<boolean> => {
    const options = { timeout: timeoutSeconds * 1000 };
    try {
      return await Promise.any([
        page.waitForSelector(loggedInSelector, options).then(() => true),
        page.waitForSelector(loggedOutSelector, options).then(() => false),
      ]);
    } catch (e) {
      throw new Error('Could not tell whether we are logged in to ' + this.name
        + ': neither "' + loggedInSelector + '" nor "' + loggedOutSelector + '" appeared');
    }
  };

  // TODO: Implement in subclasses.
  login = async (page: Page, user: string, password: string) => { };
  loadNewPostPage = async (page: Page) => { };

  addMainText = async (page: Page, text: string) => {
    await page.waitForSelector(INPUT_FIELD_SELECTOR);
    await page.type(INPUT_FIELD_SELECTOR, text);
  };

  addOneImage = async (page: Page, imgPath: string) => {
    const button = await this.getAddImageButton(page);
    if (!button) {
      return;
    }
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser(),
      button.click(),
    ]);
    await fileChooser.accept([imgPath]);
    await this.waitForImageAdded(page);
    this.uploadedImageCount++;
    console.log('Added ' + this.uploadedImageCount + ' images.');
  };

  getAddImageButton = async (page: Page): Promise<ElementHandle<Element> | null> => { return Promise.resolve(null); };
  waitForImageAdded = async (page: Page) => { };

  addImageDescription = async (page: Page, description: string) => { };
};
