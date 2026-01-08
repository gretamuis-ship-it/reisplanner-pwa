import express from 'express';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

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

// 1. Suggesties voor de zoekbalk
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

// 2. De Reisplanner Logica (met slimme overstap en zonder hardcoding)
app.get('/api/plan', async (req, res) => {
    const { fromName, toName, inputTime } = req.query;
    try {
        const nu = new Date();
        const datumVandaag = `${nu.getFullYear()}${String(nu.getMonth() + 1).padStart(2, '0')}${String(nu.getDate()).padStart(2, '0')}`;
        let planTijd = inputTime || nu.toLocaleTimeString('nl-NL', { hour12: false });
        if (planTijd.length === 5) planTijd += ":00";

        console.log(`\n-----------------------------------------`);
        console.log(`🔔 PLANNING: ${fromName} -> ${toName} om ${planTijd}`);
        console.log(`-----------------------------------------`);

        // We gebruiken LEFT JOIN agency zodat de rit wel getoond wordt, ook als de maatschappij niet in je lijstje staat
        const eersteRitten = await db.all(`
    SELECT DISTINCT 
        r.route_short_name AS lijn1, 
        r.route_color AS kleur1,
        r.route_text_color AS tekstKleur1,
        st_over.arrival_time AS aankomst_over, 
        s_over.stop_name AS overstapHalte,
        s_over.stop_lat, s_over.stop_lon,
        st_van.arrival_time AS vertrek1,
        t.trip_headsign AS richting1,
        a.agency_name AS maatschappij1
    FROM stop_times st_van
    JOIN stops s_van ON st_van.stop_id = s_van.stop_id
    JOIN trips t ON st_van.trip_id = t.trip_id
    JOIN calendar c ON t.service_id = c.service_id
    JOIN routes r ON t.route_id = r.route_id
    LEFT JOIN agency a ON r.agency_id = a.agency_id
    JOIN stop_times st_over ON t.trip_id = st_over.trip_id
    JOIN stops s_over ON st_over.stop_id = s_over.stop_id
    WHERE s_van.stop_name = ? 
      AND c.date = ? 
      AND st_van.arrival_time >= ?
      AND st_van.arrival_time < time(?, '+3 hours')
      AND st_over.stop_sequence > st_van.stop_sequence + 2
    ORDER BY st_van.arrival_time ASC LIMIT 1000`, [fromName, datumVandaag, planTijd, planTijd]);

        let alleOpties = [];

        for (const rit of eersteRitten) {
            const aansluitingen = await db.all(`
    SELECT 
        r.route_short_name AS lijn2, 
        r.route_color AS kleur2,
        r.route_text_color AS tekstKleur2,
        st_naar.arrival_time AS aankomst_eind,
        st_over.arrival_time AS vertrek_over, 
        t.trip_headsign AS richting2,
        a.agency_name AS maatschappij2
    FROM stop_times st_over
    JOIN stops s_over ON st_over.stop_id = s_over.stop_id
    JOIN trips t ON st_over.trip_id = t.trip_id
    JOIN routes r ON t.route_id = r.route_id
    LEFT JOIN agency a ON r.agency_id = a.agency_id
    JOIN calendar c ON t.service_id = c.service_id
    JOIN stop_times st_naar ON t.trip_id = st_naar.trip_id
    JOIN stops s_naar ON st_naar.stop_id = s_naar.stop_id
    WHERE s_over.stop_lat BETWEEN ? AND ?
      AND s_over.stop_lon BETWEEN ? AND ?
      AND s_naar.stop_name = ? 
      AND c.date = ?
      AND st_over.arrival_time >= time(?, '+3 minutes') 
      AND st_over.arrival_time < time(?, '+45 minutes')
      AND st_over.stop_sequence < st_naar.stop_sequence
    ORDER BY st_naar.arrival_time ASC LIMIT 3`,
                [rit.stop_lat - 0.002, rit.stop_lat + 0.002, rit.stop_lon - 0.002, rit.stop_lon + 0.002, toName, datumVandaag, rit.aankomst_over, rit.aankomst_over]);

            for (const a of aansluitingen) {
                let schoneHalte = rit.overstapHalte.replace(/ perron\s+[a-z0-9]+/gi, '').replace(/\s+[a-z]$/i, '').trim();

                // In server.js bij de alleOpties.push:
                alleOpties.push({
                    lijn1: rit.lijn1,
                    kleur1: rit.kleur1,           // Toevoegen
                    tekstKleur1: rit.tekstKleur1, // Toevoegen
                    vertrek1: rit.vertrek1,
                    richting1: rit.richting1,
                    maatschappij1: rit.maatschappij1 || 'Onbekend',
                    overstapHalte: schoneHalte,
                    aankomst_over: rit.aankomst_over,
                    lijn2: a.lijn2,
                    kleur2: a.kleur2,           // Toevoegen
                    tekstKleur2: a.tekstKleur2, // Toevoegen
                    vertrek_over: a.vertrek_over,
                    richting2: a.richting2,
                    maatschappij2: a.maatschappij2 || 'Onbekend',
                    aankomst_eind: a.aankomst_eind,
                    isOverstap: true
                });
            }
        }

        // Filter logica (Houdt de lijst schoon)
        let resultaat = [];
        alleOpties.sort((a, b) => a.aankomst_eind.localeCompare(b.aankomst_eind));
        for (const optie of alleOpties) {
            const alAdvies = resultaat.some(r => r.vertrek1 === optie.vertrek1 && r.lijn1 === optie.lijn1);
            const isNutteloosVroeg = alleOpties.some(andere => andere.vertrek1 > optie.vertrek1 && andere.aankomst_eind <= optie.aankomst_eind);
            if (!alAdvies && !isNutteloosVroeg) resultaat.push(optie);
        }
        resultaat.sort((a, b) => a.vertrek1.localeCompare(b.vertrek1));

        // Logs in Terminal
        resultaat.slice(0, 5).forEach(rit => {
            console.log(`[STAP] ${rit.maatschappij1} Lijn ${rit.lijn1} (${rit.richting1}) -> ${rit.maatschappij2} Lijn ${rit.lijn2} (${rit.richting2})`);
        });

        res.json(resultaat.slice(0, 10));
    } catch (err) {
        console.error("❌ Planfout:", err);
        res.status(500).json([]);
    }
});

