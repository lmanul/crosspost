import { type Page } from 'puppeteer';
import { ContentBundle } from './provider';
import Poster from './posters/poster';
import InstagramPoster from './posters/instagram';

// Runs the full posting sequence for one service in the given tab, stopping
// short of hitting "Post". Shared by index.ts and the end-to-end tests so they
// cannot drift apart.
const composePost = async (
  poster: Poster,
  tab: Page,
  bundle: ContentBundle,
  credentials: [string, string] | undefined,
) => {
  console.log('Loading initial page...');
  await poster.loadInitialPage(tab);
  console.log('Maybe dismissing disclaimers...');
  await poster.maybeDismissDisclaimers(tab);
  const loggedIn = await poster.isLoggedIn(tab);
  if (!loggedIn) {
    console.log('Logging in...');
    if (!credentials) {
      throw new Error('Config does not have login data for ' + poster.name);
    }
    await poster.login(tab, credentials[0], credentials[1]);
  }
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
};

export default composePost;
