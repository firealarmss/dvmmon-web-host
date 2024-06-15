document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';

    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.querySelector('.navbar').classList.add('navbar-dark');
        document.querySelector('.navbar').classList.remove('navbar-light');
        themeToggleBtn.textContent = 'Light Mode';
    } else {
        document.body.classList.remove('dark-mode');
        document.querySelector('.navbar').classList.remove('navbar-dark');
        document.querySelector('.navbar').classList.add('navbar-light');
        themeToggleBtn.textContent = 'Dark Mode';
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const navbar = document.querySelector('.navbar');
        navbar.classList.toggle('navbar-dark');
        navbar.classList.toggle('navbar-light');
        const newTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        themeToggleBtn.textContent = newTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    });
});