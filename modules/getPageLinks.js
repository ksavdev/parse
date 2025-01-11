import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const LINKS_JSON_PATH = './data/links.json';
const FORUM_URL = 'https://forum.onliner.by/viewforum.php?f=53&start=0';

async function getPageLinks() {
    console.log(`[${new Date().toISOString()}] >>> Проверяем наличие файла ${LINKS_JSON_PATH}`);
    let existingLinks = [];
    if (await fs.pathExists(LINKS_JSON_PATH)) {
        existingLinks = await fs.readJson(LINKS_JSON_PATH);
        console.log(`[${new Date().toISOString()}] >>> Найдено ${existingLinks.length} уже собранных ссылок.`);
    }

    console.log(`[${new Date().toISOString()}] >>> Запуск браузера Puppeteer.`);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    console.log(`[${new Date().toISOString()}] >>> Переход на страницу форума: ${FORUM_URL}`);
    await page.goto(FORUM_URL, { waitUntil: 'networkidle2' });

    const expandButtonSelector = 'a.exppages-ttl';
    const expandButton = await page.$(expandButtonSelector);

    if (expandButton) {
        console.log(`[${new Date().toISOString()}] >>> Нажатие кнопки для раскрытия дополнительных страниц.`);
        await expandButton.click();
        await page.waitForSelector('div.b-pages.active-droppages ul.pages-fastnav', { timeout: 10000 });
        console.log(`[${new Date().toISOString()}] >>> Расширенная пагинация загружена.`);
    } else {
        console.log(`[${new Date().toISOString()}] >>> Кнопка "exppages-ttl" не найдена. Все страницы уже отображены.`);
    }

    console.log(`[${new Date().toISOString()}] >>> Сбор ссылок на страницы пагинации.`);
    const links = await page.evaluate(() => {
        const linkElements = document.querySelectorAll('div.b-pages a[href*="viewforum.php?f=53&start="]');
        return Array.from(linkElements).map(el => new URL(el.href, document.baseURI).href);
    });

    console.log(`[${new Date().toISOString()}] >>> Найдено ${links.length} ссылок.`);
    const uniqueLinks = [...new Set(links)].filter(link => !existingLinks.includes(link));
    console.log(`[${new Date().toISOString()}] >>> Уникальные ссылки: ${uniqueLinks.length} новых ссылок.`);

    for (const link of uniqueLinks) {
        existingLinks.push(link);
        await fs.outputJson(LINKS_JSON_PATH, existingLinks, { spaces: 2 });
        console.log(`[${new Date().toISOString()}] >>> Добавлена ссылка: ${link}`);
    }

    console.log(`[${new Date().toISOString()}] >>> Закрытие браузера Puppeteer.`);
    await browser.close();

    return existingLinks;
}

export default getPageLinks;
