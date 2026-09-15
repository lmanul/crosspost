import { type HTTPRequest, type Page } from 'puppeteer';
import { CAPTION_SELECTOR } from '../../posters/instagram';
import Verifier from './verifier';

// By the end of InstagramPoster, the "Create new post" dialog is on its final
// step: caption typed, Accessibility section expanded, one alt text input per
// image, and a "Share" button in the dialog header.
const DIALOG_SELECTOR = '[role="dialog"]';
const ALT_TEXT_INPUT_SELECTOR = 'input[placeholder="Write alt text..."]';
const DIALOG_BUTTON_SELECTOR = `${DIALOG_SELECTOR} [role="button"], ${DIALOG_SELECTOR} button`;

export default class InstagramVerifier extends Verifier {

  // Web posts go through media/configure/ (single image) or
  // media/configure_sidecar/ (carousel).
  isPublishRequest = (request: HTTPRequest) =>
    request.method() === 'POST' && /\/configure(_sidecar)?\/?(\?|$)/.test(request.url());

  override checkMainText = async (page: Page, expected: string) => {
    const caption = await page.$(CAPTION_SELECTOR);
    if (!caption) {
      throw new Error(`no caption field found (is "${CAPTION_SELECTOR}" still right?)`);
    }
    const actual = await caption.evaluate(el => (el as HTMLElement).innerText);
    if (actual.trim() !== expected) {
      throw new Error(`expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
    }
    return `${expected.length} characters match`;
  };

  override checkImagesAttached = async (page: Page, expectedCount: number) => {
    // The Accessibility section lists one alt text input per attached image.
    const count = (await page.$$(ALT_TEXT_INPUT_SELECTOR)).length;
    if (count !== expectedCount) {
      const hint = count === 0 ? ` (is "${ALT_TEXT_INPUT_SELECTOR}" still right?)` : '';
      throw new Error(`expected ${expectedCount} attachments, found ${count}${hint}`);
    }
    return `${count} of ${expectedCount} attached`;
  };

  override checkReadyToPost = async (page: Page) => {
    // Exact text: the dialog also has a "Share to" section header.
    let shareButton = null;
    for (const button of await page.$$(DIALOG_BUTTON_SELECTOR)) {
      if (await button.evaluate(el => el.textContent?.trim() === 'Share')) {
        shareButton = button;
        break;
      }
    }
    if (!shareButton) {
      throw new Error('could not find the "Share" button in the dialog');
    }
    // Only read the button's state. Never click it.
    const disabled = await shareButton.evaluate(el =>
      el.getAttribute('aria-disabled') === 'true' || (el as HTMLButtonElement).disabled === true);
    if (disabled) {
      throw new Error('"Share" button is disabled');
    }
    return '"Share" button is enabled (not clicked)';
  };

  override checkImageDescriptions = async (page: Page, expected: string[]) => {
    const actual = await page.$$eval(
      ALT_TEXT_INPUT_SELECTOR, inputs => inputs.map(i => (i as HTMLInputElement).value));
    if (actual.length !== expected.length) {
      throw new Error(`cannot compare ${expected.length} descriptions against ${actual.length} alt text inputs`);
    }
    const mismatches = expected
      .map((want, i) => actual[i].trim() === want
        ? null
        : `#${i + 1}: expected ${JSON.stringify(want)}, found ${JSON.stringify(actual[i])}`)
      .filter(m => m !== null);
    if (mismatches.length > 0) {
      throw new Error(mismatches.join('; '));
    }
    return `all ${expected.length} match`;
  };
};
