// parseTopics.js
import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const LINKS_JSON_PATH = './data/links.json';
const TOPICS_JSON_PATH = './data/topics.json';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function parseTopics() {
    if (!await fs.pathExists(LINKS_JSON_PATH)) {
        throw new Error(`Файл ${LINKS_JSON_PATH} не найден.`);
    }

    const links = await fs.readJson(LINKS_JSON_PATH);
    console.log(`Найдено ${links.length} ссылок для парсинга.`);

    let existingTopics = [];
    if (await fs.pathExists(TOPICS_JSON_PATH)) {
        existingTopics = await fs.readJson(TOPICS_JSON_PATH);
        console.log(`Найдено ${existingTopics.length} уже собранных подтем.`);
    }

    const existingLinks = new Set(existingTopics.map(topic => topic.link));

    const allTopics = [];
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font'].includes(resourceType)) {
            req.abort();
        } else {
            req.continue();
        }
    });

    for (const [index, url] of links.entries()) {
        if (existingLinks.has(url)) {
            console.log(`Пропускаем уже собранную ссылку (${index + 1}/${links.length}): ${url}`);
            continue;
        }

        try {
            console.log(`Парсинг страницы ${index + 1}/${links.length}: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2' });

            await page.waitForSelector('ul.b-list-topics');

            const topics = await page.evaluate(() => {
                const topicElements = document.querySelectorAll('ul.b-list-topics > li');
                const extractedTopics = [];

                topicElements.forEach(el => {
                    const titleElement = el.querySelector('div.b-lt-subj > h3 > a.topictitle');
                    const title = titleElement ? titleElement.innerText.trim() : null;

                    const relativeLink = titleElement ? titleElement.getAttribute('href') : null;
                    const link = relativeLink ? new URL(relativeLink, 'https://forum.onliner.by').href : null;

                    const dateElement = el.querySelector('div.b-lt-author > a.link-getlast');
                    const date = dateElement ? dateElement.innerText.trim() : null;

                    if (title && link && date) {
                        extractedTopics.push({ title, link, date });
                    }
                });

                return extractedTopics;
            });

            console.log(`Найдено ${topics.length} подтем на странице.`);

            allTopics.push(...topics);
            await delay(1000);
        } catch (error) {
            console.error(`Ошибка при парсинге страницы ${url} (${index + 1}/${links.length}):`, error);
        }
    }

    await browser.close();

    const uniqueTopics = [...new Map([...existingTopics, ...allTopics].map(item => [item.link, item])).values()];
    console.log(`Всего собрано ${allTopics.length} подтем. После удаления дубликатов осталось ${uniqueTopics.length} уникальных подтем.`);

    await fs.outputJson(TOPICS_JSON_PATH, uniqueTopics, { spaces: 2 });
    console.log(`Собранные данные сохранены в ${TOPICS_JSON_PATH}`);
}

export default parseTopics;