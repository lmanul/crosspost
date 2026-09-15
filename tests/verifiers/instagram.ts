import { type Page } from 'puppeteer';
import Verifier from './verifier';

// By the end of InstagramPoster, the "Create new post" dialog is on its final
// step: caption typed, Accessibility section expanded, one alt text input per
// image, and a "Share" button in the dialog header.
const DIALOG_SELECTOR = '[role="dialog"]';
const CAPTION_SELECTOR = '[aria-label="Write a caption..."]';
const ALT_TEXT_INPUT_SELECTOR = 'input[placeholder="Write alt text..."]';
const SHARE_BUTTON_SELECTOR = `${DIALOG_SELECTOR} ::-p-text(Share)`;

export default class InstagramVerifier extends Verifier {

  // Web posts go through media/configure/ (single image) or
  // media/configure_sidecar/ (carousel).
  publishRequest = { method: 'POST', urlPattern: /\/configure(_sidecar)?\/?(\?|$)/ };

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
    const shareButton = await page.$(SHARE_BUTTON_SELECTOR);
    if (!shareButton) {
      throw new Error('could not find the "Share" button in the dialog');
    }
    // Only read the button's state. Never click it.
    const disabled = await shareButton.evaluate(el => {
      const button = el.closest('[role="button"], button') ?? el;
      return button.getAttribute('aria-disabled') === 'true'
        || (button as HTMLButtonElement).disabled === true;
    });
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
