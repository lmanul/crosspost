import fs from 'fs';

import parseConfig from './configparser';
import {delay, makeBrowserWindow, newTabInBrowser} from './util';

import MastodonPoster from './mastodon';
import { type Page } from 'puppeteer';

const main = async () => {
  const config = await parseConfig('config.txt');
  console.log('Config', config);

  const browser = await makeBrowserWindow();
  const tab: Page = await newTabInBrowser(browser);
  const mastodon = new MastodonPoster();
  mastodon.loadInitialPage(tab);
  mastodon.login(tab, config['mastodon'][0], config['mastodon'][1]);
};

main();
