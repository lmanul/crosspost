import puppeteer from 'puppeteer';
import Poster from './poster';
import { type Page } from 'puppeteer';

export default class InstagramPoster extends Poster {

  constructor() {
    super('instagram', 'https://www.instagram.com');
  }

  override login = async (page, user, password) => {
    const uField = await page.waitForSelector('[name="username"]');
    if (uField) {
      await page.type('[name="username"]', user);
      await page.type('[name="password"]', password);
      page.keyboard.press('Enter');
      await page.waitForNavigation();
    }
    // "Save your login info"?
    try {
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

  override loadNewPostPage = async (page) => {
    const newPostButton = await page.waitForSelector('[aria-label="New post"]');
    await newPostButton.click();
  };


  override addOneImage = async (page: Page, imgPath: string) => {
    let fileChooserButton;
    if (this.uploadedImageCount === 0) {
      fileChooserButton = await page.waitForSelector('text/Select From Computer');
    } else {
      fileChooserButton = await page.waitForSelector('[aria-label="Open Media Gallery"]');
      return;
    }
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        fileChooserButton.click(),
      ]);
    await fileChooser.accept([imgPath]);

    const selectCropButton = await page.waitForSelector('[aria-label="Select Crop"]');
    await selectCropButton.click();
    const originalMenuItem = await page.waitForSelector('text/Original');
    await originalMenuItem.click();
    this.uploadedImageCount++;
    console.log('Added ' + this.uploadedImageCount + ' images.');
  };

  addMainText = async (page: Page, text: string) => {
  };
}
