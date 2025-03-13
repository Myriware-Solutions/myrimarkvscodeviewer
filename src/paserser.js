const fs = require('fs');
const { MyriMark } = require('./myrimark.js')

/**
 * @param {fs.PathOrFileDescriptor} filePath
 */
function parseMwFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                const parsedData = processMwData(data);
                resolve(parsedData);
            }
        });
    });
}

/**
 * 
 * @param {string} rawData 
 * @returns {?HTMLDivElement}
 */
function processMwData(rawData) {
    return MyriMark.ParseMyriMark(rawData);
}

module.exports = { parseMwFile };
