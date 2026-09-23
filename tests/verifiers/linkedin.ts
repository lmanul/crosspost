import { type HTTPRequest, type Page } from 'puppeteer';
import {
  COMPOSER_EDITOR_SELECTOR,
  getAttachedImages,
  getPostButton,
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
    const actual = await page.evaluate(sel => {
      const editor = document.querySelector(sel);
      return editor ? (editor as HTMLElement).innerText : null;
    }, COMPOSER_EDITOR_SELECTOR);
    if (actual === null) {
      throw new Error('no text editor in the composer (still the right selector? '
        + COMPOSER_EDITOR_SELECTOR + ')');
    }
    if (actual.trim() !== expected) {
      throw new Error(`expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
    }
    return `${expected.length} characters match`;
  };

  override checkImagesAttached = async (page: Page, expectedCount: number) => {
    const count = (await getAttachedImages(page)).length;
    if (count !== expectedCount) {
      throw new Error(`expected ${expectedCount} attachments, found ${count}`);
    }
    return `${count} of ${expectedCount} attached`;
  };

  override checkReadyToPost = async (page: Page) => {
    const button = await getPostButton(page);
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

  // LinkedIn copies each saved alt text onto the composer's preview image, so
  // they can be read without reopening the media editor (and without any risk
  // of saving something on the way out).
  override checkImageDescriptions = async (page: Page, expected: string[]) => {
    const images = await getAttachedImages(page);
    if (images.length !== expected.length) {
      throw new Error(`expected ${expected.length} images, found ${images.length}`);
    }
    const mismatches: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      if (images[i].alt.trim() !== expected[i]) {
        mismatches.push(
          `#${i + 1}: expected ${JSON.stringify(expected[i])}, found ${JSON.stringify(images[i].alt)}`);
      }
    }
    if (mismatches.length > 0) {
      throw new Error(mismatches.join('; '));
    }
    return `all ${expected.length} match`;
  };
};
