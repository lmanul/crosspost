import Poster from './poster';
import BlueskyPoster from './bluesky';
import InstagramPoster from './instagram';
import LinkedInPoster from './linkedin';
import MastodonPoster from './mastodon';
import ThreadsPoster from './threads';

// All supported services, keyed by poster name (which is also the config.txt
// key). Insertion order is the order index.ts posts in.
const SERVICES: Record<string, () => Poster> = {
  bsky: () => new BlueskyPoster(),
  instagram: () => new InstagramPoster(),
  mastodon: () => new MastodonPoster(),
  threads: () => new ThreadsPoster(),
  linkedin: () => new LinkedInPoster(),
};

export default SERVICES;
