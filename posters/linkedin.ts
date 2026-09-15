import Poster from "./poster";
import { type ElementHandle, type Page } from 'puppeteer';

// LinkedIn's feed is a newer app, but the share box (composer and media editor)
// is an older Ember app rendered inside #interop-outlet's shadow root. Its class
// names and icon ids are stable and don't depend on the UI language.
const INTEROP = '#interop-outlet >>> ';

// The feed's "Start a post" box is a link to this URL, whatever the UI language.
const START_POST_BUTTON_SELECTOR = 'a[href*="/preload/sharebox"]';
const USER_FIELD_SELECTOR = 'input[type="email"], #username';
const PASSWORD_FIELD_SELECTOR = 'input[type="password"]';

export const COMPOSER_EDITOR_SELECTOR = INTEROP + '.ql-editor';
export const COMPOSER_POST_BUTTON_SELECTOR = INTEROP + '.share-actions__primary-action';
export const COMPOSER_IMAGE_SELECTOR = INTEROP + '.update-components-image__image-link';
// "Edit media preview", as opposed to "Remove media" (close-small icon).
export const COMPOSER_EDIT_MEDIA_SELECTOR =
  INTEROP + '.share-creation-state__preview-container-btn:has(svg[data-test-icon^="edit"])';
const ADD_MEDIA_BUTTON_SELECTORS = [
  INTEROP + '.share-promoted-detour-button[aria-label="Add media"]',
  // Language-independent fallback: "Add media" is the first detour button.
  INTEROP + '.share-promoted-detour-button',
];

export const EDITOR_IMAGE_SELECTOR = INTEROP + '.media-editor-file-manager__file-preview';
const EDITOR_ADD_BUTTON_SELECTOR = INTEROP + 'button:has(svg[data-test-icon="add-medium"])';
const EDITOR_NEXT_BUTTON_SELECTOR = INTEROP + '.share-box-footer__primary-btn';
const ALT_TEXT_TOOL_BUTTON_SELECTOR = INTEROP + 'button:has(svg[data-test-icon^="alt-text"])';
export const ALT_TEXT_FIELD_SELECTOR = INTEROP + 'textarea.media-editor-tools-alt-text__input';
const ALT_TEXT_EXIT_BUTTON_SELECTOR = INTEROP + '.media-editor-tool-base__footer-exit-button';

// The login page renders two copies of its form (one hidden), with generated
// ids, so fields are picked by type and visibility.
const findVisible = async (page: Page, selector: string): Promise<ElementHandle<Element> | null> => {
  const handle = await page.evaluateHandle(sel => Array.from(document.querySelectorAll(sel)).find(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) ?? null, selector);
  return handle.asElement() as ElementHandle<Element> | null;
};

// Waits for a share box element to be shown (or gone, with hidden). Don't use
// page.waitForSelector('#interop-outlet >>> ...') for this: it doesn't notice
// elements added to the shadow root after the wait starts, and times out even
// with the element on screen.
const waitForInterop = async (
  page: Page,
  selector: string,
  { hidden = false, timeout = 30000 } = {},
): Promise<ElementHandle<Element> | null> => {
  await page.waitForFunction((innerSelector, wantHidden) => {
    const el = document.querySelector('#interop-outlet')?.shadowRoot?.querySelector(innerSelector);
    const rect = el?.getBoundingClientRect();
    const shown = !!rect && rect.width > 0 && rect.height > 0;
    return wantHidden ? !shown : shown;
  }, { timeout }, selector.replace(INTEROP, ''), hidden);
  return hidden ? null : page.$(selector);
};

// Leaves the media editor for the composer, if the editor is open. The
// composer can take several seconds to re-render.
export const leaveMediaEditor = async (page: Page) => {
  const nextButton = await page.$(EDITOR_NEXT_BUTTON_SELECTOR);
  if (!nextButton || !(await nextButton.isVisible())) {
    return;
  }
  await nextButton.click();
  await page.waitForFunction(() => {
    const editor = document.querySelector('#interop-outlet')?.shadowRoot?.querySelector('.ql-editor');
    const rect = editor?.getBoundingClientRect();
    return !!rect && rect.width > 0 && rect.height > 0;
  }, { timeout: 30000 });
};

// Selects the index-th image in the media editor.
export const selectEditorImage = async (page: Page, index: number) => {
  const images = await page.$$(EDITOR_IMAGE_SELECTOR);
  if (!images[index]) {
    throw new Error(`No image #${index + 1} in the media editor (found ${images.length})`);
  }
  await images[index].click();
  await page.waitForFunction(i => {
    const root = document.querySelector('#interop-outlet')?.shadowRoot;
    const images = root?.querySelectorAll('.media-editor-file-manager__file-preview') ?? [];
    return images[i]?.getAttribute('aria-current') === 'true';
  }, { timeout: 5000 }, index);
};

