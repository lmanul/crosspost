import { type HTTPRequest, type Page } from 'puppeteer';
import Verifier from './verifier';

const TEXTAREA_SELECTOR = 'textarea';
const UPLOAD_SELECTOR = '.compose-form__upload';
const UPLOAD_EDIT_ICON_SELECTOR = '.icon-edit';
const WARNING_ICON_SELECTOR = '.icon.icon-warning';
const UPLOAD_MODAL_DESCRIPTION_SELECTOR = '#description';
const SUBMIT_BUTTON_SELECTORS = ['.compose-form button[type="submit"]', 'button[type="submit"]'];

export default class MastodonVerifier extends Verifier {

  isPublishRequest = (request: HTTPRequest) =>
    request.method() === 'POST' && /\/api\/v1\/statuses(\?|$)/.test(request.url());

  override checkMainText = async (page: Page, expected: string) => {
    const actual = await page.$eval(TEXTAREA_SELECTOR, el => (el as HTMLTextAreaElement).value);
    if (actual.trim() !== expected) {
      throw new Error(`expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
    }
    return `${expected.length} characters match`;
  };

  override checkImagesAttached = async (page: Page, expectedCount: number) => {
    const uploading = await page.$('text/Uploading...');
    if (uploading) {
      throw new Error('an upload is still in progress');
    }
    const count = (await page.$$(UPLOAD_SELECTOR)).length;
    if (count !== expectedCount) {
      const hint = count === 0 ? ` (is "${UPLOAD_SELECTOR}" still the right selector?)` : '';
      throw new Error(`expected ${expectedCount} attachments, found ${count}${hint}`);
    }
    return `${count} of ${expectedCount} attached`;
  };

  override checkReadyToPost = async (page: Page) => {
    for (const selector of SUBMIT_BUTTON_SELECTORS) {
      const button = await page.$(selector);
      if (!button) {
        continue;
      }
      // Only read the button's state. Never click it.
      const [disabled, label] = await button.evaluate(
        el => [(el as HTMLButtonElement).disabled, el.textContent?.trim() ?? ''] as const);
      if (disabled) {
        throw new Error(`"${label}" button is disabled`);
      }
      return `"${label}" button is enabled (not clicked)`;
    }
    throw new Error('could not find the submit button');
  };

  override checkImageDescriptions = async (page: Page, expected: string[]) => {
    const warnings = (await page.$$(WARNING_ICON_SELECTOR)).length;
    if (warnings > 0) {
      throw new Error(`${warnings} attachment(s) still flagged as missing a description`);
    }

    const uploads = await page.$$(UPLOAD_SELECTOR);
    if (uploads.length !== expected.length) {
      throw new Error(`cannot compare ${expected.length} descriptions against ${uploads.length} attachments`);
    }

    const mismatches: string[] = [];
    for (let i = 0; i < uploads.length; i++) {
      const editIcon = await uploads[i].$(UPLOAD_EDIT_ICON_SELECTOR);
      if (!editIcon) {
        throw new Error(`no edit button found on attachment #${i + 1} (is "${UPLOAD_EDIT_ICON_SELECTOR}" still right?)`);
      }
      await editIcon.evaluate(el => (el.closest('button') ?? el as HTMLElement).click());

      await page.waitForSelector(UPLOAD_MODAL_DESCRIPTION_SELECTOR);
      const actual = await page.$eval(
        UPLOAD_MODAL_DESCRIPTION_SELECTOR, el => (el as HTMLTextAreaElement).value);
      if (actual.trim() !== expected[i]) {
        mismatches.push(`#${i + 1}: expected ${JSON.stringify(expected[i])}, found ${JSON.stringify(actual)}`);
      }

      // Same way out as MastodonPoster.addImageDescription; the text is unchanged.
      const doneButton = await page.waitForSelector('text/Done');
      if (doneButton) {
        await doneButton.click();
      }
      await page.waitForSelector(UPLOAD_MODAL_DESCRIPTION_SELECTOR, { hidden: true });
    }

    if (mismatches.length > 0) {
      throw new Error(mismatches.join('; '));
    }
    return `all ${expected.length} match`;
  };
};
