// Обновленный getPageLinks.js
import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const LINKS_JSON_PATH = './data/links.json';
const FORUM_URL = 'https://forum.onliner.by/viewforum.php?f=53';

async function getPageLinks() {
    // 1. Читаем уже собранные ссылки, если файл существует
    let existingLinks = [];
    if (await fs.pathExists(LINKS_JSON_PATH)) {
        existingLinks = await fs.readJson(LINKS_JSON_PATH);
        console.log(`Найдено ${existingLinks.length} уже собранных ссылок.`);
    }

    // 2. Запускаем Puppeteer
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // 3. Отключаем загрузку ненужных ресурсов для ускорения
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font'].includes(resourceType)) {
            req.abort();
        } else {
            req.continue();
        }
    });

    // 4. Переходим на страницу форума
    await page.goto(FORUM_URL, { waitUntil: 'networkidle2' });
    console.log(`Перешли на страницу форума: ${FORUM_URL}`);

    // 5. Проверяем наличие кнопки "exppages-ttl" и нажимаем её
    const expandButtonSelector = 'a.exppages-ttl';
    const expandButton = await page.$(expandButtonSelector);

    if (expandButton) {
        await expandButton.click();
        console.log('Кнопка "exppages-ttl" нажата для раскрытия дополнительных страниц.');

        // Ждём появления расширенной пагинации
        await page.waitForSelector('div.b-pages.active-droppages ul.pages-fastnav', { timeout: 5000 });
        console.log('Расширенная пагинация загружена.');
    } else {
        console.log('Кнопка "exppages-ttl" не найдена. Возможно, все страницы уже отображены.');
    }

    // 6. Извлекаем все ссылки на страницы пагинации
    const links = await page.evaluate(() => {
        const linkElements = document.querySelectorAll('div.b-pages a[href*="viewforum.php?f=53&start="]');
        const hrefs = [];

        linkElements.forEach(el => {
            const href = el.getAttribute('href');
            if (href && !href.includes('#')) { // Исключаем ссылки с '#'
                hrefs.push(new URL(href, 'https://forum.onliner.by').href);
            }
        });

        return hrefs;
    });

    // 7. Удаляем дубликаты ссылок и исключаем уже собранные
    const uniqueLinks = [...new Set(links)].filter(link => !existingLinks.includes(link));
    console.log(`Найдено ${uniqueLinks.length} новых уникальных ссылок.`);

    // 8. Сохраняем новые ссылки, объединяя с уже существующими
    const allLinks = [...existingLinks, ...uniqueLinks];
    await fs.outputJson(LINKS_JSON_PATH, allLinks, { spaces: 2 });
    console.log(`Собранные ссылки обновлены и сохранены в ${LINKS_JSON_PATH}`);

    // 9. Закрываем браузер
    await browser.close();
}

export default getPageLinks;
