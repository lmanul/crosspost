import { type Page } from 'puppeteer';
import { ContentBundle } from '../../provider';

export type CheckResult = {
  name: string;
  passed: boolean;
  details: string;
};

// Inspects a composed-but-unsent post and reports whether it matches the
// content bundle. Each check resolves with a short success summary, or throws
// with an explanation of what is wrong.
export default abstract class Verifier {
  // Requests matching this (method + URL) would publish the post. The test
  // harness watches for them and fails loudly if one is ever sent.
  abstract publishRequest: { method: string; urlPattern: RegExp };

  abstract checkMainText: (page: Page, expected: string) => Promise<string>;
  abstract checkImagesAttached: (page: Page, expectedCount: number) => Promise<string>;
  abstract checkReadyToPost: (page: Page) => Promise<string>;
  // Runs last, since it may open and close dialogs.
  abstract checkImageDescriptions: (page: Page, expected: string[]) => Promise<string>;

  verify = async (page: Page, bundle: ContentBundle): Promise<CheckResult[]> => {
    const checks: [string, () => Promise<string>][] = [
      ['main text', () => this.checkMainText(page, bundle.mainText)],
      ['images attached', () => this.checkImagesAttached(page, bundle.images.length)],
      ['ready to post', () => this.checkReadyToPost(page)],
      ['alt texts', () => this.checkImageDescriptions(
        page, bundle.images.map(image => image.imageDescription))],
    ];

    const results: CheckResult[] = [];
    for (const [name, run] of checks) {
      try {
        results.push({ name, passed: true, details: await run() });
      } catch (e) {
        results.push({ name, passed: false, details: e instanceof Error ? e.message : String(e) });
      }
    }
    return results;
  };
};
