import parseConfig from './configparser';
import composePost from './compose';
import { ContentBundle, ContentProvider } from './provider';
import { makeBrowserWindow, newTabInBrowser } from './util';
import { TimeoutError, type Page } from 'puppeteer';

import InstagramPoster from './posters/instagram';
import Poster from './posters/poster';
import SERVICES from './posters/registry';

const CONTENT_DIR = 'content';

const DEBUG = false;

const main = async () => {

  // TODO: Only instantiate stuff we find in the config.
  const posters: Poster[] = Object.values(SERVICES).map(makePoster => makePoster());

  const config = await parseConfig('config.txt');

  const browser = await makeBrowserWindow();

  const bundle: ContentBundle = await (new ContentProvider(CONTENT_DIR).getContent());

  if (bundle.images.length > 0) {
    console.log(`Found ${bundle.images.length} images to attach`);
  }

  for (let poster of posters) {
    if (poster instanceof InstagramPoster && bundle.images.length === 0) {
      console.log('No images detected, skipping Instagram.');
      continue;
    }
    const tab: Page = await newTabInBrowser(browser);

    try {
      await composePost(poster, tab, bundle, config[poster.name]);
    } catch (e) {
      console.log('Caught ' + (e instanceof Error ? e.message : String(e)));
      if (e instanceof TimeoutError) {
        if (!DEBUG) {
          console.log(e.message);
          console.log('Time out with ' + poster.name + ', skipping to next');
        } else {
          // In Debug, be more aggressive in re-throwing the error.
          throw e;
        }
      }
    }
  }
  console.log('For the time being, I will not actually hit "Post". Please verify first!');
};

main();
