const fs = require('fs');
const path = require('path');
const EXAMPLES = {
    mist: { folder: '霧港十三夜', entry: '主程式.ink' },
    bookshop: { folder: '雨天書店', entry: '主程式.ink' },
    translation: { folder: 'translation-practice', entry: 'practice.ink' }
};
function createExampleCopy(id, userData, sourceRoot = path.join(__dirname, '../examples')) {
    const sample = EXAMPLES[id];
    if (!sample) throw new Error('Unknown example');
    const source = path.join(sourceRoot, sample.folder);
    const target = path.join(userData, 'examples', sample.folder);
    fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(source)) {
        const destination = path.join(target, name);
        if (!fs.existsSync(destination)) fs.copyFileSync(path.join(source, name), destination);
    }
    return path.join(target, sample.entry);
}
module.exports = { createExampleCopy };
