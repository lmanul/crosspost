import parseConfig from './configparser';
import { delay, makeBrowserWindow, newTabInBrowser} from './util';
import { type Page, type TimeoutError } from 'puppeteer';

import InstagramPoster from './posters/instagram';
import MastodonPoster from './posters/mastodon';
import BlueskyPoster from './posters/bluesky';
import ThreadsPoster from './posters/threads';
import ContentProvider from './contentprovider';

const CONTENT_DIR = 'content';

const DEBUG = false;

const main = async () => {

  // TODO: Only instantiate stuff we find in the config.
  const posters = [
    new BlueskyPoster(),
    new InstagramPoster(),
    new MastodonPoster(),
    new ThreadsPoster(),
  ];

  const config = await parseConfig('config.txt');

  const browser = await makeBrowserWindow();

  const bundle = await (new ContentProvider(CONTENT_DIR).getContent());

  if (bundle.images.length > 0) {
    console.log(`Found ${bundle.images.length} images to attach`);
  }

  console.log('Posting...');
  for (let poster of posters) {
    if (poster instanceof InstagramPoster && bundle.images.length === 0) {
      console.log('No images detected, skipping Instagram.');
      continue;
    }
    const tab: Page = await newTabInBrowser(browser);

    try {
      await poster.loadInitialPage(tab);
      await poster.login(tab, config[poster.name][0], config[poster.name][1]);
      await poster.loadNewPostPage(tab);
      await poster.addMainText(tab, bundle.mainText);

      if (bundle.images.length > 0) {
        for (let image of bundle.images) {
          await poster.addOneImage(tab, image.imagePath);
          await poster.addImageDescription(tab, image.imageDescription);
        }
      }
    } catch (e) {
      if (!DEBUG) {
        console.log('Error with ' + poster.name + ', skipping to next');
      }
    }
  }
  console.log('For the time being, I will not actually hit "Post". Please verify first!');
};

main();
