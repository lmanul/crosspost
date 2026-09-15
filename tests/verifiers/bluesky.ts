import { type HTTPRequest, type Page } from 'puppeteer';
import Verifier from './verifier';

// Bluesky's web app exposes React Native testIDs as data-testid, which are
// steadier than labels: e.g. aria-label="Add alt text" also matches a second,
// unlabelled button per image and the alt text dialog itself.
const TEXT_FIELD_SELECTOR = '[data-testid="composePostView"] [contenteditable="true"]';
const ATTACHED_IMAGE_SELECTOR = '[data-testid="removePhotoButton"]';
const ALT_TEXT_BUTTON_SELECTOR = '[data-testid="altTextButton"]';
const ALT_TEXT_FIELD_SELECTOR = 'textarea[aria-label="Alt text"]';
// Not "Save": it stays disabled while the alt text is unchanged.
const CLOSE_DIALOG_SELECTOR = 'button[aria-label="Close active dialog"]';
const PUBLISH_BUTTON_SELECTORS = ['[data-testid="composerPublishBtn"]', '[aria-label="Publish post"]'];

export default class BlueskyVerifier extends Verifier {

  // Posts are written to the user's repo, either one record at a time or in a
  // batch (threads, threadgates).
  isPublishRequest = (request: HTTPRequest) =>
    request.method() === 'POST'
    && /\/xrpc\/com\.atproto\.repo\.(createRecord|applyWrites)(\?|$)/.test(request.url());

  override checkMainText = async (page: Page, expected: string) => {
    const field = await page.$(TEXT_FIELD_SELECTOR);
    if (!field) {
      throw new Error(`no text field found (is "${TEXT_FIELD_SELECTOR}" still right?)`);
    }
    const actual = await field.evaluate(el => (el as HTMLElement).innerText);
    if (actual.trim() !== expected) {
      throw new Error(`expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
    }
    return `${expected.length} characters match`;
  };

  override checkImagesAttached = async (page: Page, expectedCount: number) => {
    // One "Remove image" button per attached image.
    const count = (await page.$$(ATTACHED_IMAGE_SELECTOR)).length;
    if (count !== expectedCount) {
      const hint = count === 0 ? ` (is "${ATTACHED_IMAGE_SELECTOR}" still right?)` : '';
      throw new Error(`expected ${expectedCount} attachments, found ${count}${hint}`);
    }
    return `${count} of ${expectedCount} attached`;
  };

  override checkReadyToPost = async (page: Page) => {
    for (const selector of PUBLISH_BUTTON_SELECTORS) {
      const button = await page.$(selector);
      if (!button) {
        continue;
      }
      // Only read the button's state. Never click it.
      const [disabled, label] = await button.evaluate(el => [
        el.getAttribute('aria-disabled') === 'true' || (el as HTMLButtonElement).disabled === true,
        el.textContent?.trim() ?? '',
      ] as const);
      if (disabled) {
        throw new Error(`"${label}" button is disabled`);
      }
      return `"${label}" button is enabled (not clicked)`;
    }
    throw new Error('could not find the publish button');
  };

  override checkImageDescriptions = async (page: Page, expected: string[]) => {
    const mismatches: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      const buttons = await page.$$(ALT_TEXT_BUTTON_SELECTOR);
      if (buttons.length !== expected.length) {
        throw new Error(`expected ${expected.length} alt text buttons, found ${buttons.length}`
          + ` (is "${ALT_TEXT_BUTTON_SELECTOR}" still right?)`);
      }
      const button = buttons[i];
      await button.click();

      await page.waitForSelector(ALT_TEXT_FIELD_SELECTOR);
      const actual = await page.$eval(
        ALT_TEXT_FIELD_SELECTOR, el => (el as HTMLTextAreaElement).value);
      if (actual.trim() !== expected[i]) {
        mismatches.push(`#${i + 1}: expected ${JSON.stringify(expected[i])}, found ${JSON.stringify(actual)}`);
      }

      const closeButton = await page.waitForSelector(CLOSE_DIALOG_SELECTOR);
      if (closeButton) {
        await closeButton.click();
      }
      await page.waitForSelector(ALT_TEXT_FIELD_SELECTOR, { hidden: true });
    }

    if (mismatches.length > 0) {
      throw new Error(mismatches.join('; '));
    }
    return `all ${expected.length} match`;
  };
};
