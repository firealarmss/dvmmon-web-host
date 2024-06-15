const yargs = require('yargs');
const Server = require('./modules/server');

const argv = yargs
    .option('c', {
        alias: 'config',
        description: 'Path to the configs file',
        type: 'string',
        default: './configs/configs.yml'
    })
    .help()
    .alias('help', 'h')
    .argv;

const config_path = argv.config;

const server = new Server(config_path);
server.start();