// modules/getTopicPages.js
import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const TOPICS_JSON_PATH = './data/topics.json';
const TOPIC_PAGES_JSON_PATH = './data/topicPages.json';
const FORUM_BASE_URL = 'https://forum.onliner.by';

async function getTopicPages() {
    // 1. Проверяем наличие файла topics.json
    if (!await fs.pathExists(TOPICS_JSON_PATH)) {
        throw new Error(`Файл ${TOPICS_JSON_PATH} не найден.`);
    }

    // 2. Читаем подтемы из topics.json
    const topics = await fs.readJson(TOPICS_JSON_PATH);
    console.log(`Найдено ${topics.length} подтем для парсинга.`);

    const topicPages = {};

    // 3. Удаляем старый topicPages.json, если он существует
    if (await fs.pathExists(TOPIC_PAGES_JSON_PATH)) {
        await fs.remove(TOPIC_PAGES_JSON_PATH);
        console.log(`Старый файл ${TOPIC_PAGES_JSON_PATH} удалён.`);
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

    // 5. Устанавливаем User-Agent для избежания блокировок
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');

    // 6. Обработка каждой подтемы
    for (const [index, topic] of topics.entries()) {
        try {
            console.log(`Парсинг подтемы ${index + 1}/${topics.length}: ${topic.title}`);
            console.log(`Ссылка на подтему: ${topic.link}`);

            await page.goto(topic.link, { waitUntil: 'networkidle2' });

            // 7. Проверяем наличие кнопки "exppages-ttl" и нажимаем её
            const expandButtonSelector = 'a.exppages-ttl';
            const expandButton = await page.$(expandButtonSelector);

            if (expandButton) {
                await expandButton.click();
                console.log('Кнопка "exppages-ttl" нажата для раскрытия дополнительных страниц.');

                // Ждём появления расширенной пагинации
                await page.waitForSelector('div.b-pages.active-droppages ul.pages-fastnav, ul.pagesslider__ul', { timeout: 5000 });
                console.log('Расширенная пагинация загружена.');
            } else {
                console.log('Кнопка "exppages-ttl" не найдена. Возможно, все страницы уже отображены.');
            }

            // 8. Извлекаем все ссылки на страницы пагинации внутри подтемы
            const pages = await page.evaluate(() => {
                const hrefs = new Set();

                // Селектор для расширенной пагинации
                const extendedPaginationSelector = 'div.b-pages.active-droppages ul.pages-fastnav li a[href*="viewtopic.php?"]';
                const extendedLinks = document.querySelectorAll(extendedPaginationSelector);
                extendedLinks.forEach(el => {
                    const href = el.getAttribute('href');
                    if (href && !href.includes('#')) {
                        hrefs.add(new URL(href, 'https://forum.onliner.by').href);
                    }
                });

                // Селектор для pagesslider__ul
                const sliderPaginationSelector = 'ul.pagesslider__ul li a[href*="viewtopic.php?"]';
                const sliderLinks = document.querySelectorAll(sliderPaginationSelector);
                sliderLinks.forEach(el => {
                    const href = el.getAttribute('href');
                    if (href && !href.includes('#')) {
                        hrefs.add(new URL(href, 'https://forum.onliner.by').href);
                    }
                });

                return Array.from(hrefs);
            });

            // Если расширенной пагинации нет, предполагаем, что есть только одна страница
            let finalPages = [];
            if (pages.length > 0) {
                // Удаляем дубликаты
                finalPages = [...new Set(pages)];
                console.log(`Найдено ${finalPages.length} страниц в подтеме.`);
            } else {
                // Предполагаем, что есть только одна страница
                finalPages = [topic.link];
                console.log('Пагинация не найдена. Предполагается только одна страница.');
            }

            // Сохраняем ссылки на страницы подтемы
            topicPages[topic.link] = finalPages;

            // Задержка 1 секунда между запросами, чтобы не нагружать сервер
            await page.waitForTimeout ? await page.waitForTimeout(1000) : await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`Ошибка при парсинге подтемы ${topic.link}:`, error);
            // Можно записать ошибочные подтемы для последующего анализа
        }
    }

    await browser.close();

    // 9. Сохранение собранных данных в topicPages.json
    await fs.outputJson(TOPIC_PAGES_JSON_PATH, topicPages, { spaces: 2 });
    console.log(`Собранные данные сохранены в ${TOPIC_PAGES_JSON_PATH}`);
}

export default getTopicPages;
