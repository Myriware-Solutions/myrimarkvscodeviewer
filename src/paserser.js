const fs = require('fs');
const { MyriMark } = require('./myrimark.js')
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const { window } = dom;
const document = window.document;

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
    const MyrimarkController = new MyriMark(document);
    return MyrimarkController.ParseMyriMark(rawData);
}

module.exports = { parseMwFile };
