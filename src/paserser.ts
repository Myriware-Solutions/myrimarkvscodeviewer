import fs from 'fs';
import { Myrimark } from './myrimark';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const { window } = dom;
const document = window.document;

/**
 * @param {fs.PathOrFileDescriptor} filePath
 * @returns {Promise<any>}
 */
export function parseMwFile(filePath:fs.PathOrFileDescriptor): Promise<any> {
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
function processMwData(rawData:string): HTMLDivElement|null {
    const MyrimarkController: Myrimark = new Myrimark(document);
    return MyrimarkController.ParseMyriMark(rawData);
}