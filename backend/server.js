import express from 'express';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

let db;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

async function startServer() {
    try {
        db = await open({
            filename: path.join(__dirname, 'data/reizen.db'),
            driver: sqlite3.Database
        });
        console.log("✅ Database verbonden.");
        app.listen(PORT, () => {
            console.log(`🚀 BusPlanner draait op http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("❌ Database fout:", err);
    }
}
startServer();

// --- API ROUTES ---

app.get('/api/suggesties/:zoekterm', async (req, res) => {
    try {
        const term = `%${req.params.zoekterm}%`;
        let query = `SELECT stop_name FROM stops WHERE stop_name LIKE ? GROUP BY stop_name LIMIT 10`;
        const resultaten = await db.all(query, [term]);
        res.json(resultaten);
    } catch (err) {
        res.status(500).json([]);
    }
});

app.get('/api/plan', async (req, res) => {
    const { fromName, toName, inputTime } = req.query;
    try {
        const nu = new Date();
        const datumVandaag = `${nu.getFullYear()}${String(nu.getMonth() + 1).padStart(2, '0')}${String(nu.getDate()).padStart(2, '0')}`;
        let planTijd = inputTime || nu.toLocaleTimeString('nl-NL', { hour12: false });
        if (planTijd.length === 5) planTijd += ":00";

        console.log(`\n==========================================`);
        console.log(`🚀 NIEUWE REISPLANNING`);
        console.log(`📍 VAN:  ${fromName}`);
        console.log(`🏁 NAAR: ${toName}`);
        console.log(`🕒 TIJD: ${planTijd} | DATUM: ${datumVandaag}`);
        console.log(`==========================================`);

        let alleReisadviezen = [];

        // 1. DIRECTE RITTEN
        const directeRitten = await db.all(`
            SELECT r.route_short_name AS lijn1, st_van.arrival_time AS vertrek1,
                   st_naar.arrival_time AS aankomst_eind, t.trip_headsign AS richting
            FROM stop_times st_van
            JOIN stops s_van ON st_van.stop_id = s_van.stop_id
            JOIN trips t ON st_van.trip_id = t.trip_id
            JOIN calendar c ON t.service_id = c.service_id
            JOIN routes r ON t.route_id = r.route_id
            JOIN stop_times st_naar ON t.trip_id = st_naar.trip_id
            JOIN stops s_naar ON st_naar.stop_id = s_naar.stop_id
            WHERE s_van.stop_name = ? AND s_naar.stop_name = ?
              AND c.date = ? AND st_van.arrival_time >= ?
              AND st_van.stop_sequence < st_naar.stop_sequence
            ORDER BY st_van.arrival_time ASC LIMIT 5`, [fromName, toName, datumVandaag, planTijd]);

        if (directeRitten.length > 0) {
            console.log(`✅ ${directeRitten.length} directe ritten gevonden.`);
            directeRitten.forEach(rit => alleReisadviezen.push({ ...rit, isOverstap: false }));
        }

        // 2. OVERSTAPPEN (Stap 2)
        console.log(`🔍 Stap 2: Zoeken naar eerste bussen vanaf "${fromName}"...`);
        const eersteRitten = await db.all(`
            SELECT DISTINCT r.route_short_name AS lijn1, st_over.arrival_time AS aankomst_over, 
                   s_over.stop_name AS overstapHalte, st_van.arrival_time AS vertrek1, t.trip_id
            FROM stop_times st_van
            JOIN stops s_van ON st_van.stop_id = s_van.stop_id
            JOIN trips t ON st_van.trip_id = t.trip_id
            JOIN calendar c ON t.service_id = c.service_id
            JOIN routes r ON t.route_id = r.route_id
            JOIN stop_times st_over ON t.trip_id = st_over.trip_id
            JOIN stops s_over ON st_over.stop_id = s_over.stop_id
            WHERE s_van.stop_name = ? AND c.date = ? AND st_van.arrival_time >= ?
              AND st_over.stop_sequence > st_van.stop_sequence
              AND s_over.stop_name != ?
            ORDER BY st_van.arrival_time ASC LIMIT 100`, [fromName, datumVandaag, planTijd, toName]);

        if (eersteRitten.length > 0) {
            console.log(`📍 ${eersteRitten.length} mogelijke eerste etappes gevonden.`);

            for (const rit of eersteRitten) {
                const aansluiting = await db.get(`
                    SELECT r.route_short_name AS lijn2, st_over.arrival_time AS vertrek_over, 
                           st_naar.arrival_time AS aankomst_eind, t.trip_headsign AS richting, t.trip_id AS trip2
                    FROM stop_times st_over
                    JOIN stops s_over ON st_over.stop_id = s_over.stop_id
                    JOIN trips t ON st_over.trip_id = t.trip_id
                    JOIN calendar c ON t.service_id = c.service_id
                    JOIN routes r ON t.route_id = r.route_id
                    JOIN stop_times st_naar ON t.trip_id = st_naar.trip_id
                    JOIN stops s_naar ON st_naar.stop_id = s_naar.stop_id
                    WHERE s_over.stop_name = ? AND s_naar.stop_name = ? AND c.date = ?
                      AND st_over.arrival_time >= ? 
                      AND st_over.arrival_time < time(?, '+120 minutes')
                      AND st_over.stop_sequence < st_naar.stop_sequence
                    ORDER BY st_over.arrival_time ASC LIMIT 1`,
                    [rit.overstapHalte, toName, datumVandaag, rit.aankomst_over, rit.aankomst_over]);

                // Alleen toevoegen als het een andere rit is (geen overstap op jezelf)
                if (aansluiting && rit.trip_id !== aansluiting.trip2) {
                    const bestaatAl = alleReisadviezen.find(a =>
                        a.vertrek1 === rit.vertrek1 && a.aankomst_eind === aansluiting.aankomst_eind
                    );

                    if (!bestaatAl) {
                        console.log(`   ✨ Aansluiting: ${rit.lijn1} (${rit.vertrek1}) ➔ ${aansluiting.lijn2} (${aansluiting.vertrek_over}) via ${rit.overstapHalte}`);
                        alleReisadviezen.push({
                            lijn1: rit.lijn1, vertrek1: rit.vertrek1,
                            overstapHalte: rit.overstapHalte, aankomst_over: rit.aankomst_over,
                            lijn2: aansluiting.lijn2, vertrek_over: aansluiting.vertrek_over,
                            aankomst_eind: aansluiting.aankomst_eind, richting: aansluiting.richting,
                            isOverstap: true
                        });
                    }
                }
                if (alleReisadviezen.length >= 12) break;
            }
        }

        console.log(`🏁 Planning voltooid. ${alleReisadviezen.length} adviezen naar frontend.`);
        res.json(alleReisadviezen.sort((a, b) => a.vertrek1.localeCompare(b.vertrek1)));
    } catch (err) {
        console.error("❌ Planfout:", err);
        res.status(500).json([]);
    }
});

app.get('/api/rit-details/:lijn/:vertrekTijd', async (req, res) => {
    const { lijn, vertrekTijd } = req.params;
    const nu = new Date();
    const datumVandaag = `${nu.getFullYear()}${String(nu.getMonth() + 1).padStart(2, '0')}${String(nu.getDate()).padStart(2, '0')}`;

    try {
        const stops = await db.all(`
            SELECT s.stop_name, st.arrival_time
            FROM stop_times st
            JOIN stops s ON st.stop_id = s.stop_id
            JOIN trips t ON st.trip_id = t.trip_id
            JOIN routes r ON t.route_id = r.route_id
            JOIN calendar c ON t.service_id = c.service_id
            WHERE r.route_short_name = ? 
              AND c.date = ?
              AND t.trip_id IN (SELECT trip_id FROM stop_times WHERE arrival_time = ?)
            ORDER BY st.stop_sequence ASC`, [lijn, datumVandaag, vertrekTijd]);

        res.json(stops);
    } catch (err) {
        res.status(500).json([]);
    }
});

import fs from 'fs/promises'; // We gebruiken de promise-versie voor schonere code

// --- HISTORIE API ---

// 1. Rit OPSLAAN in historie.json
app.post('/api/historie', async (req, res) => {
    const nieuweRit = req.body;
    // We slaan het op in de map 'data' naast je database
    const filePath = path.join(__dirname, 'data/historie.json');

    try {
        let json = { ritten: [], week_doel: 40, totaal_doel: 52 };

        try {
            const data = await fs.readFile(filePath, 'utf8');
            json = JSON.parse(data);
        } catch (readErr) {
            console.log("ℹ️ Geen bestaande historie gevonden, nieuwe wordt aangemaakt.");
        }

        json.ritten.push(nieuweRit);
        await fs.writeFile(filePath, JSON.stringify(json, null, 2));

        res.json({ message: "Rit opgeslagen in JSON!" });
    } catch (err) {
        console.error("❌ Opslaan mislukt:", err);
        res.status(500).json({ error: "Fout bij opslaan" });
    }
});

// 2. Historie OPHALEN voor de Tracker
app.get('/api/historie', async (req, res) => {
    const filePath = path.join(__dirname, 'data/historie.json');
    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        // Als bestand niet bestaat, sturen we een lege basisstructuur
        res.json({ ritten: [], week_doel: 40, totaal_doel: 52 });
    }
});

// 3. Rit VERWIJDEREN uit historie.json
app.delete('/api/historie/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const filePath = path.join(__dirname, 'data/historie.json');

    try {
        const data = await fs.readFile(filePath, 'utf8');
        let json = JSON.parse(data);

        // Filter de rit eruit
        json.ritten = json.ritten.filter(rit => rit.id !== id);

        await fs.writeFile(filePath, JSON.stringify(json, null, 2));
        res.json({ message: "Rit verwijderd!" });
    } catch (err) {
        console.error("Fout bij verwijderen:", err);
        res.status(500).json({ error: "Verwijderen mislukt" });
    }
});