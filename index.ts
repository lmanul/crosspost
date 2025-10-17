import parseConfig from './configparser';
import { ContentBundle, ContentProvider } from './provider';
import { makeBrowserWindow, newTabInBrowser} from './util';
import { TimeoutError, type Page } from 'puppeteer';

import InstagramPoster from './posters/instagram';
import MastodonPoster from './posters/mastodon';
import BlueskyPoster from './posters/bluesky';
import Poster from './posters/poster';
import ThreadsPoster from './posters/threads';
import LinkedInPoster from './posters/linkedin';

const CONTENT_DIR = 'content';

const DEBUG = false;

const main = async () => {

  // TODO: Only instantiate stuff we find in the config.
  const posters: Poster[] = [
    new BlueskyPoster(),
    new InstagramPoster(),
    new MastodonPoster(),
    new ThreadsPoster(),
    new LinkedInPoster(),
  ];

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
      console.log('Loading initial page...');
      await poster.loadInitialPage(tab);
      console.log('Maybe dismissing disclaimers...');
      await poster.maybeDismissDisclaimers(tab);
      console.log('Logging in...');
      if (!config[poster.name]) {
        throw new Error('Config does not have login data for ' + poster.name);
      }
      await poster.login(tab, config[poster.name][0], config[poster.name][1]);
      console.log('Loading "new post" page...');
      await poster.loadNewPostPage(tab);

      if (bundle.images.length > 0) {
        for (let image of bundle.images) {
          console.log('Adding image...');
          await poster.addOneImage(tab, image.imagePath);
          if (!(poster instanceof InstagramPoster)) {
            // For Instagram, we need to add the descriptions at the end.
            console.log('Adding image description...');
            await poster.addImageDescription(tab, image.imageDescription);
          }
        }
      }
      console.log('Adding main text...');
      await poster.addMainText(tab, bundle.mainText);
      if (poster instanceof InstagramPoster) {
        for (let image of bundle.images) {
          console.log('Adding image description...');
          await poster.addImageDescription(tab, image.imageDescription);
        }
      }
    } catch (e) {
      console.log('Caught ' + e.message);
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
