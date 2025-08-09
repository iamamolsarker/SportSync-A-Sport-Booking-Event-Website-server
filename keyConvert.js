const fs = require('fs');
const key = fs.readFileSync('./sport-sync-ass-11-firebase-admin-service-key.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')