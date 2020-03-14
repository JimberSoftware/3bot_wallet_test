import { mapGetters } from 'vuex';
import { fetchAccount } from '../../services/AccountService';
import { entropyToMnemonic } from 'bip39';
import { keypairFromAccount } from '@jimber/stellar-crypto/dist/service/cryptoService';

export default {
  state: {
    accounts: [],
    accountThombstones: [],
  },
  computed: {
    ...mapGetters(['appSeedPhrase']),
  },
  actions: {
    generateAppAccount: async (context, walletName) => {
      context.commit('startAppLoading');
      context.commit('addAccountThombstone', walletName);
      const nextAppAcountIndex = context.getters.nextAppAcountIndex;
      const seedPhrase = context.getters.appSeedPhrase;
      const position = context.state.accounts.length;
      const kp = keypairFromAccount(seedPhrase, index);
      context.dispatch('fetchPayments', kp.pub);
      const account = await fetchAccount({
        index: nextAppAcountIndex,
        name: walletName,
        tags: ['app'],
        seedPhrase,
        position: position,
      });
      context.commit('removeAccountThombstone', walletName);
      context.commit('addAccount', account);

      await context.dispatch('saveToPkid');
      context.commit('stopAppLoading');
    },
    generateImportedAccount: async (context, { seedPhrase, walletName }) => {
      context.commit('startAppLoading');
      const position = context.state.accounts.length;
      const account = await fetchAccount({
        index: 0,
        name: walletName,
        tags: ['imported'],
        seedPhrase,
        position: position,
      });
      context.dispatch('fetchPayments', account.id);
      context.commit('addAccount', account);
      await context.dispatch('saveToPkid');
      context.commit('stopAppLoading');
    },
    syncAccounts: async ({ commit, getters, dispatch }) => {
      commit('startAppLoading');
      const op1 = await dispatch(
        'initializePkidAppAccounts',
        getters.appSeedPhrase,
      );
      console.log({ op1 });

      const op2 = await dispatch('initializeImportedPkidAccounts');
      await Promise.all([...op1, ...op2]);
      await dispatch('saveToPkid');
      console.log('aftersave');
      commit('stopAppLoading');
    },
    changeWalletName: async ({ commit, dispatch }, { account, name }) => {
      commit('startAppLoading');
      account.name = name;
      commit('addAccount', account);
      await dispatch('saveToPkid');
      commit('stopAppLoading');
    },
    async deleteAccount({ commit, dispatch }, account) {
      commit('startAppLoading');
      commit('removeAccount', account);
      await dispatch('saveToPkid');
      commit('stopAppLoading');
    },
  },
  mutations: {
    addAccount: (state, account) => {
      const index = state.accounts.findIndex(a => a.id === account.id);

      if (index === -1) {
        state.accounts.push(account);
        return;
      }
      state.accounts.splice(index, 1, account);
    },
    removeAccount: (state, account) => {
      state.accounts = state.accounts.filter(item => item !== account);
    },
    removeAppAccounts: state => {
      state.accounts = state.accounts.filter(
        account => !account.tags.includes('app'),
      );
    },
    removeImportedAccounts: state => {
      state.accounts = state.accounts.filter(
        account => !account.tags.includes('app'),
      );
    },
    addAccountThombstone: (state, name) => {
      state.accountThombstones.push(name);
    },
    removeAccountThombstone: (state, name) => {
      state.accountThombstones = state.accountThombstones.filter(
        item => item !== name,
      );
    },
    setAccounts: (state, accounts) => {
      state.accounts = accounts;
    },
  },
  getters: {
    accounts: state => state.accounts,
    nextAppAcountIndex: state => {
      // @Reminder if deleted accounts are not in the account array,
      // this will not be correct
      const amount = state.accounts.filter(account =>
        account.tags.includes('app'),
      ).length;
      const index = amount;
      console.log(index);
      return index;
    },
    accountThombstones: state => state.accountThombstones,
  },
};
