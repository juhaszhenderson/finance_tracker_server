const _ = require('lodash');
const promisify = require('es6-promisify');
const plaid = require('plaid');
const config = require('./config');
const airtable = require('./airtable');
const coinMarketCap = require('./coin_market_cap');
const Currencies = require('./currencies');
const Holdings = require('./holdings');
const openExchangeRates = require('./open_exchange_rates');

const plaidClient = new plaid.Client(config.plaidCredentials.clientId, config.plaidCredentials.secret, plaid.environments.tartan);

const accountSync = {
    async fetchAndUpdateCryptoAssetsAsync() {
        const cryptoAssetList = await coinMarketCap.fetchCryptoAssetsAsync();
        for (const cryptoAsset of cryptoAssetList) {
            if (_.indexOf(config.cryptoAssetsToUpdate, cryptoAsset.id) !== -1) {
                const priceInDollars = cryptoAsset.price_usd;
                const currencyName = Currencies[cryptoAsset.id];
                if (!currencyName) {
                    throw new Error(`
                        ${cryptoAsset.id} is missing from the 'Currencies' enum. Add
                        it to the enum in order to resolve this error.
                    `);
                }
                await this.updateCurrencyPriceAsync(currencyName, priceInDollars);
            }
        }
    },
    async fetchAndUpdateFiatCurrenciesAsync(fiatCurrencyName) {
        const fiatCurrencyExchangeRates = await openExchangeRates.fetchAllCurrencyExchangesInDollarsAsync(fiatCurrencyName);
        for (var currencyName in fiatCurrencyExchangeRates) {
            if (!fiatCurrencyExchangeRates.hasOwnProperty(currencyName)) {
                continue;
            }
            if (_.indexOf(config.fiatCurrenciesToUpdate, currencyName) !== -1) {
                const priceInDollars = 1 / fiatCurrencyExchangeRates[currencyName];
                await this.updateCurrencyPriceAsync(currencyName, priceInDollars);
            }
        }
    },
    async updateCurrencyPriceAsync(currencyName, priceInDollars) {
        const currencyRecordId = await airtable.fetchRecordIdForCurrencyAsync(currencyName);
        await airtable.updateAsync('Currencies', 'Price', currencyRecordId, priceInDollars);
    },
    async updateHoldingAmountAsync(holdingName, amountInDollars) {
        const holdingRecordId = await airtable.fetchRecordIdForHoldingAsync(holdingName);
        await airtable.updateAsync('Holdings', 'Amount', holdingRecordId, amountInDollars);
    },
    async fetchAndUpdateBankBalanceAsync() {
        const response = await promisify(plaidClient.getBalance.bind(plaidClient))(config.plaidCredentials.accessToken);
        let currentBalance = 0;
        _.each(response.accounts, account => {
            currentBalance += account.balance.available;
        });
        await this.updateHoldingAmountAsync(Holdings.chaseBank, currentBalance);
    },
};

module.exports = accountSync;
