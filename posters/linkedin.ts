import Poster from "./poster";
import { type ElementHandle, type Page } from 'puppeteer';

// LinkedIn rewrote the feed and the share box as a server-driven React app
// (markup carries data-sdui-screen / componentkey attributes and hashed class
// names). The old Ember share box inside #interop-outlet's shadow root is
// gone: that shadow root now only holds the messaging overlay, so none of the
// `#interop-outlet >>> .share-*` selectors match any more.
//
// The composer is a full page of its own, reachable directly, with a TipTap
// editor in the light DOM. `componentkey` values are random UUIDs per render,
// except for a few named ones like ShareBox_textEditor, which is the only
// stable, language-independent hook on the editor. Everything else here goes
// by aria-label or exact button text, so it follows the UI language (English
// once logged in, even though the login page follows the browser locale).
const COMPOSE_URL = 'https://www.linkedin.com/sharing/compose';

export const COMPOSER_EDITOR_SELECTOR = '[componentkey="ShareBox_textEditor"]';
const MEDIA_BUTTON_SELECTOR = 'button[aria-label="Media"]';
const FILE_INPUT_SELECTOR = 'input[type="file"]';
// In the media editor: adds a further image, and reopens the file picker.
const EDITOR_ADD_IMAGE_SELECTOR = 'button[aria-label="Add"]';
// One per image in the media editor's strip.
export const EDITOR_IMAGE_SELECTOR = '[aria-roledescription="sortable"]';
export const ALT_TEXT_BUTTON_SELECTOR = 'button[aria-label="Alternative text"]';
export const ALT_TEXT_FIELD_SELECTOR = 'textarea[placeholder="How would you describe this image?"]';
// Leaves the alt text tool without saving.
export const ALT_TEXT_BACK_SELECTOR = 'button[aria-label="Back"]';
// Reopens the media editor from the composer.
export const COMPOSER_EDIT_MEDIA_SELECTOR = 'button[aria-label="Edit"]';
const USER_FIELD_SELECTOR = 'input[type="email"], #username';
const PASSWORD_FIELD_SELECTOR = 'input[type="password"]';

// The login page renders two copies of its form (one hidden), with generated
// ids, so fields are picked by type and visibility.
const findVisible = async (page: Page, selector: string): Promise<ElementHandle<Element> | null> => {
  const handle = await page.evaluateHandle(sel => Array.from(document.querySelectorAll(sel)).find(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) ?? null, selector);
  return handle.asElement() as ElementHandle<Element> | null;
};

// Puppeteer's own click() and type() hang on the composer: they evaluate in an
// isolated world to scroll the element into view, and that call never returns
// here (Runtime.callFunctionOn times out with the element plainly on screen).
// Reading the box in the main world and dispatching raw mouse input works.
export const clickAt = async (page: Page, selector: string) => {
  const box = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) {
      return null;
    }
    el.scrollIntoView({ block: 'center' });
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);
  if (!box) {
    throw new Error('Nothing to click for ' + selector);
  }
  await page.mouse.click(box.x, box.y);
};