// Opens the alt text tool for the selected image and returns its text field.
export const openAltTextTool = async (page: Page): Promise<ElementHandle<Element>> => {
  const toolButton = await waitForInterop(page, ALT_TEXT_TOOL_BUTTON_SELECTOR);
  if (!toolButton) {
    throw new Error('No alt text button in the media editor');
  }
  await toolButton.click();
  const field = await waitForInterop(page, ALT_TEXT_FIELD_SELECTOR);
  if (!field) {
    throw new Error('No alt text field in the media editor');
  }
  return field;
};

// Leaves the alt text tool: saving applies the text, otherwise it is discarded.
export const closeAltTextTool = async (page: Page, save: boolean) => {
  const button = save
    // The tool's only primary button ("Add") sits next to the text field.
    ? (await page.evaluateHandle(() => {
      const root = document.querySelector('#interop-outlet')?.shadowRoot;
      let el: Element | null = root?.querySelector('textarea.media-editor-tools-alt-text__input') ?? null;
      while (el && !el.querySelector('button.artdeco-button--primary')) {
        el = el.parentElement;
      }
      return el?.querySelector('button.artdeco-button--primary') ?? null;
    })).asElement() as ElementHandle<Element> | null
    : await page.$(ALT_TEXT_EXIT_BUTTON_SELECTOR);
  if (!button) {
    throw new Error(`No ${save ? 'save' : 'exit'} button in the alt text tool`);
  }
  await button.click();
  await waitForInterop(page, ALT_TEXT_FIELD_SELECTOR, { hidden: true });
};

export default class LinkedInPoster extends Poster {
  constructor() {
    super('linkedin', 'https://www.linkedin.com/login');
  }

  override isLoggedIn = async (page: Page): Promise<boolean> => {
    // A logged-in session gets redirected from /login to the feed.
    return this.waitForLoginState(page, START_POST_BUTTON_SELECTOR, PASSWORD_FIELD_SELECTOR);
  };

  override login = async (page: Page, user: string, password: string) => {
    const userField = await findVisible(page, USER_FIELD_SELECTOR);
    const passwordField = await findVisible(page, PASSWORD_FIELD_SELECTOR);
    if (!userField || !passwordField) {
      throw new Error('Could not find the visible LinkedIn login fields');
    }
    for (const [field, value] of [[userField, user], [passwordField, password]] as const) {
      await field.click({ clickCount: 3 });
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
    const startPostButton = await page.waitForSelector(START_POST_BUTTON_SELECTOR);
    if (startPostButton) {
      await startPostButton.click();
    }
    await waitForInterop(page, COMPOSER_EDITOR_SELECTOR);
  };

  // The first image is added from the composer, which then switches to the
  // media editor; later images are added from the editor itself.
  override getAddImageButton = async (page: Page): Promise<ElementHandle<Element> | null> => {
    if (this.uploadedImageCount > 0) {
      return waitForInterop(page, EDITOR_ADD_BUTTON_SELECTOR);
    }
    for (const selector of ADD_MEDIA_BUTTON_SELECTORS) {
      const button = await page.$(selector);
      if (button) {
        return button;
      }
    }
    return null;
  };

  // A new image is appended to the editor's list and becomes the selected one.
  override waitForImageAdded = async (page: Page) => {
    await page.waitForFunction(count => {
      const root = document.querySelector('#interop-outlet')?.shadowRoot;
      const images = root?.querySelectorAll('.media-editor-file-manager__file-preview') ?? [];
      const last = images[count - 1];
      return images.length === count && last.getAttribute('aria-current') === 'true'
        && last.getBoundingClientRect().width > 0;
    }, { timeout: 30000 }, this.uploadedImageCount + 1);
  };

  override addImageDescription = async (page: Page, description: string) => {
    // Called right after each upload, while the new image is selected.
    const field = await openAltTextTool(page);
    await field.click();
    await page.keyboard.type(description);
    await closeAltTextTool(page, true);
    this.addedImageDescriptionCount++;
  };

  override addMainText = async (page: Page, text: string) => {
    // With images, we're still in the media editor.
    await leaveMediaEditor(page);
    const editor = await waitForInterop(page, COMPOSER_EDITOR_SELECTOR);
    if (!editor) {
      throw new Error('No text editor in the LinkedIn composer');
    }
    await editor.click();
    await page.keyboard.type(text);
  };
}
