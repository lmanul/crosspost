import { type HTTPRequest, type Page } from 'puppeteer';
import {
  closeAltTextTool,
  COMPOSER_EDIT_MEDIA_SELECTOR,
  COMPOSER_EDITOR_SELECTOR,
  COMPOSER_IMAGE_SELECTOR,
  COMPOSER_POST_BUTTON_SELECTOR,
  leaveMediaEditor,
  openAltTextTool,
  selectEditorImage,
} from '../../posters/linkedin';
import Verifier from './verifier';

export default class LinkedInVerifier extends Verifier {

  // Creating a post has gone through several APIs over time. Opening the
  // composer also POSTs (voyagerContentcreationDashSharebox,
  // sharing.LaunchShareboxTracking), so those must not match.
  isPublishRequest = (request: HTTPRequest) => {
    if (request.method() !== 'POST') {
      return false;
    }
    const url = request.url();
    if (/\/voyager\/api\/(contentcreation\/normShares|ugcPosts|feed\/shares)/i.test(url)) {
      return true;
    }
    const queryId = /[?&]queryId=([^&]+)/.exec(url)?.[1] ?? '';
    if (/^voyagerContentcreationDash(Shares|Posts)\./.test(queryId)) {
      return true;
    }
    const sduiid = decodeURIComponent(/[?&]sduiid=([^&]+)/.exec(url)?.[1] ?? '');
    return /\.sharing\.\w*(create|publish|submit)/i.test(sduiid);
  };

  override checkMainText = async (page: Page, expected: string) => {
    const editor = await page.$(COMPOSER_EDITOR_SELECTOR);
    if (!editor) {
      throw new Error('no text editor in the composer');
    }
    const actual = await editor.evaluate(el => (el as HTMLElement).innerText);
    if (actual.trim() !== expected) {
      throw new Error(`expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
    }
    return `${expected.length} characters match`;
  };

  override checkImagesAttached = async (page: Page, expectedCount: number) => {
    const count = (await page.$$(COMPOSER_IMAGE_SELECTOR)).length;
    if (count !== expectedCount) {
      throw new Error(`expected ${expectedCount} attachments, found ${count}`);
    }
    return `${count} of ${expectedCount} attached`;
  };

  override checkReadyToPost = async (page: Page) => {
    const button = await page.$(COMPOSER_POST_BUTTON_SELECTOR);
    if (!button) {
      throw new Error('could not find the "Post" button');
    }
    // Only read the button's state. Never click it.
    const [disabled, label] = await button.evaluate(el => [
      (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true',
      (el as HTMLElement).innerText.trim(),
    ] as const);
    if (disabled) {
      throw new Error(`"${label}" button is disabled`);
    }
    return `"${label}" button is enabled (not clicked)`;
  };

  override checkImageDescriptions = async (page: Page, expected: string[]) => {
    // Alt texts are only visible in the media editor, so reopen it, read each
    // one without saving, and come back to the composer.
    const editMedia = await page.$(COMPOSER_EDIT_MEDIA_SELECTOR);
    if (!editMedia) {
      throw new Error('no "Edit media preview" button in the composer');
    }
    await editMedia.click();
    // Wait for the editor itself to show: its image list may linger hidden.
    await page.waitForFunction(count => {
      const root = document.querySelector('#interop-outlet')?.shadowRoot;
      const visible = Array.from(root?.querySelectorAll('.media-editor-file-manager__file-preview') ?? [])
        .filter(el => el.getBoundingClientRect().width > 0);
      return visible.length === count;
    }, { timeout: 30000 }, expected.length);

    const mismatches: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      await selectEditorImage(page, i);
      const field = await openAltTextTool(page);
      const actual = await field.evaluate(el => (el as HTMLTextAreaElement).value);
      if (actual.trim() !== expected[i]) {
        mismatches.push(`#${i + 1}: expected ${JSON.stringify(expected[i])}, found ${JSON.stringify(actual)}`);
      }
      await closeAltTextTool(page, false);
    }
    await leaveMediaEditor(page);

    if (mismatches.length > 0) {
      throw new Error(mismatches.join('; '));
    }
    return `all ${expected.length} match`;
  };
};