// 3. Rit details ophalen (voor de lijst met alle haltes)
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
              AND t.trip_id = (
                  SELECT trip_id FROM stop_times 
                  WHERE arrival_time = ? 
                  LIMIT 1
              )
            ORDER BY st.stop_sequence ASC`, [lijn, datumVandaag, vertrekTijd]);

        res.json(stops);
    } catch (err) {
        console.error("❌ Details fout:", err);
        res.status(500).json([]);
    }
});

// --- HISTORIE API ---

app.post('/api/historie', async (req, res) => {
    const nieuweRit = req.body;
    const filePath = path.join(__dirname, 'data/historie.json');
    try {
        let json = { ritten: [], week_doel: 40, totaal_doel: 52 };
        try {
            const data = await fs.readFile(filePath, 'utf8');
            json = JSON.parse(data);
        } catch (readErr) { }
        json.ritten.push(nieuweRit);
        await fs.writeFile(filePath, JSON.stringify(json, null, 2));
        res.json({ message: "Rit opgeslagen!" });
    } catch (err) {
        res.status(500).json({ error: "Fout bij opslaan" });
    }
});

app.get('/api/historie', async (req, res) => {
    const filePath = path.join(__dirname, 'data/historie.json');
    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.json({ ritten: [], week_doel: 40, totaal_doel: 52 });
    }
});

app.delete('/api/historie/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const filePath = path.join(__dirname, 'data/historie.json');
    try {
        const data = await fs.readFile(filePath, 'utf8');
        let json = JSON.parse(data);
        json.ritten = json.ritten.filter(r => r.id !== id);
        await fs.writeFile(filePath, JSON.stringify(json, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).send("Fout bij verwijderen");
    }
});