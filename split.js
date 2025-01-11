import fs from 'fs';

const filePath = './data/messages.json'; // Укажите путь к вашему JSON

async function splitComplexJsonFile(filePath, parts) {
    try {
        // Читаем файл
        const data = await fs.promises.readFile(filePath, 'utf8');

        // Парсим JSON
        const jsonData = JSON.parse(data);

        // Собираем все сообщения в один массив
        const allMessages = [];

        for (const key in jsonData) {
            const nestedData = jsonData[key];

            // Если это массив, добавляем его элементы
            if (Array.isArray(nestedData)) {
                allMessages.push(...nestedData);
            } else {
                // Если это объект, ищем массив внутри
                for (const subKey in nestedData) {
                    if (Array.isArray(nestedData[subKey])) {
                        allMessages.push(...nestedData[subKey]);
                    }
                }
            }
        }

        // Проверяем, есть ли сообщения
        if (allMessages.length === 0) {
            throw new Error('Не удалось найти сообщения в структуре JSON.');
        }

        // Определяем размер каждой части
        const totalItems = allMessages.length;
        const partSize = Math.ceil(totalItems / parts);

        // Разделяем на части
        for (let i = 0; i < parts; i++) {
            const start = i * partSize;
            const end = start + partSize;

            // Получаем текущую часть
            const jsonPart = allMessages.slice(start, end);

            // Сохраняем часть в отдельный файл
            const outputFilePath = `./data/messages/part_${i + 1}.json`;
            await fs.promises.writeFile(outputFilePath, JSON.stringify(jsonPart, null, 2), 'utf8');
            console.log(`Часть ${i + 1} сохранена в файл ${outputFilePath}`);
        }

        console.log('Разделение завершено.');
    } catch (err) {
        console.error('Ошибка:', err);
    }
}

splitComplexJsonFile(filePath, 10);
