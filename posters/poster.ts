import { type Page } from 'puppeteer';

export default class Poster {
  name: string;
  baseUrl: string;
  uploadedImageCount: number;
  addedImageDescriptionCount: number;

  constructor(name, baseUrl) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.uploadedImageCount = 0;
    this.addedImageDescriptionCount = 0;
  }

  loadInitialPage = async (page: Page) => {
    await page.goto(this.baseUrl);
    console.log('Posting on ' + this.name + '...');
    return page;
  }

  login = async (page: Page, user: string, password: string) => {};
  loadNewPostPage = async (page: Page) => {};

  addMainText = async (page: Page, text: string) => {
    await page.type('[contenteditable=true][role=textbox]', text);
  };

  addOneImage = async (page: Page, imgPath: string) => {};
  addImageDescription = async (page: Page, description: string) => {};
};
