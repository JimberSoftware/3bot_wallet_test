import {
    calculateWalletEntropyFromAccount,
    keypairFromAccount,
    revineAddressFromSeed,
    addTrustLine,
    loadAccount,
    migrateAccount,
    fetchUnlockTransaction,
    getLockedBalances,
    transferLockedTokens,
    checkVesting,
} from '@jimber/stellar-crypto';
import { mnemonicToEntropy } from 'bip39';
import moment from 'moment';
import { Server } from 'stellar-sdk';
import config from '@/../public/config';
import store from '@/store';
import Logger from 'js-logger';

export const mapAccount = async ({
    accountResponse,
    name,
    tags,
    index,
    position,
    seed,
    keyPair,
    seedPhrase,
    lockedTransactions,
    lockedBalances,
    vestedBalance,
    isConverted,
    error,
}) => ({
    name: name,
    tags: tags,
    id: accountResponse.id,
    balances: Object.keys(config.currencies)
        .filter(c => accountResponse.balances.find(b => b.asset_code === c))
        .map(c => accountResponse.balances.find(b => b.asset_code === c)),
    index,
    position,
    seed,
    keyPair,
    seedPhrase,
    lockedTransactions: lockedTransactions.sort((a, b) => {
        if (!a.unlockTransaction) {
            return 0;
        }
        if (!b.unlockTransaction) {
            return 0;
        }
        if (a.unlockTransaction.timeBounds.minTime < b.unlockTransaction.timeBounds.minTime) {
            return -1;
        }
        if (a.unlockTransaction.timeBounds.minTime > b.unlockTransaction.timeBounds.minTime) {
            return 1;
        }
        return 0;
    }),
    lockedBalances,
    vestedBalance,
    isConverted,
    error,
});

// todo: make this an interval loop
// todo: upodate locked balance
// todo: remove converted escrow accounts
async function lockedTokenSubRoutine(lockedBalances) {
    const server = new Server(config.stellarServerUrl);
    for (const lockedBalance of lockedBalances) {
        const unlockHash = lockedBalance.unlockHash;
        if (unlockHash) {
            store.commit('setLoadingMessage', {
                message: 'fetching locked tokens',
            });
            try {
                lockedBalance.unlockTransaction = await fetchUnlockTransaction(unlockHash);
            } catch (e) {
                Logger.info('failed to fetch unlock trans', unlockHash);
                continue;
            }
            // const timestamp = moment.unix(lockedBalance.unlockTransaction.timeBounds.minTime).toString()
            // const isBeforeNow = moment.unix(lockedBalance.unlockTransaction.timeBounds.minTime).isBefore()
            // Logger.info('fetched unlocktransaction', {unlockHash, timestamp, isBeforeNow})
            if (!moment.unix(lockedBalance.unlockTransaction.timeBounds.minTime).isBefore()) {
                const mintimeTrans = lockedBalance.unlockTransaction.timeBounds.minTime;
                Logger.info('Lockedtransaction mintime is not before now ', {
                    mintimeTrans,
                });
                continue;
            }
            const unlockTrans = lockedBalance.unlockTransaction;
            Logger.info('submitting unlocktransaction', { unlockTrans });
            await server.submitTransaction(lockedBalance.unlockTransaction);
            lockedBalance.unlockHash = null;
            lockedBalance.unlockTransaction = null;
        }

        // could be already changed to null
        if (!lockedBalance.unlockHash) {
            Logger.info("Locked balance unlockhash doesn't exist");
            console.log(lockedBalance);
            try {
                await transferLockedTokens(
                    lockedBalance.keyPair,
                    lockedBalance.id,
                    lockedBalance.balance.asset_code,
                    Number(lockedBalance.balance.balance)
                );
            } catch (e) {
                const message = e.message;
                console.log(message);
                Logger.error('Transferring locked tokens failed ', JSON.stringify(message));
            }
        }
    }
}

