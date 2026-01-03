const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

const HISTORY_PATH = path.join(__dirname, 'data/historie.json');
const DB_PATH = path.join(__dirname, 'data/reizen.db');

// Hulpfunctie om de database te openen
async function openDb() {
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

// Initialisatie van mappen
async function init() {
    await fs.ensureDir(path.join(__dirname, 'data'));
    if (!await fs.pathExists(HISTORY_PATH)) {
        await fs.outputJson(HISTORY_PATH, []);
    }
}
init();

// --- API ROUTES VOOR 40/52 DOEL ---
app.get('/api/stats', async (req, res) => {
    try {
        const history = await fs.readJson(HISTORY_PATH);
        const doel = 40; // Jouw doel van 40 weken
        const aantal = history.length;
        const percentage = Math.min(Math.round((aantal / doel) * 100), 100);

        res.json({
            percentage: percentage,
            message: `${aantal} van de ${doel} weken afgevinkt (${percentage}%)`
        });
    } catch (err) {
        res.status(500).json({ error: "Kon stats niet laden" });
    }
});

app.post('/api/checkin', async (req, res) => {
    const history = await fs.readJson(HISTORY_PATH);
    const today = new Date();

    // Weeknummer berekening (ISO)
    const target = new Date(today.valueOf());
    const dayNr = (today.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
    const year = today.getFullYear();

    const alreadyExists = history.some(e => e.week === weekNumber && e.year === year);
    if (alreadyExists) {
        return res.status(400).json({ message: "Deze week is al geregistreerd!" });
    }

    history.push({ week: weekNumber, year: year, date: today });
    await fs.writeJson(HISTORY_PATH, history);
    res.json({ message: `Succes! Week ${weekNumber} staat erin.`, count: history.length });
});

// --- API ROUTES VOOR DE REISPLANNER (GTFS) ---

// Zoek alle haltes van een specifieke lijn (bijv. 385)
app.get('/api/lijn/:nummer', async (req, res) => {
    try {
        const db = await openDb();
        const lijn = req.params.nummer;

        const haltes = await db.all(`
            SELECT DISTINCT stop_name, MIN(stops.stop_id) as stop_id
            FROM stops
            JOIN stop_times ON stops.stop_id = stop_times.stop_id
            JOIN trips ON stop_times.trip_id = trips.trip_id
            JOIN routes ON trips.route_id = routes.route_id
            WHERE routes.route_short_name = ? 
            AND routes.agency_id = 'CXX'
            GROUP BY stop_name
            ORDER BY stop_name ASC
        `, [lijn]);

        res.json(haltes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DE NIEUWE SLIMME PLANNER ROUTE ---
app.get('/api/plan', async (req, res) => {
    try {
        const db = await openDb();
        const { fromName, toName } = req.query; // We gaan nu zoeken op naam
        const nu = new Date().toLocaleTimeString('nl-NL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const ritten = await db.all(`
            SELECT 
                s_van.arrival_time AS vertrektijd,
                s_naar.arrival_time AS aankomsttijd,
                trips.trip_headsign,
                routes.route_short_name
            FROM stop_times AS s_van
            JOIN stops AS stops_van ON s_van.stop_id = stops_van.stop_id
            JOIN stop_times AS s_naar ON s_van.trip_id = s_naar.trip_id
            JOIN stops AS stops_naar ON s_naar.stop_id = stops_naar.stop_id
            JOIN trips ON s_van.trip_id = trips.trip_id
            JOIN routes ON trips.route_id = routes.route_id
            WHERE stops_van.stop_name = ? 
              AND stops_naar.stop_name = ?
              AND s_van.stop_sequence < s_naar.stop_sequence
              AND s_van.arrival_time > ?
            GROUP BY s_van.arrival_time, routes.route_short_name
            ORDER BY s_van.arrival_time ASC
            LIMIT 5
        `, [fromName, toName, nu]);

        res.json(ritten);
    } catch (err) {
        res.status(500).json({ error: "Fout bij plannen" });
    }
});

app.listen(PORT, () => console.log(`BusPlanner draait op http://localhost:${PORT}`));

// Haal de eerstvolgende 5 bussen op voor een specifieke halte
app.get('/api/vertrektijden/:stop_id', async (req, res) => {
    try {
        const db = await openDb();
        const stopId = req.params.stop_id;

        // We pakken de tijd van NU (bijv. 21:35:00)
        const nu = new Date().toLocaleTimeString('nl-NL', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const tijden = await db.all(`
            SELECT DISTINCT arrival_time, trips.trip_headsign, routes.route_short_name
            FROM stop_times
            JOIN trips ON stop_times.trip_id = trips.trip_id
            JOIN routes ON trips.route_id = routes.route_id
            WHERE stop_times.stop_id = ? 
            AND stop_times.arrival_time > ?
            GROUP BY arrival_time, trip_headsign -- Dit haalt exact dezelfde tijden voor dezelfde bus weg
            ORDER BY stop_times.arrival_time ASC
            LIMIT 5
        `, [stopId, nu]);

        res.json(tijden);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const axios = require('axios'); // Je moet 'npm install axios' doen in de terminal

app.get('/api/live/:stop_id', async (req, res) => {
    try {
        const stopId = req.params.stop_id;
        // We gebruiken de OVapi interface, die koppelt direct met de bussen
        const response = await axios.get(`https://v0.ovapi.nl/stopareacode/${stopId}`);

        // De data van OVapi is erg diep genest, we filteren de relevante ritten eruit
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: "Kon live data niet ophalen" });
    }
});

// Zoek suggesties voor haltenamen (voor de Van/Naar velden)
app.get('/api/suggesties/:zoekterm', async (req, res) => {
    const start = Date.now();
    try {
        const db = await openDb();
        const term = `%${req.params.zoekterm}%`;

        const resultaten = await db.all(`
            SELECT stop_name, MIN(s.stop_id) as stop_id
            FROM stops s
            JOIN stop_times st ON s.stop_id = st.stop_id
            JOIN trips t ON st.trip_id = t.trip_id
            JOIN routes r ON t.route_id = r.route_id
            WHERE s.stop_name LIKE ? 
              AND r.agency_id = 'CXX'
            GROUP BY stop_name
            ORDER BY stop_name ASC
            LIMIT 10
        `, [term]);

        console.log(`[DB] Zoekopdracht "${req.params.zoekterm}" duurde ${Date.now() - start}ms`);
        res.json(resultaten);
    } catch (err) {
        console.error(`[DB FOUT] ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});