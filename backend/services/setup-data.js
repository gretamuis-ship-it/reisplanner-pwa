const { downloadGTFS } = require('./gtfs-import');
const { processGTFS } = require('./gtfs-filter');
const fs = require('fs-extra');
const path = require('path');

async function runSetup() {
    try {
        // 1. Download en Pak uit (Landelijk)
        await downloadGTFS();

        // 2. Filter en zet om naar SQLite (Lokaal)
        await processGTFS();

        // 3. Opruimen: De grote ruwe bestanden verwijderen om ruimte te besparen op de Mac/Pi
        console.log("Opschonen van tijdelijke bestanden...");
        await fs.remove(path.join(__dirname, '../data/gtfs.zip'));
        // await fs.remove(path.join(__dirname, '../data/gtfs-raw')); // Optioneel: bewaar dit als je wilt debuggen

        console.log("Klaar! De database 'reizen.db' is gevuld en klaar voor gebruik.");
    } catch (err) {
        console.error("Er ging iets mis tijdens de setup:", err);
    }
}

runSetup();