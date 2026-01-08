const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(path.join(__dirname, '../reizen.db'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS dienstregeling (
        dienst TEXT,
        lijn TEXT,
        omloop TEXT,
        start_tijd TEXT,
        pakket TEXT,
        ma INTEGER, di INTEGER, wo INTEGER, do INTEGER, vr INTEGER, za INTEGER, zo INTEGER
    )`);

    db.run("DELETE FROM dienstregeling");

    const csvPath = path.join(__dirname, 'data/data.csv');

    fs.createReadStream(csvPath)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
            // Logica voor Dagtype vertaling
            const d = row.Dagtype.toLowerCase();
            const isMaDo = d === 'ma t/m do' || d === 'doordeweeks';
            const isVr = d === 'vrijdag' || d === 'doordeweeks';
            const isZa = d === 'zaterdag';
            const isZo = d === 'zondag';

            db.run(`INSERT INTO dienstregeling 
                (dienst, lijn, omloop, start_tijd, pakket, ma, di, wo, do, vr, za, zo) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.Dienst, row.Lijn, row.Omloop, row.Start, row.PakketType,
                    isMaDo ? 1 : 0, isMaDo ? 1 : 0, isMaDo ? 1 : 0, isMaDo ? 1 : 0, isVr ? 1 : 0, isZa ? 1 : 0, isZo ? 1 : 0
                ]
            );
        })
        .on('end', () => console.log('✅ Import voltooid!'));
});