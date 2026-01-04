import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function processGTFS() {
    const configPath = path.join(__dirname, '../data/config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const rawPath = path.join(__dirname, '../data/gtfs-raw');

    const db = await open({
        filename: path.join(__dirname, '../data/reizen.db'),
        driver: sqlite3.Database
    });

    console.log("Database geopend voor kalender-update...");

    /* --- ALLES HIERONDER IS TIJDELIJK UITGEZET OM TIJD TE BESPAREN ---
    await db.exec(`
        DROP TABLE IF EXISTS routes;
        DROP TABLE IF EXISTS stops;
        DROP TABLE IF EXISTS stop_times;
        DROP TABLE IF EXISTS trips;
        
        CREATE TABLE routes (route_id TEXT, route_short_name TEXT, agency_id TEXT);
        CREATE TABLE stops (stop_id TEXT, stop_name TEXT, stop_lat REAL, stop_lon REAL);
        CREATE TABLE stop_times (trip_id TEXT, arrival_time TEXT, stop_id TEXT, stop_sequence INTEGER);
        CREATE TABLE trips (trip_id TEXT, route_id TEXT, trip_headsign TEXT);
    `);

    // 1. Routes
    const routesContent = fs.readFileSync(path.join(rawPath, 'routes.txt'), 'utf8');
    const allRoutes = parse(routesContent, { columns: true, skip_empty_lines: true });
    for await (const r of allRoutes) {
        if (config.relevant_lines.includes(r.route_short_name)) {
            await db.run('INSERT INTO routes VALUES (?, ?, ?)', [r.route_id, r.route_short_name, r.agency_id]);
        }
    }

    // 2. Trips
    console.log("Trips inladen...");
    const tripsParser = fs.createReadStream(path.join(rawPath, 'trips.txt')).pipe(parse({ columns: true }));
    await db.run('BEGIN TRANSACTION');
    for await (const t of tripsParser) {
        await db.run('INSERT INTO trips VALUES (?, ?, ?)', [t.trip_id, t.route_id, t.trip_headsign]);
    }
    await db.run('COMMIT');

    // 3. Stop Times
    console.log("Stop tijden verwerken...");
    const parser = fs.createReadStream(path.join(rawPath, 'stop_times.txt')).pipe(parse({ columns: true }));
    await db.run('BEGIN TRANSACTION');
    let count = 0;
    for await (const st of parser) {
        await db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?)', [st.trip_id, st.arrival_time, st.stop_id, st.stop_sequence]);
        count++;
        if (count % 100000 === 0) console.log(`${count} regels verwerkt...`);
    }
    await db.run('COMMIT');

    // 4. Haltes
    console.log("Haltes inladen...");
    const stopsParser = fs.createReadStream(path.join(rawPath, 'stops.txt')).pipe(parse({ columns: true }));
    for await (const s of stopsParser) {
        await db.run('INSERT INTO stops VALUES (?, ?, ?, ?)', [s.stop_id, s.stop_name, s.stop_lat, s.stop_lon]);
    }
    --- EINDE VAN DE OVERSLAG --- */

    // 5. Kalender (Specifieke datums uit calendar_dates.txt)
    console.log("Kalender (calendar_dates) inladen...");

    await db.exec(`
        DROP TABLE IF EXISTS calendar;
        CREATE TABLE calendar (
            service_id TEXT, 
            date TEXT, 
            exception_type INTEGER
        );
    `);

    const calendarPath = path.join(rawPath, 'calendar_dates.txt');

    if (!fs.existsSync(calendarPath)) {
        console.error("FOUT: calendar_dates.txt niet gevonden!");
        await db.close();
        return;
    }

    const calendarParser = fs.createReadStream(calendarPath).pipe(parse({ columns: true }));

    await db.run('BEGIN TRANSACTION');
    for await (const c of calendarParser) {
        await db.run('INSERT INTO calendar (service_id, date, exception_type) VALUES (?, ?, ?)',
            [c.service_id, c.date, c.exception_type]);
    }
    await db.run('COMMIT');

    await db.close();
    console.log("Klaar! De kalender is nu ook toegevoegd.");
}