import fs from 'fs';
import path from 'path';
import natural from 'natural';
import stopword from 'stopword';
import fetch from 'node-fetch';

// Путь к JSON-файлам
const filePaths = [
    'data/messages/part_1.json',
    'data/messages/part_2.json',
    'data/messages/part_3.json',
    'data/messages/part_4.json',
    'data/messages/part_5.json',
    'data/messages/part_6.json',
    'data/messages/part_7.json',
    'data/messages/part_8.json',
    'data/messages/part_9.json',
    'data/messages/part_10.json'
];

// Токенизация и обработка текста
const processText = (text) => {
    // Удаление HTML-тегов, ссылок и чисел
    text = text.replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+/g, '').replace(/\d+/g, '');
    // Токенизация и удаление стоп-слов
    const tokenizer = new natural.WordTokenizer();
    const words = tokenizer.tokenize(text.toLowerCase());
    return stopword.removeStopwords(words);
};

// Удаление дубликатов и нерелевантных ключевых слов
const cleanKeywords = (keywords) => {
    const stopWords = ['и', 'на', 'во', 'обслуживание', '(значения)', '(экипировка)'];
    return [...new Set(keywords)].filter(word => !stopWords.includes(word));
};

// Расширение тем через Wikipedia API
const wikipediaApiUrl = 'https://ru.wikipedia.org/w/api.php';
async function fetchThemeKeywords(theme) {
    try {
        const response = await fetch(`${wikipediaApiUrl}?action=query&list=search&srsearch=${encodeURIComponent(theme)}&format=json`);
        const data = await response.json();
        const keywords = data.query.search.map(item => item.title.toLowerCase().split(' ')).flat();
        return cleanKeywords(keywords);
    } catch (error) {
        console.error(`Ошибка при запросе темы "${theme}":`, error);
        return [];
    }
}

// Расширение тем
async function loadThemeKeywords(initialThemes) {
    const themes = {};
    for (const theme of initialThemes) {
        const keywords = await fetchThemeKeywords(theme);
        themes[theme] = keywords;
        console.log(`Ключевые слова для темы "${theme}":`, keywords);
    }
    return themes;
}

// Основной процесс анализа
async function analyzeMessages() {
    const initialThemes = ['ремонт', 'путешествия', 'экипировка', 'мотоциклы'];
    const themes = await loadThemeKeywords(initialThemes);

    const themeFrequency = Object.keys(themes).reduce((acc, theme) => {
        acc[theme] = 0;
        return acc;
    }, {});

    // Чтение данных и обработка
    for (const filePath of filePaths) {
        const data = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf-8'));
        for (const message of data) {
            if (message.message_content) {
                const tokens = processText(message.message_content);
                for (const token of tokens) {
                    for (const [theme, keywords] of Object.entries(themes)) {
                        if (keywords.includes(token)) {
                            themeFrequency[theme]++;
                        }
                    }
                }
            }
        }
    }

    // Сохранение результатов
    saveResults(themeFrequency);
    console.log('Популярные темы:', themeFrequency);
}

// Сохранение результатов в файл
function saveResults(results) {
    fs.writeFileSync('theme_analysis.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('Результаты сохранены в theme_analysis.json');
}

// Запуск анализа
analyzeMessages();
