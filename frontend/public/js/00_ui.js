document.addEventListener('DOMContentLoaded', () => {
    // Initialiseer iconen
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Navigatie logica
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === target) page.classList.add('active');
            });

            // Trigger specifieke laders per pagina indien nodig
            if (target === 'page-diensten' && typeof laadDiensten === 'function') laadDiensten();
        });
    });
});