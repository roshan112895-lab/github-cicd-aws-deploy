const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const prodEnv = path.join(root, '.env.production');
const exampleEnv = path.join(root, '.env.production.example');

process.env.DOTENV_CONFIG_PATH = fs.existsSync(prodEnv) ? prodEnv : exampleEnv;
require('./migrate-json-to-postgres.js');
