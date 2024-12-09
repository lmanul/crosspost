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
    console.log('Posting on ' + this.name + '...');
    return page;
  }

  login = async (page: Page, user: string, password: string) => {};
  loadNewPostPage = async (page: Page) => {};

  addMainText = async (page: Page, text: string) => {
    await page.waitForSelector(INPUT_FIELD_SELECTOR);
    await page.type(INPUT_FIELD_SELECTOR, text);
  };

  addOneImage = async (page: Page, imgPath: string) => {};
  addImageDescription = async (page: Page, description: string) => {};
};
