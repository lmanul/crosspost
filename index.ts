import parseConfig from './configparser';
import {makeBrowserWindow, newTabInBrowser} from './util';

import InstagramPoster from './instagram';
import MastodonPoster from './mastodon';
import { type Page } from 'puppeteer';
import BlueskyPoster from './bluesky';

const main = async () => {

  // TODO: Only instantiate stuff we find in the config.
  const posters = [
    new BlueskyPoster(),
    new InstagramPoster(),
    new MastodonPoster(),
  ];

  const config = await parseConfig('config.txt');
  console.log('Config', config);

  const browser = await makeBrowserWindow();

  for (let poster of posters) {
    const tab: Page = await newTabInBrowser(browser);
    await poster.loadInitialPage(tab);
    await poster.login(tab, config[poster.name][0], config[poster.name][1]);
  }
};

main();
