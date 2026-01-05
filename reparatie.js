import fs from 'fs';
import { parse } from 'csv-parse';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function groteSchoonmaak() {
    const db = await open({
        filename: './backend/data/reizen.db',
        driver: sqlite3.Database
    });

    console.log("🧹 Stap 1: Aanhalingstekens verwijderen uit haltenamen...");
    // Sommige GTFS-bestanden importeren namen als '"Halte Naam"'. Dit haalt die extra " weg.
    await db.run(`UPDATE stops SET stop_name = TRIM(stop_name, '"')`);
    await db.run(`UPDATE stops SET stop_name = TRIM(stop_name, "'")`);

    console.log("🛠 Stap 2: Transfers tabel voorbereiden...");
    await db.run(`DROP TABLE IF EXISTS transfers`);
    await db.run(`CREATE TABLE transfers (
        from_stop_id TEXT, 
        to_stop_id TEXT, 
        transfer_type INTEGER, 
        min_transfer_time INTEGER
    )`);

    const path = './backend/data/gtfs-raw/transfers.txt';
    if (fs.existsSync(path)) {
        console.log("🚀 Stap 3: Transfers inladen...");
        const parser = fs.createReadStream(path).pipe(parse({ columns: true }));
        await db.run('BEGIN TRANSACTION');
        for await (const t of parser) {
            await db.run('INSERT INTO transfers VALUES (?, ?, ?, ?)',
                [t.from_stop_id, t.to_stop_id, t.transfer_type, t.min_transfer_time]);
        }
        await db.run('COMMIT');
        console.log("✅ Transfers geladen!");
    } else {
        console.log("⚠️ Geen transfers.txt gevonden. We maken zelf een basis-koppeling...");
        // Als het bestand er niet is, koppelen we haltes met dezelfde naam aan elkaar
        await db.run(`
            INSERT INTO transfers (from_stop_id, to_stop_id, transfer_type, min_transfer_time)
            SELECT a.stop_id, b.stop_id, 2, 300
            FROM stops a JOIN stops b ON a.stop_name = b.stop_name
            WHERE a.stop_id != b.stop_id
        `);
        console.log("✅ Handmatige transfers aangemaakt op basis van haltenamen.");
    }

    await db.close();
    console.log("🏁 Alles klaar! Start je server en probeer IJmuiden -> Schalkwijk.");
}

groteSchoonmaak();