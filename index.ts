import parseConfig from './configparser';
import {makeBrowserWindow, newTabInBrowser} from './util';

import InstagramPoster from './instagram';
import MastodonPoster from './mastodon';
import { type Page } from 'puppeteer';

const main = async () => {

  // TODO: Only instantiate stuff we find in the config.
  const posters = [
    new MastodonPoster(),
    new InstagramPoster(),
  ];

  const config = await parseConfig('config.txt');
  console.log('Config', config);

  const browser = await makeBrowserWindow();
  const tab: Page = await newTabInBrowser(browser);

  for (let poster of posters) {
    await poster.loadInitialPage(tab);
    await poster.login(tab, config[poster.name][0], config[poster.name][1]);
  }
};

main();
