const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
// Dit zorgt dat de server je website laat zien als je naar localhost:3000 gaat
app.use(express.static(path.join(__dirname, '../frontend/public')));

const HISTORY_PATH = path.join(__dirname, 'data/historie.json');

// Maak de 'data' map aan als deze nog niet bestaat
async function init() {
    await fs.ensureDir(path.join(__dirname, 'data'));
    if (!await fs.pathExists(HISTORY_PATH)) {
        await fs.outputJson(HISTORY_PATH, []);
    }
}
init();

// Route om te kijken hoeveel weken je al hebt geregistreerd
app.get('/api/stats', async (req, res) => {
    const history = await fs.readJson(HISTORY_PATH);
    res.json(history);
});

// Route om een nieuwe week af te vinken
app.post('/api/checkin', async (req, res) => {
    const history = await fs.readJson(HISTORY_PATH);
    const today = new Date();

    // ISO weeknummer berekening
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((today - startOfYear) / 86400000) + 1) / 7);
    const year = today.getFullYear();

    const alreadyExists = history.some(e => e.week === weekNumber && e.year === year);

    if (alreadyExists) {
        return res.status(400).json({ message: "Deze week is al geregistreerd!" });
    }

    history.push({ week: weekNumber, year: year, date: today });
    await fs.writeJson(HISTORY_PATH, history);
    res.json({ message: `Succes! Week ${weekNumber} staat erin.` });
});

app.listen(PORT, () => console.log(`App live op http://localhost:${PORT}`));