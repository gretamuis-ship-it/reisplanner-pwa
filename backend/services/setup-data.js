import { downloadGTFS } from './gtfs-import.js';
import { processGTFS } from './gtfs-filter.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSetup() {
    try {
        await downloadGTFS();
        await processGTFS();

        console.log("Opschonen...");
        const zipPath = path.join(__dirname, '../data/gtfs.zip');
        if (await fs.pathExists(zipPath)) {
            await fs.remove(zipPath);
        }

        console.log("Klaar! De database in backend/data/ is gevuld.");
    } catch (err) {
        console.error("Fout tijdens setup:", err);
    }
}

runSetup();