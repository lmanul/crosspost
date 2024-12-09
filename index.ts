import parseConfig from './configparser';
import {makeBrowserWindow, newTabInBrowser} from './util';
import { type Page } from 'puppeteer';

import InstagramPoster from './posters/instagram';
import MastodonPoster from './posters/mastodon';
import BlueskyPoster from './posters/bluesky';
import ThreadsPoster from './posters/threads';

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

  for (let poster of posters) {
    const tab: Page = await newTabInBrowser(browser);
    await poster.loadInitialPage(tab);
    await poster.login(tab, config[poster.name][0], config[poster.name][1]);
    await poster.loadNewPostPage(tab);
    await poster.addMainText(tab, 'This is a test');
  }
};

main();
