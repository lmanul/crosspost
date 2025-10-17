import Poster from "./poster";

export default class LinkedInPoster extends Poster {
    constructor() {
      super('linkedin', 'https://www.linkedin.com/login');
    }

    override login = async (page, user, password) => {
    await page.type('#username', user);
    await page.type('#password', password);
    page.keyboard.press('Enter');
  };

    override loadNewPostPage = async (page) => {
    const startPostButton = await page.waitForSelector('[aria-label="Start a post"]');
    await startPostButton.click();
  };

}