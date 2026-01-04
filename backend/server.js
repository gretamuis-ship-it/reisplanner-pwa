const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const axios = require('axios');
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

const HISTORY_PATH = path.join(__dirname, 'data/historie.json');
const DB_PATH = path.join(__dirname, 'data/reizen.db');
const CSV_PATH = path.join(__dirname, 'data/data.csv');

// Hulpfunctie om de database te openen
async function openDb() {
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

// Hulpfunctie om dienst-info uit CSV te halen op basis van omloop
async function haalDienstInfo(omloopNummer) {
    return new Promise((resolve) => {
        const resultaten = [];
        if (!fs.existsSync(CSV_PATH)) return resolve(null);

        fs.createReadStream(CSV_PATH)
            .pipe(csv({ separator: ';' }))
            .on('data', (data) => resultaten.push(data))
            .on('end', () => {
                const info = resultaten.find(r => r.Omloop === omloopNummer);
                resolve(info || null);
            });
    });
}

// Initialisatie van mappen en database indexen
async function init() {
    await fs.ensureDir(path.join(__dirname, 'data'));
    if (!await fs.pathExists(HISTORY_PATH)) {
        await fs.outputJson(HISTORY_PATH, []);
    }

    try {
        const db = await openDb();
        console.log("Database indexen controleren...");
        await db.exec('CREATE INDEX IF NOT EXISTS idx_stops_name ON stops(stop_name)');
        await db.exec('CREATE INDEX IF NOT EXISTS idx_st_trip ON stop_times(trip_id)');
        await db.exec('CREATE INDEX IF NOT EXISTS idx_st_stop ON stop_times(stop_id)');
        console.log("✅ Alle database indexen zijn gereed.");
        await db.close();
    } catch (err) {
        console.error("❌ Fout bij database optimalisatie:", err);
    }
}
init();

// --- API ROUTES ---

// De Slimme Planner met Overstap en Chauffeursinfo
app.get('/api/plan', async (req, res) => {
    const { fromName, toName, inputTime, mode } = req.query; // mode = 'DEPART' of 'ARRIVE'
    let db;
    try {
        db = await openDb();

        // 1. Bepaal de dag van de week (bijv. 'monday')
        const dagen = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const vandaag = dagen[new Date().getDay()];

        // 2. Gebruik de gekozen tijd of de tijd van NU
        const planTijd = inputTime || new Date().toLocaleTimeString('nl-NL', { hour12: false });

        // We voegen een JOIN met 'trips' en 'calendar' toe om alleen ritten van VANDAAG te zien
        const dagFilter = `AND c.${vandaag} = 1`;
        const tijdFilter = mode === 'ARRIVE'
            ? `AND st_naar.arrival_time < ? ORDER BY st_naar.arrival_time DESC`
            : `AND st_van.arrival_time > ? ORDER BY st_van.arrival_time ASC`;

        const query = `
            SELECT 
                r.route_short_name AS lijn1,
                st_van.arrival_time AS vertrek1,
                st_naar.arrival_time AS aankomst_eind,
                0 AS overstappen
            FROM stop_times st_van
            JOIN trips t ON st_van.trip_id = t.trip_id
            JOIN calendar c ON t.service_id = c.service_id
            JOIN routes r ON t.route_id = r.route_id
            JOIN stop_times st_naar ON st_van.trip_id = st_naar.trip_id
            JOIN stops s_van ON st_van.stop_id = s_van.stop_id
            JOIN stops s_naar ON st_naar.stop_id = s_naar.stop_id
            WHERE s_van.stop_name = ? 
              AND s_naar.stop_name = ?
              AND st_van.stop_sequence < st_naar.stop_sequence
              ${dagFilter}
              ${tijdFilter}
            LIMIT 5
        `;

        const ritten = await db.all(query, [fromName, toName, planTijd]);
        res.json(ritten);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (db) await db.close();
    }
});

// Suggesties voor haltenamen
app.get('/api/suggesties/:zoekterm', async (req, res) => {
    let db;
    try {
        db = await openDb();
        const term = `%${req.params.zoekterm}%`;
        const resultaten = await db.all(`
            SELECT stop_name, MIN(stop_id) as stop_id
            FROM stops
            WHERE stop_name LIKE ?
            GROUP BY stop_name
            ORDER BY 
                CASE 
                    WHEN stop_name LIKE 'Julianapark%' THEN 1 
                    WHEN stop_name LIKE 'Station Haarlem%' THEN 2
                    WHEN stop_name LIKE 'Zeewijkplein%' THEN 3
                    ELSE 4 
                END, stop_name ASC
            LIMIT 10
        `, [term]);
        res.json(resultaten || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (db) await db.close();
    }
});

// Stats en Checkin (40/52 doel)
app.get('/api/stats', async (req, res) => {
    const history = await fs.readJson(HISTORY_PATH);
    const doel = 40;
    const aantal = history.length;
    res.json({ percentage: Math.min(Math.round((aantal / doel) * 100), 100), count: aantal });
});

app.post('/api/checkin', async (req, res) => {
    const history = await fs.readJson(HISTORY_PATH);
    history.push({ date: new Date() });
    await fs.writeJson(HISTORY_PATH, history);
    res.json({ message: "Ingecheckt!" });
});

app.listen(PORT, () => console.log(`🚀 BusPlanner draait op http://localhost:${PORT}`));