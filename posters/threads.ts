import { delay } from '../util';
import { type ElementHandle, type Page } from 'puppeteer';
import Poster from './poster';

const COMPOSE_FIELD_SELECTOR = '[aria-label="Empty text field. Type to compose a new post."]';
const DIALOG_BUTTON_SELECTOR = '[role="dialog"] [role="button"]';

// Threads' markup has few stable labels, so controls are matched on their text.
export const findByText = async (
  page: Page,
  selector: string,
  text: string | RegExp,
): Promise<ElementHandle<Element>[]> => {
  const matches: ElementHandle<Element>[] = [];
  for (const handle of await page.$$(selector)) {
    const content = await handle.evaluate(el => (el.textContent ?? '').trim());
    if (typeof text === 'string' ? content === text : text.test(content)) {
      matches.push(handle);
    }
  }
  return matches;
};

// Opens the alt text editor for the index-th attached image ("•••" menu, then
// "Add alt text") and returns its text field. The editor replaces the composer
// view inside the same dialog.
export const openAltTextEditor = async (page: Page, index: number): Promise<ElementHandle<Element>> => {
  const actionButtons = await findByText(page, DIALOG_BUTTON_SELECTOR, 'Attachment actions');
  const actionButton = actionButtons[index];
  if (!actionButton) {
    throw new Error(`No "Attachment actions" button for image #${index + 1} (found ${actionButtons.length})`);
  }
  await actionButton.click();
  await page.waitForSelector('[role="menuitem"]', { timeout: 5000 });
  const [altTextItem] = await findByText(page, '[role="menuitem"]', /alt text/i);
  if (!altTextItem) {
    throw new Error('No alt text item in the attachment menu');
  }
  await altTextItem.click();
  // Wait for animation
  await delay(1.5);

  // The composer's own textbox is still in the DOM; the editor's comes after it.
  const field = (await page.evaluateHandle(() => {
    const visible = Array.from(document.querySelectorAll('[role="dialog"] [role="textbox"]'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    return visible[visible.length - 1] ?? null;
  })).asElement();
  if (!field) {
    throw new Error('No text field in the alt text editor');
  }
  return field as ElementHandle<Element>;
};

// Leaves the alt text editor: "Done" saves, "Back" discards.
export const closeAltTextEditor = async (page: Page, buttonText: 'Done' | 'Back') => {
  const [button] = await findByText(page, DIALOG_BUTTON_SELECTOR, buttonText);
  if (!button) {
    throw new Error(`No "${buttonText}" button in the alt text editor`);
  }
  await button.click();
  await page.waitForFunction(
    text => !Array.from(document.querySelectorAll('[role="dialog"] [role="button"]'))
      .some(el => el.textContent?.trim() === text),
    { timeout: 5000 }, buttonText);
};

export default class ThreadsPoster extends Poster {

  constructor() {
    super('threads', 'https://www.threads.com/login');
  }

  override isLoggedIn = async (page: Page): Promise<boolean> => {
    // Logged out, the page shows either the form or a "Log in" link to it.
    return this.waitForLoginState(
      page, COMPOSE_FIELD_SELECTOR, 'input[type="password"], ::-p-text(Log in)');
  };

  override login = async (page: Page, user: string, password: string) => {

    try {
      const loginButtonClassList = await page.evaluate(() => {
        const buttons = document.querySelectorAll('[role="link"]');
        for (let button of buttons) {
          if (button.textContent.includes('Log in')) {
            return button.classList.toString();
          }
        }
      });

      if (!loginButtonClassList) {
        throw new Error('Could not find the "Log in" button');
      }

      const loginButton = await page.waitForSelector(
        '.' + loginButtonClassList.replaceAll(' ', '.'), { timeout: 2000 });

      if (loginButton) {
        await loginButton.click();
      }
      await page.waitForNavigation();
    } catch (err) {
      console.log('No login link?');
    }

    // const continueBtn = await page.waitForSelector('text/Continue with Instagram');
    // await continueBtn.click();
    // await page.waitForNavigation();
    await page.waitForSelector('input[type="text"]');
    await page.type('input[type="text"]', user);
    await page.type('input[type="password"]', password);
    page.keyboard.press('Enter');
    await page.waitForNavigation();

    try {
      console.log('Checking for a potential "not now" dialog');
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

  override maybeDismissDisclaimers = async (page: Page) => {
    await delay(1.5);
    try {
      const allowButtonClassList = await page.evaluate(() => {
        const buttons = document.querySelectorAll('[role="button"]');
        for (let button of buttons) {
          if (button.textContent.includes('Allow all')) {
            return button.classList.toString();
          }
        }
      });
      if (!allowButtonClassList) {
        throw new Error('Could not find the "Allow all" cookies button');
      }
      const acceptCookiesButton = await page.waitForSelector(
        '.' + allowButtonClassList.replaceAll(' ', '.'), { timeout: 2000 });

      if (acceptCookiesButton) {
        await delay(1.5);
        await acceptCookiesButton.click();
        await delay(1.5);
      }

    } catch (e) {
      // No big deal, there may be no disclaimers
      console.log('No cookies dialog, we might be outside of the EU');
    }
  };

  override loadNewPostPage = async (page: Page) => {
    const field = await page.waitForSelector(COMPOSE_FIELD_SELECTOR);
    if (field) {
      await field.click();
    }

    // Fediverse consent
    try {
      console.log('Checking for a potential "continue sharing" dialog');
      // Might not be here, no problem.
      let continueSharingButton = await page.waitForSelector('text/Continue sharing', {
        timeout: 2000,
      });
      if (continueSharingButton) {
        await continueSharingButton.click();
        await page.waitForNavigation();
      }
    } catch (e) { }
  }

  override addMainText = async (page: Page, text: string) => {
    const field = await page.waitForSelector('[aria-placeholder="What\'s new?"]');
    if (field) {
      await field.focus();
    }
    await page.keyboard.type(text);
  };


  override addOneImage = async (page: Page, imgPath: string) => {
    // const hiddenInput = await page.waitForSelector('input[type="file"]');
    const elementHandle = await page.$("input[type=file]");
    if (elementHandle) {
      await elementHandle.uploadFile(imgPath);
    }
    await this.waitForImageAdded(page);
    this.uploadedImageCount++;
    console.log('Added ' + this.uploadedImageCount + ' images.');
  };

  /*
    override getAddImageButton = async (page: Page) => {
      // Threads only seems to support a single image per post?
      if (this.uploadedImageCount > 0) {
        console.log('Not adding more images, Threads only supports one.');
        return null;
      }

      const addButtonSvg = await page.waitForSelector('[aria-label="Attach media"]');

      // Clicking on the SVG itself doesn't seem to work. Let's click on the
      // button ancestor.

      const allButtons = await page.$$('[role="button"]');

      let addButton;
      console.log('Looking for add button among ' + allButtons.length + ' buttons');
      // Get all the buttons, and find which one is an ancestor of the SVG.
      for (let button of allButtons) {
        // Checks if the first element is an ancestor of the second element
        const isAncestor = await page.evaluate(
          (ancestor, descendant) => {
            while (descendant) {
              if (descendant === ancestor) {
                return true;
              }
              descendant = descendant.parentElement;
            }
            return false;
          },
          button,
          addButtonSvg
        );
        if (isAncestor) {
          addButton = button;
          break;
        }
      }
      if (addButton) {
        console.log('Found the "Attach media" button');
        return addButton;
      } else {
        throw new Error('I could not find the parent of the "attach media SVG"');
      }
    };
  */

  override waitForImageAdded = async (page: Page) => {
    await delay(1.5);
  };

  override addImageDescription = async (page: Page, description: string) => {
    // Called right after each upload, so this image's index is the number of
    // descriptions added so far.
    const field = await openAltTextEditor(page, this.addedImageDescriptionCount);
    await field.click();
    await page.keyboard.type(description);
    await closeAltTextEditor(page, 'Done');
    this.addedImageDescriptionCount++;
  };
}