// Several buttons here have no stable attribute at all and only differ by
// their text ("Post", "Next", and the alt text tool's "Add", which is not the
// media editor's icon-only button[aria-label="Add"]).
export const clickButtonWithText = async (page: Page, text: string) => {
  const box = await page.evaluate(wanted => {
    const button = Array.from(document.querySelectorAll('button')).find(candidate =>
      (candidate.textContent ?? '').trim() === wanted
      && !candidate.disabled
      && candidate.getBoundingClientRect().width > 0);
    if (!button) {
      return null;
    }
    button.scrollIntoView({ block: 'center' });
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, text);
  if (!box) {
    throw new Error('No enabled "' + text + '" button');
  }
  await page.mouse.click(box.x, box.y);
};

// The "Post" button has no stable attribute either, so it goes by exact text.
export const getPostButton = async (page: Page): Promise<ElementHandle<Element> | null> => {
  const handle = await page.evaluateHandle(() => Array.from(document.querySelectorAll('button'))
    .find(button => (button.textContent ?? '').trim() === 'Post') ?? null);
  return handle.asElement() as ElementHandle<Element> | null;
};

// Each attached image is a blob: preview. In the composer there is exactly one
// per attachment, and LinkedIn copies each saved alt text onto it, which is
// how the alt texts can be read back without reopening the media editor.
export const getAttachedImages = (page: Page): Promise<{ alt: string }[]> => page.evaluate(
  () => Array.from(document.querySelectorAll('img'))
    .filter(img => (img.getAttribute('src') ?? '').startsWith('blob:'))
    .map(img => ({ alt: img.getAttribute('alt') ?? '' })));

// Returns to the composer if the media editor is open. Safe to call either way.
export const leaveMediaEditor = async (page: Page) => {
  const inEditor = await page.evaluate(sel => document.querySelectorAll(sel).length > 0,
    EDITOR_IMAGE_SELECTOR);
  if (!inEditor) {
    return;
  }
  await clickButtonWithText(page, 'Next');
  await page.waitForFunction(sel => {
    const editor = document.querySelector(sel);
    const rect = editor?.getBoundingClientRect();
    return !!rect && rect.width > 0 && rect.height > 0;
  }, { timeout: 30000 }, COMPOSER_EDITOR_SELECTOR);
};

export default class LinkedInPoster extends Poster {
  constructor() {
    // Going straight to the composer doubles as the login check: logged in it
    // renders the share box, logged out it redirects to the sign-in page.
    super('linkedin', COMPOSE_URL);
  }

  override isLoggedIn = async (page: Page): Promise<boolean> => {
    return this.waitForLoginState(page, COMPOSER_EDITOR_SELECTOR, PASSWORD_FIELD_SELECTOR, 30);
  };

  override login = async (page: Page, user: string, password: string) => {
    const userField = await findVisible(page, USER_FIELD_SELECTOR);
    const passwordField = await findVisible(page, PASSWORD_FIELD_SELECTOR);
    if (!userField || !passwordField) {
      throw new Error('Could not find the visible LinkedIn login fields');
    }
    for (const [field, value] of [[userField, user], [passwordField, password]] as const) {
      await field.click({ count: 3 });
      await page.keyboard.press('Backspace');
      await page.keyboard.type(value, { delay: 40 });
    }
    // There is no <form>, but Enter in the password field submits.
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 30000 });
    if (page.url().includes('/checkpoint/')) {
      throw new Error('LinkedIn wants to verify this login (e.g. a code sent by email). '
        + 'Complete it by hand in the Puppeteer profile, then run again.');
    }
  };

  override loadNewPostPage = async (page: Page) => {
    // Logging in lands on the feed, so come back to the composer. When
    // isLoggedIn already found the editor this is a no-op.
    if (!(await page.$(COMPOSER_EDITOR_SELECTOR))) {
      await page.goto(COMPOSE_URL, { timeout: 60000 });
    }
    await page.waitForSelector(COMPOSER_EDITOR_SELECTOR, { timeout: 30000 });
  };

  // There is no file input in the page until the picker is asked for: the
  // click creates one, appends it to <body> zero-sized, and would open a
  // native OS dialog that Puppeteer cannot intercept (waitForFileChooser never
  // fires for it). Uploading straight to that input, the way the Mastodon and
  // Threads posters do, skips the dialog entirely.
  override addOneImage = async (page: Page, imgPath: string) => {
    const inputsBefore = await page.$$(FILE_INPUT_SELECTOR);
    // The first image is added from the composer, later ones from the editor.
    await clickAt(page, this.uploadedImageCount === 0
      ? MEDIA_BUTTON_SELECTOR
      : EDITOR_ADD_IMAGE_SELECTOR);
    await page.waitForFunction((selector, count) =>
      document.querySelectorAll(selector).length > count,
      { timeout: 30000 }, FILE_INPUT_SELECTOR, inputsBefore.length);

    const inputs = await page.$$(FILE_INPUT_SELECTOR);
    await inputs[inputs.length - 1].uploadFile(imgPath);
    await this.waitForImageAdded(page);
    this.uploadedImageCount++;
    console.log('Added ' + this.uploadedImageCount + ' images.');
  };

  override waitForImageAdded = async (page: Page) => {
    await page.waitForFunction((selector, count) =>
      document.querySelectorAll(selector).length === count,
      { timeout: 60000 }, EDITOR_IMAGE_SELECTOR, this.uploadedImageCount + 1);
  };

  // Called right after each upload, while the new image is the selected one.
  override addImageDescription = async (page: Page, description: string) => {
    await clickAt(page, ALT_TEXT_BUTTON_SELECTOR);
    await page.waitForSelector(ALT_TEXT_FIELD_SELECTOR, { timeout: 30000 });
    await clickAt(page, ALT_TEXT_FIELD_SELECTOR);
    await page.keyboard.type(description, { delay: 20 });
    // The tool's own "Add" button saves; it stays disabled while the field is
    // empty, so it is only clickable once something has been typed.
    await clickButtonWithText(page, 'Add');
    await page.waitForFunction(selector => !document.querySelector(selector),
      { timeout: 30000 }, ALT_TEXT_FIELD_SELECTOR);
    this.addedImageDescriptionCount++;
  };

  override addMainText = async (page: Page, text: string) => {
    // With images, we're still in the media editor.
    await leaveMediaEditor(page);
    await page.waitForSelector(COMPOSER_EDITOR_SELECTOR, { timeout: 30000 });
    await clickAt(page, COMPOSER_EDITOR_SELECTOR);
    await page.keyboard.type(text, { delay: 20 });
  };
}
