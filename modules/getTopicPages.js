import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const TOPICS_JSON_PATH = './data/topics.json';
const TOPIC_PAGES_JSON_PATH = './data/topicPages.json';

async function getTopicPages() {
    console.log(`[${new Date().toISOString()}] >>> Проверяем наличие файла ${TOPICS_JSON_PATH}`);
    if (!await fs.pathExists(TOPICS_JSON_PATH)) {
        throw new Error(`Файл ${TOPICS_JSON_PATH} не найден.`);
    }

    const topics = await fs.readJson(TOPICS_JSON_PATH);
    let existingPages = {};
    if (await fs.pathExists(TOPIC_PAGES_JSON_PATH)) {
        existingPages = await fs.readJson(TOPIC_PAGES_JSON_PATH);
        console.log(`[${new Date().toISOString()}] >>> Загружены существующие страницы тем.`);
    }

    console.log(`[${new Date().toISOString()}] >>> Запуск браузера Puppeteer.`);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    let totalTopicPages = 0;

    for (const topic of topics) {
        if (existingPages[topic.link]) {
            console.log(`[${new Date().toISOString()}] >>> Пропуск уже обработанной темы: ${topic.title}`);
            continue;
        }

        try {
            console.log(`[${new Date().toISOString()}] >>> Переход на тему: ${topic.title}`);
            await page.goto(topic.link, { waitUntil: 'networkidle2' });

            const pages = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a[href*="viewtopic.php?"]'))
                    .map(el => new URL(el.href, document.baseURI).href);
            });

            existingPages[topic.link] = [...new Set(pages)];
            totalTopicPages += pages.length;
            console.log(`[${new Date().toISOString()}] >>> Добавлено ${pages.length} страниц для темы: ${topic.title}`);

            await fs.outputJson(TOPIC_PAGES_JSON_PATH, existingPages, { spaces: 2 });
        } catch (error) {
            console.error(`[${new Date().toISOString()}] >>> Ошибка при обработке темы: ${topic.title}`, error);
        }
    }

    console.log(`[${new Date().toISOString()}] >>> Всего собрано страниц тем: ${totalTopicPages}`);
    console.log(`[${new Date().toISOString()}] >>> Закрытие браузера Puppeteer.`);
    await browser.close();

    return existingPages;
}

export default getTopicPages;
