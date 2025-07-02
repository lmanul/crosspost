import { type Page } from 'puppeteer';

const INPUT_FIELD_SELECTOR = '[contenteditable=true][role=textbox]';

export default class Poster {
  name: string;
  baseUrl: string;
  initialPageLoadTimeOutSeconds: number;
  uploadedImageCount: number;
  addedImageDescriptionCount: number;

  constructor(name, baseUrl) {
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

  getAddImageButton = async (page: Page) => { return null; };
  waitForImageAdded = async (page: Page) => { };

  addImageDescription = async (page: Page, description: string) => { };
};
