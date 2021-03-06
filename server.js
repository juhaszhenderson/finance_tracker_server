require('babel-core/register');
require('babel-polyfill');
const _ = require('lodash');
const express = require('express');
const config = require('./config');
const utils = require('./utils');
const accountSync = require('./account_sync');

// deAsync allows us to convert an ES6 Async/Await function to a callback function
// as required by express route handlers.
// Borrowed from: https://strongloop.com/strongblog/async-error-handling-expressjs-es7-promises-generators/
const deAsync = fn => (...args) => fn(...args).catch(args[2]);

const app = express();

app.get('/:airtableId', deAsync(async function(req, res) {
    const airtableId = req.params.airtableId;
    if (airtableId.length !== 17 || (utils.airtableIdPrefix(airtableId) !== 'tbl' && utils.airtableIdPrefix(airtableId) !== 'app')) {
        res.status(400).send('Invalid Request');
        return;
    }

    try {
        Promise.all([
            accountSync.fetchAndUpdateCryptoAssetsAsync(),
            accountSync.fetchAndUpdateFiatCurrenciesAsync(),
            accountSync.fetchAndUpdateBankBalancesAsync(),
        ]);
    } catch (err) {
        console.log('Error Encountered:', err);
        res.status(400).send('An Error Occurred');
        return;
    }
    res.redirect(`https://airtable.com/${airtableId}`);
}));

const port = 8080;
app.listen(port, () => {
    console.log(`Server Running... If running locally, visit: http://localhost:${port}/${config.airtableCredentials.appId}`);
});
