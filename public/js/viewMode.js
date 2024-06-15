document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';

    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.querySelector('.navbar').classList.add('dark-mode');
        document.querySelectorAll('.card').forEach(card => card.classList.add('dark-mode'));
        document.querySelectorAll('.card-header').forEach(header => header.classList.add('dark-mode'));
        themeToggleBtn.textContent = 'Light Mode';
    } else {
        document.body.classList.remove('dark-mode');
        document.querySelector('.navbar').classList.remove('dark-mode');
        document.querySelectorAll('.card').forEach(card => card.classList.remove('dark-mode'));
        document.querySelectorAll('.card-header').forEach(header => header.classList.remove('dark-mode'));
        themeToggleBtn.textContent = 'Dark Mode';
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        document.querySelector('.navbar').classList.toggle('dark-mode');
        document.querySelectorAll('.card').forEach(card => card.classList.toggle('dark-mode'));
        document.querySelectorAll('.card-header').forEach(header => header.classList.toggle('dark-mode'));
        const newTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        themeToggleBtn.textContent = newTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    });
});