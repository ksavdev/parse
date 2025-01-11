import fs from 'fs-extra';
import puppeteer from 'puppeteer';

const LINKS_JSON_PATH = './data/links.json';
const TOPICS_JSON_PATH = './data/topics.json';

async function parseTopics() {
    console.log(`[${new Date().toISOString()}] >>> Проверяем наличие файла ${LINKS_JSON_PATH}`);
    if (!await fs.pathExists(LINKS_JSON_PATH)) {
        throw new Error(`Файл ${LINKS_JSON_PATH} не найден.`);
    }

    const links = await fs.readJson(LINKS_JSON_PATH);
    let existingTopics = [];
    if (await fs.pathExists(TOPICS_JSON_PATH)) {
        existingTopics = await fs.readJson(TOPICS_JSON_PATH);
        console.log(`[${new Date().toISOString()}] >>> Загружены существующие темы.`);
    }

    console.log(`[${new Date().toISOString()}] >>> Запуск браузера Puppeteer.`);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Словарь для преобразования русскоязычных месяцев в числовой формат
    const months = {
        'января': '01',
        'февраля': '02',
        'марта': '03',
        'апреля': '04',
        'мая': '05',
        'июня': '06',
        'июля': '07',
        'августа': '08',
        'сентября': '09',
        'октября': '10',
        'ноября': '11',
        'декабря': '12',
    };

    // Функция для форматирования даты
    const formatDate = (rawDate) => {
        const [day, month, year] = rawDate.split(' ');
        return `${day.padStart(2, '0')}.${months[month]}.${year}`;
    };

    let totalTopics = 0;

    for (const url of links) {
        try {
            console.log(`[${new Date().toISOString()}] >>> Переход на страницу: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2' });

            const topics = await page.evaluate((months) => {
                const formatDate = (rawDate) => {
                    const [day, month, year] = rawDate.split(' ');
                    return `${day.padStart(2, '0')}.${months[month]}.${year}`;
                };

                return Array.from(document.querySelectorAll('ul.b-list-topics > li')).map(el => {
                    const titleElement = el.querySelector('.topictitle');
                    const dateElement = el.querySelector('.link-getlast[title]');

                    const rawDate = dateElement?.getAttribute('title');
                    const formattedDate = rawDate ? formatDate(rawDate.split(' ')[0] + ' ' + rawDate.split(' ')[1] + ' ' + rawDate.split(' ')[2]) : null;

                    return {
                        title: titleElement?.textContent.trim(),
                        link: titleElement ? new URL(titleElement.href, document.baseURI).href : null,
                        date: formattedDate, // Форматированная дата
                    };
                }).filter(topic => topic.title && topic.link && topic.date);
            }, months);

            for (const topic of topics) {
                if (!existingTopics.some(t => t.link === topic.link)) {
                    existingTopics.push(topic);
                    totalTopics++;
                    console.log(`[${new Date().toISOString()}] >>> Добавлена тема: ${topic.title}`);
                    await fs.outputJson(TOPICS_JSON_PATH, existingTopics, { spaces: 2 });
                }
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] >>> Ошибка при обработке страницы: ${url}`, error);
        }
    }

    console.log(`[${new Date().toISOString()}] >>> Всего собрано тем: ${totalTopics}`);
    console.log(`[${new Date().toISOString()}] >>> Закрытие браузера Puppeteer.`);
    await browser.close();

    return existingTopics;
}

export default parseTopics;
