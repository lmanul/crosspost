import { type HTTPRequest, type Page } from 'puppeteer';
import { closeAltTextEditor, findByText, openAltTextEditor } from '../../posters/threads';
import Verifier from './verifier';

// The composer's textbox comes before any alt text editor's in the DOM.
const COMPOSER_TEXT_SELECTORS = [
  '[role="dialog"] [role="textbox"][contenteditable="true"]',
  '[role="dialog"] [contenteditable="true"]',
];
const DIALOG_BUTTON_SELECTOR = '[role="dialog"] [role="button"], [role="dialog"] button';

export default class ThreadsVerifier extends Verifier {

  // Threads' web app publishes either through its REST-style media/configure
  // endpoints or a GraphQL mutation, which shares its URL with every query.
  isPublishRequest = (request: HTTPRequest) => {
    if (request.method() !== 'POST') {
      return false;
    }
    const url = request.url();
    if (/\/api\/v1\/media\/configure/.test(url)) {
      return true;
    }
    return /\/graphql/.test(url)
      && /fb_api_req_friendly_name=[^&]*(Create|Publish)[^&]*(Post|Thread|Media)/i
        .test(request.postData() ?? '');
  };

  override checkMainText = async (page: Page, expected: string) => {
    for (const selector of COMPOSER_TEXT_SELECTORS) {
      const field = await page.$(selector);
      if (!field) {
        continue;
      }
      const actual = await field.evaluate(el => (el as HTMLElement).innerText);
      if (actual.trim() !== expected) {
        throw new Error(`expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
      }
      return `${expected.length} characters match`;
    }
    throw new Error('no composer text field found');
  };

  override checkImagesAttached = async (page: Page, expectedCount: number) => {
    // Each attached image has its own "Remove" button.
    const count = (await findByText(page, DIALOG_BUTTON_SELECTOR, 'Remove')).length;
    if (count !== expectedCount) {
      const hint = count === 0 ? ' (no "Remove" buttons in the composer)' : '';
      throw new Error(`expected ${expectedCount} attachments, found ${count}${hint}`);
    }
    return `${count} of ${expectedCount} attached`;
  };

  override checkReadyToPost = async (page: Page) => {
    const buttons = await findByText(page, DIALOG_BUTTON_SELECTOR, 'Post');
    const button = buttons[buttons.length - 1];
    if (!button) {
      throw new Error('could not find the "Post" button in the composer');
    }
    // Only read the button's state. Never click it.
    const disabled = await button.evaluate(el =>
      el.getAttribute('aria-disabled') === 'true' || (el as HTMLButtonElement).disabled === true);
    if (disabled) {
      throw new Error('"Post" button is disabled');
    }
    return '"Post" button is enabled (not clicked)';
  };

  override checkImageDescriptions = async (page: Page, expected: string[]) => {
    const mismatches: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      const field = await openAltTextEditor(page, i);
      const actual = await field.evaluate(el => (el as HTMLElement).innerText);
      if (actual.trim() !== expected[i]) {
        mismatches.push(`#${i + 1}: expected ${JSON.stringify(expected[i])}, found ${JSON.stringify(actual)}`);
      }
      // Nothing was changed, so leave without saving.
      await closeAltTextEditor(page, 'Back');
    }

    if (mismatches.length > 0) {
      throw new Error(mismatches.join('; '));
    }
    return `all ${expected.length} match`;
  };
};
