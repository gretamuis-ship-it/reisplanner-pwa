import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import unzipper from 'unzipper';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function downloadGTFS() {
    const url = "https://gtfs.ovapi.nl/nl/gtfs-nl.zip";
    // We gaan één map omhoog naar /backend/ en dan naar /data/
    const dataDir = path.join(__dirname, '../data');
    const outputPath = path.join(dataDir, 'gtfs.zip');
    const extractPath = path.join(dataDir, 'gtfs-raw');

    await fs.ensureDir(dataDir);

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
                        console.log("Uitgepakt in backend/data/gtfs-raw/");
                        resolve();
                    });
            });
            writer.on('error', reject);
        });
    } catch (error) {
        console.error("Fout bij downloaden:", error.message);
    }
}