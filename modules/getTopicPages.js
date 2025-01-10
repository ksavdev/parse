import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const TOPICS_JSON_PATH = './data/topics.json';
const TOPIC_PAGES_JSON_PATH = './data/topicPages.json';

async function getTopicPages() {
    if (!await fs.pathExists(TOPICS_JSON_PATH)) {
        throw new Error(`Файл ${TOPICS_JSON_PATH} не найден.`);
    }

    const topics = await fs.readJson(TOPICS_JSON_PATH);
    console.log(`Найдено ${topics.length} подтем для парсинга.`);

    let existingPages = {};
    if (await fs.pathExists(TOPIC_PAGES_JSON_PATH)) {
        existingPages = await fs.readJson(TOPIC_PAGES_JSON_PATH);
        console.log(`Найдено ${Object.keys(existingPages).length} уже собранных страниц.`);
    }

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

    for (const [index, topic] of topics.entries()) {
        if (existingPages[topic.link]) {
            console.log(`Пропускаем уже собранные страницы подтемы: ${topic.title}`);
            continue;
        }

        try {
            console.log(`Парсинг подтемы ${index + 1}/${topics.length}: ${topic.title}`);

            await page.goto(topic.link, { waitUntil: 'networkidle2' });

            const expandButtonSelector = 'a.exppages-ttl';
            const expandButton = await page.$(expandButtonSelector);

            if (expandButton) {
                await expandButton.click();
                console.log('Кнопка "exppages-ttl" нажата для раскрытия дополнительных страниц.');

                await page.waitForSelector('div.b-pages.active-droppages ul.pages-fastnav, ul.pagesslider__ul', { timeout: 5000 });
            }

            const pages = await page.evaluate(() => {
                const hrefs = new Set();
                const extendedPaginationSelector = 'div.b-pages.active-droppages ul.pages-fastnav li a[href*="viewtopic.php?"]';
                const extendedLinks = document.querySelectorAll(extendedPaginationSelector);
                extendedLinks.forEach(el => {
                    const href = el.getAttribute('href');
                    if (href && !href.includes('#')) {
                        hrefs.add(new URL(href, 'https://forum.onliner.by').href);
                    }
                });
                return Array.from(hrefs);
            });

            const finalPages = pages.length > 0 ? [...new Set(pages)] : [topic.link];

            existingPages[topic.link] = finalPages;
            console.log(`Найдено ${finalPages.length} страниц в подтеме.`);
        } catch (error) {
            console.error(`Ошибка при парсинге подтемы ${topic.link}:`, error);
        }
    }

    await browser.close();

    await fs.outputJson(TOPIC_PAGES_JSON_PATH, existingPages, { spaces: 2 });
    console.log(`Собранные данные сохранены в ${TOPIC_PAGES_JSON_PATH}`);
}
export default getTopicPages;