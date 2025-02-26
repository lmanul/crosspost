import Poster from './poster';
import { TimeoutError, type Page } from 'puppeteer';
import { delay } from '../util';

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
      const openMediaGalleryButton = await page.waitForSelector('[aria-label="Open Media Gallery"]');
      await openMediaGalleryButton.click();
      fileChooserButton = await page.waitForSelector('[aria-label="Plus icon"]');
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

  override addMainText = async (page: Page, text: string) => {
    let nextButton = await page.waitForSelector('text/Next');
    await nextButton.click();
    // Wait for animation
    await delay(2);
    // Once more (ignore filters)
    nextButton = await page.waitForSelector('text/Next');
    await nextButton.click();
    // Wait for animation
    await delay(2);

    // Also expand the accessibility container for adding descriptions.
    const accessibilityHeader = await page.waitForSelector('text/Accessibility');
    await accessibilityHeader.click();
    // Wait for animation
    await delay(1);
  };

  override addImageDescription = async (page: Page, description: string) => {

    const nextEmpty = await page.evaluate(() => {
      const fields = document.querySelectorAll('input[placeholder="Write alt text..."]');
      for (let field of fields) {
        console.log(field);
        if ((field as HTMLInputElement).value === '') {
          return field;
        }
      }
      return null;
    });

    if (nextEmpty) {
      await (nextEmpty as HTMLInputElement).focus();
      await page.keyboard.type(description);
      this.addedImageDescriptionCount++;
    } else {
      console.log('Did not find the next empty input for accessibility');
    }
  };
}
