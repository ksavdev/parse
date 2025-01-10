// modules/parseTopics.js
import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const LINKS_JSON_PATH = './data/links.json';
const TOPICS_JSON_PATH = './data/topics.json';

// Функция задержки
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function parseTopics() {
    // 1. Проверяем наличие файла links.json
    if (!await fs.pathExists(LINKS_JSON_PATH)) {
        throw new Error(`Файл ${LINKS_JSON_PATH} не найден.`);
    }

    // 2. Читаем ссылки из links.json
    const links = await fs.readJson(LINKS_JSON_PATH);
    console.log(`Найдено ${links.length} ссылок для парсинга.`);

    const allTopics = [];

    // 3. Удаляем старый topics.json, если он существует
    if (await fs.pathExists(TOPICS_JSON_PATH)) {
        await fs.remove(TOPICS_JSON_PATH);
        console.log(`Старый файл ${TOPICS_JSON_PATH} удалён.`);
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // 4. Оптимизация: отключаем загрузку ненужных ресурсов
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
        try {
            console.log(`Парсинг страницы ${index + 1}/${links.length}: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Ждём появления списка подтем
            await page.waitForSelector('ul.b-list-topics');

            // Извлекаем данные о подтемах
            const topics = await page.evaluate(() => {
                const topicElements = document.querySelectorAll('ul.b-list-topics > li');
                const extractedTopics = [];

                topicElements.forEach(el => {
                    // Извлекаем название темы
                    const titleElement = el.querySelector('div.b-lt-subj > h3 > a.topictitle');
                    const title = titleElement ? titleElement.innerText.trim() : null;

                    // Извлекаем ссылку на тему
                    const relativeLink = titleElement ? titleElement.getAttribute('href') : null;
                    const link = relativeLink ? new URL(relativeLink, 'https://forum.onliner.by').href : null;

                    // Извлекаем дату последнего сообщения
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

            // Задержка 1 секунда между запросами, чтобы не нагружать сервер
            await delay(1000);
        } catch (error) {
            console.error(`Ошибка при парсинге страницы ${url}:`, error);
            // Продолжаем с следующей страницей
        }
    }

    await browser.close();

    // 5. Удаляем дубликаты подтем на основе уникальных ссылок
    const uniqueTopics = [...new Map(allTopics.map(item => [item.link, item])).values()];
    console.log(`Всего собрано ${allTopics.length} подтем. После удаления дубликатов осталось ${uniqueTopics.length} уникальных подтем.`);

    // 6. Сохраняем собранные данные в topics.json
    await fs.outputJson(TOPICS_JSON_PATH, uniqueTopics, { spaces: 2 });
    console.log(`Собранные данные сохранены в ${TOPICS_JSON_PATH}`);
}

export default parseTopics;
