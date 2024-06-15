const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

class DBManager {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        username TEXT PRIMARY KEY,
                        password TEXT NOT NULL
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating table:', err.message);
                    } else {
                        this.addUser('admin', 'password').catch((err) => {});
                    }
                });
            }
        });
    }

    async addUser(username, password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async deleteUser(username) {
        return new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM users WHERE username = ?`, [username], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async authenticateUser(username, password) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT password FROM users WHERE username = ?`, [username], async (err, row) => {
                if (err) {
                    reject(err);
                } else if (row && await bcrypt.compare(password, row.password)) {
                    resolve({ username });
                } else {
                    resolve(null);
                }
            });
        });
    }

    async getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT username FROM users`, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = DBManager;