import parseConfig from './configparser';
import {makeBrowserWindow, newTabInBrowser} from './util';
import { type Page } from 'puppeteer';

import InstagramPoster from './posters/instagram';
import MastodonPoster from './posters/mastodon';
import BlueskyPoster from './posters/bluesky';
import ThreadsPoster from './posters/threads';
import ContentProvider from './contentprovider';

const CONTENT_DIR = 'content';

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
    const tab: Page = await newTabInBrowser(browser);
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
  }
};

main();
