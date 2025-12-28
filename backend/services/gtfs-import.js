const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const unzipper = require('unzipper');

async function downloadGTFS() {
    const url = "https://gtfs.ovapi.nl/nl/gtfs-nl.zip";
    const outputPath = path.join(__dirname, '../data/gtfs.zip');
    const extractPath = path.join(__dirname, '../data/gtfs-raw');

    console.log("Start download van landelijke GTFS (ca. 200MB)...");

    try {
        const response = await axios({ url, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log("Download klaar. Uitpakken...");
                fs.createReadStream(outputPath)
                    .pipe(unzipper.Extract({ path: extractPath }))
                    .on('close', () => {
                        console.log("Uitgepakt in /data/gtfs-raw/");
                        resolve();
                    });
            });
            writer.on('error', reject);
        });
    } catch (error) {
        console.error("Fout bij downloaden:", error.message);
    }
}

module.exports = { downloadGTFS };