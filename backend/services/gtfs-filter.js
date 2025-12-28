const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function processGTFS() {
    const config = await JSON.parse(fs.readFileSync(path.join(__dirname, '../data/config.json'), 'utf8'));
    const rawPath = path.join(__dirname, '../data/gtfs-raw');

    const db = await open({
        filename: path.join(__dirname, '../data/reizen.db'),
        driver: sqlite3.Database
    });

    console.log("Database structuur definitief opbouwen...");
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

    // 1. Routes (Lijnen)
    const routesContent = fs.readFileSync(path.join(rawPath, 'routes.txt'), 'utf8');
    const allRoutes = parse(routesContent, { columns: true, skip_empty_lines: true });
    for await (const r of allRoutes) {
        if (config.relevant_lines.includes(r.route_short_name)) {
            await db.run('INSERT INTO routes VALUES (?, ?, ?)', [r.route_id, r.route_short_name, r.agency_id]);
        }
    }

    // 2. Trips (De koppeling tussen lijn en tijd)
    console.log("Trips inladen...");
    const tripsParser = fs.createReadStream(path.join(rawPath, 'trips.txt')).pipe(parse({ columns: true }));
    await db.run('BEGIN TRANSACTION');
    for await (const t of tripsParser) {
        await db.run('INSERT INTO trips VALUES (?, ?, ?)', [t.trip_id, t.route_id, t.trip_headsign]);
    }
    await db.run('COMMIT');

    // 3. Stop Times (De tijden - het monsterbestand)
    console.log("Stop tijden verwerken (streamen)...");
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

    console.log("Klaar! Alles staat er nu echt in.");
}

module.exports = { processGTFS };