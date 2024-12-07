import puppeteer from 'puppeteer';
import { type Page } from 'puppeteer';

export default class Poster {
  name: string;
  baseUrl: string;

  constructor(name, baseUrl) {
    this.name = name;
    this.baseUrl = baseUrl;
  }

  loadInitialPage = async (page: Page) => {
    await page.goto(this.baseUrl);
    return page;
  }

  login = async (page: Page, user: string, password: string) => {}
  loadNewPostPage = async (page: Page) => {}
};
