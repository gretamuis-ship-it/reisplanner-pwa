const API = {
    async getStats() {
        const r = await fetch('/api/stats');
        return await r.json();
    },
    async doCheckIn() {
        const r = await fetch('/api/checkin', { method: 'POST' });
        return await r.json();
    }
};