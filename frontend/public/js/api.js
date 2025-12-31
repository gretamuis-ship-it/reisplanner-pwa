// Houd het API object aan, maar voeg de logica toe
const API = {
    async getStats() {
        try {
            const r = await fetch('/api/stats');
            return await r.json();
        } catch (error) {
            console.error("Fout bij ophalen stats:", error);
            return null;
        }
    },
    async doCheckIn() {
        const r = await fetch('/api/checkin', { method: 'POST' });
        return await r.json();
    }
};

// Deze functie overbrugt de API data naar je UI (Scherm)
async function fetchProgress() {
    const data = await API.getStats();

    if (data) {
        // Zorg dat updateProgress in je ui.js staat!
        updateProgress(data.percentage, data.message);
    } else {
        const statusEl = document.getElementById('tracker-status');
        if (statusEl) statusEl.textContent = "Systeem offline";
    }
}