export const fetchAccount = async ({ seedPhrase, index, name, tags, position, isConverted, retry = 0 }) => {
    if (retry > 3) {
        console.error('too many retries');
        throw new Error('too many retries');
    }
    const entropy = calculateWalletEntropyFromAccount(seedPhrase, index);
    const keyPair = keypairFromAccount(entropy);
    let accountResponse;
    try {
        accountResponse = await loadAccount(keyPair);
    } catch (e) {
        Logger.error('error Something went wrong while fetching account', {
            e,
        });

        if (e.message !== 'Not Found') {
            throw Error('Something went wrong while fetching account');
        }

        try {
            accountResponse = await generateAndFetchAccount(keyPair, seedPhrase, index);
        } catch (e) {
            if (e.message === 'Tfchain address has 0 balance, no need to activate an account') {
                throw e;
            }

            return mapAccount({
                accountResponse: {
                    id: keyPair.publicKey(),
                    balances: [],
                },
                index,
                tags,
                name,
                position,
                seed: Buffer.from(mnemonicToEntropy(seedPhrase), 'hex'),
                keyPair,
                seedPhrase,
                lockedTransactions: [],
                lockedBalances: [],
                isConverted,
                vestedBalance: 0,
                error: true,
            });
        }
    }

    const valid = await validateAndFixAccountResponse(accountResponse, keyPair);

    if (!valid) {
        return await fetchAccount({
            seedPhrase,
            index,
            name,
            tags,
            position,
            isConverted,
            retry: retry + 1,
        });
    }

    const lockedTransactions = await getLockedBalances(keyPair);
    lockedTokenSubRoutine(lockedTransactions);

    let lockedBalances = {};
    lockedTransactions.forEach(transaction => {
        if (lockedBalances[transaction.balance.asset_code]) {
            lockedBalances[transaction.balance.asset_code] += Number(transaction.balance.balance);
        } else {
            lockedBalances[transaction.balance.asset_code] = Number(transaction.balance.balance);
        }
    });

    let vestedBalance = 0;
    const vestingAccount = await checkVesting(accountResponse.id);
    if (vestingAccount) {
        vestedBalance = vestingAccount.balances.find(b => b.asset_code === 'TFT').balance;
        const server = new Server(config.stellarServerUrl);
        server
            .accounts()
            .accountId(vestingAccount.id)
            .cursor('now')
            .stream({
                onmessage: async message => {
                    vestedBalance = message.balances.find(b => b.asset_code === 'TFT').balance;

                    const newAccount = store.getters.accounts.find(a => a.id === accountResponse.id);

                    if (!newAccount) {
                        return;
                    }
                    newAccount.vestedBalance = vestedBalance;

                    store.commit('addAccount', newAccount);
                },
            });
    }

    return mapAccount({
        accountResponse,
        index,
        tags,
        name,
        position,
        seed: Buffer.from(mnemonicToEntropy(seedPhrase), 'hex'),
        keyPair,
        seedPhrase,
        lockedTransactions,
        lockedBalances,
        isConverted,
        vestedBalance,
    });
};

async function generateAndFetchAccount(keyPair, seedPhrase, index) {
    try {
        const revineAddress = revineAddressFromSeed(seedPhrase, index);
        // tfchain testnet is discontinued
        // Call friendbot to activate if not in prod
        if (config.env === 'production') {
            await migrateAccount(keyPair, revineAddress);
        } else {
            const Http = new XMLHttpRequest();
            Http.open('GET', `https://friendbot.stellar.org/?addr=${keyPair.publicKey()}`, false);
            Http.send();
        }
    } catch (e) {
        Logger.error('error Something went wrong while generating account', {
            e,
            error: e.response.data.error,
        });
        if (
            e.response &&
            e.response.data &&
            (e.response.data.error === 'Tfchain address has 0 balance, no need to activate an account' ||
                e.response.data.error.includes('GET: no content available (code: 204)'))
        ) {
            throw Error('Tfchain address has 0 balance, no need to activate an account'); // will initialize sms flow
        }

        throw Error('Something went wrong while generating account');
    }
    console.log('loading account');
    return await loadAccount(keyPair);
}

const validateAndFixAccountResponse = async (accountResponse, keyPair) => {
    if (!accountResponse.balances.find(b => b.asset_code === 'TFT')) {
        await addTrustLine(keyPair);
        return false;
    }
    return true;
};

export const sendWalletDataToApp = async () => {
    window.flutter_inappwebview.callHandler('SAVE_WALLETS', [{
        name: 'example1', chain: 'stellar', address: 'EXAMPLE_ADDRESS_1',
    }, {
        name: 'example_2', chain: 'stellar', address: 'EXAMPLE_ADDRESS_2',
    }]);
};
