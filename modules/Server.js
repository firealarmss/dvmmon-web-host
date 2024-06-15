const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');
const session = require('express-session');
const DBManager = require('./DBManager');
const RESTClient = require('./RESTClient');

class Server {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.address = this.config.address;
        this.port = this.config.port;

        this.dbManager = new DBManager(path.join(__dirname, '../db/users.db'));
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server);

        this.previousVoiceChannelStates = new Map();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();
    }

    loadConfig() {
        if (!fs.existsSync(this.configPath)) {
            console.error(`Config file not found: ${this.configPath}`);
            process.exit(1);
        }
        return yaml.parse(fs.readFileSync(this.configPath, 'utf8'));
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(session({
            secret: 'supersecretkey',
            resave: false,
            saveUninitialized: true
        }));
        this.app.set('view engine', 'ejs');
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.render('index', { user: req.session.user });
        });

        this.app.get('/login', (req, res) => {
            res.render('login');
        });

        this.app.post('/login', async (req, res) => {
            const { username, password } = req.body;
            const user = await this.dbManager.authenticateUser(username, password);
            if (user) {
                req.session.user = user;
                res.redirect('/');
            } else {
                res.render('login', { error: 'Invalid username or password' });
            }
        });

        this.app.get('/users', async (req, res) => {
            if (!req.session.user) {
                return res.status(401).render('login', { error: 'Unauthorized' });
            }

            const users = await this.dbManager.getAllUsers();
            res.render('users', { users, user: req.session.user });
        });

        this.app.post('/users/add', async (req, res) => {
            const { username, password } = req.body;
            await this.dbManager.addUser(username, password);
            res.redirect('/users');
        });

        this.app.post('/users/delete', async (req, res) => {
            const { username } = req.body;
            await this.dbManager.deleteUser(username);
            res.redirect('/users');
        });

        this.app.get('/logout', (req, res) => {
            req.session.destroy();
            res.redirect('/');
        });

        this.app.put('/api/command', async (req, res) => {
            if (!req.session.user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { command, address, port, password } = req.body;
            const dstId = parseInt(req.body.dstId) || 0;

            try {
                console.log(`Sending command ${command} to ${address}:${port} with dstId ${dstId}`);
                const commandPath = '/p25/rid';
                const restClient = new RESTClient(address, port, password, false, console);
                const response = await restClient.send('PUT', commandPath, { command, dstId });

                res.json({ message: 'Command sent successfully', data: response });
            } catch (error) {
                console.error('Error sending command:', error);
                res.status(500).json({ message: 'Error sending command', error: error.message });
            }
        });
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            socket.on('disconnect', () => {});

            this.fetchAllData().then(data => {
                if (data && !data.cc_error_state) {
                    socket.emit('update', data);
                }
            });
        });
    }

    async fetchData(address, port, password) {
        try {
            const restClient = new RESTClient(address, port, password, false, console);
            return await restClient.send('GET', '/status', {});
        } catch (error) {
            console.error(`Error fetching data from ${address}:${port}`, error);
            return null;
        }
    }

    async fetchAllData() {
        const allData = { sites: [] };
        let cc_error_state = false;

        for (const site of this.config.sites) {
            const siteData = { name: site.name, controlChannels: [], repeaters: [] };

            if (site.controlChannels) {
                for (const controlChannelConfig of site.controlChannels) {
                    const controlChannelData = await this.fetchData(controlChannelConfig.restAddress, controlChannelConfig.restPort, controlChannelConfig.restPassword);
                    if (controlChannelData && controlChannelData.status === 200) {
                        const controlChannel = {
                            ...controlChannelData,
                            address: controlChannelConfig.restAddress,
                            port: controlChannelConfig.restPort,
                            password: controlChannelConfig.restPassword,
                            voiceChannels: []
                        };

                        for (const voiceChannelConfig of site.voiceChannels) {
                            const voiceChannelData = await this.fetchData(voiceChannelConfig.restAddress, voiceChannelConfig.restPort, voiceChannelConfig.restPassword);
                            if (voiceChannelData) {
                                controlChannel.voiceChannels.push(voiceChannelData);
                                this.logVoiceChannelActivity(site.name, controlChannel, voiceChannelData);
                            }
                        }

                        siteData.controlChannels.push(controlChannel);
                    } else {
                        cc_error_state = true;
                        console.error(`Error fetching data for control channel ${controlChannelConfig.restAddress}:${controlChannelConfig.restPort}`);
                    }
                }
            }

            if (site.repeaters) {
                for (const repeaterConfig of site.repeaters) {
                    const repeaterData = await this.fetchData(repeaterConfig.restAddress, repeaterConfig.restPort, repeaterConfig.restPassword);
                    if (repeaterData) {
                        siteData.repeaters.push({
                            ...repeaterData,
                            address: repeaterConfig.restAddress,
                            port: repeaterConfig.restPort,
                            password: repeaterConfig.restPassword
                        });
                        this.logVoiceChannelActivity(site.name, null, repeaterData);
                    }
                }
            }

            allData.sites.push(siteData);
        }

        allData.cc_error_state = cc_error_state;
        return allData;
    }

    logVoiceChannelActivity(siteName, controlChannel, voiceChannelData) {
        if (!voiceChannelData || voiceChannelData.lastSrcId === 0 || voiceChannelData.lastDstId === 0) {
            // For now returning, it may be better to log this as an invalid call. Still not sure.
            return;
        }

        if (!controlChannel) {
            controlChannel = { channelNo: 'repeater' };
        }

        const channelKey = `${siteName}-${controlChannel.channelNo}-${voiceChannelData.channelNo}`;
        const previousState = this.previousVoiceChannelStates.get(channelKey) || { tx: false };

        if (voiceChannelData.tx && !previousState.tx) {
            console.log(`Call started on ${channelKey}, srcId: ${voiceChannelData.lastSrcId}, dstId: ${voiceChannelData.lastDstId}`);
        } else if (!voiceChannelData.tx && previousState.tx) {
            console.log(`Call ended on ${channelKey}, srcId: ${voiceChannelData.lastSrcId}, dstId: ${voiceChannelData.lastDstId}`);
        }

        this.previousVoiceChannelStates.set(channelKey, voiceChannelData);
    }

    start() {
        setInterval(async () => {
            const data = await this.fetchAllData();
            if (data && !data.cc_error_state) {
                this.io.emit('update', data);
            }
        }, 1000);

        this.server.listen(this.port, this.address, () => {
            console.log(`Server is running on http://${this.address}:${this.port}`);
        });
    }
}

module.exports = Server;