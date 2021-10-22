import Vue from 'vue';
import VueRouter from 'vue-router';
import Home from '@/views/Home.vue';
import Init from '@/views/Init.vue';
import Sms from '@/views/Sms.vue';
import createWallet from '@/views/createWallet.vue';
import Details from '@/views/Details.vue';
import Transfer from '@/views/Transfer.vue';
import DevView from '@/views/DevView.vue';
import store from '@/store';
import errorScreen from '@/views/errorScreen.vue';
import Buy from '@/views/Buy.vue';
import Deposit from '@/views/Deposit.vue';
import Activate from '@/views/Activate.vue';
import BuyConfirmation from '@/views/BuyConfirmation';
import Trading from '@/views/Trading';
import PaymentSuccess from '@/views/PaymentSuccess';
import Withdraw from '@/views/Withdraw';

const originalPush = VueRouter.prototype.push;
VueRouter.prototype.push = function push(location) {
    return originalPush.call(this, location).catch(err => err);
};
Vue.use(VueRouter);

const routes = [
    {
        path: '/',
        name: 'home',
        component: Home,
        meta: {
            title: 'wallet',
            transfer: 'transfer',
            accent: 'accent',
            tags: ['showTransferButton'],
        },
    },
    {
        path: '/init',
        name: 'init',
        meta: {
            title: 'initialize',
            accent: 'accent',
        },
        component: Init,
    },
    {
        path: '/devview',
        name: 'devview',
        meta: {
            title: 'devview',
            accent: 'accent',
        },
        component: DevView,
    },
    {
        path: '/errorscreen/:reason?/:fix?',
        name: 'error screen',
        meta: {
            title: 'Error Screen',
            accent: 'accent',
        },
        component: errorScreen,
    },
    {
        path: '/sms/:code/:tel/:address',
        name: 'sms',
        meta: {
            title: 'account activation',
            accent: 'accent',
        },
        component: Sms,
    },
    {
        path: '/addwallet',
        name: 'addwallet',
        meta: {
            accent: 'accent',
            title: 'import wallet',
        },
        component: createWallet,
    },
    {
        path: '/details/:account',
        name: 'details',
        meta: {
            title: 'Details',
            transfer: 'transfer',
            accent: 'accent',
        },
        component: Details,
    },
    {
        path: '/buy/:asset/:account',
        name: 'buy',
        meta: {
            title: 'Trade',
            overview: 'home',
            accent: 'accent',
        },
        component: Buy,
    },
    {
        path: '/buy',
        name: 'buyConfirmation',
        meta: {
            title: 'Confirm Order',
            overview: 'home',
            accent: 'accent',
        },
        component: BuyConfirmation,
    },
    {
        path: '/trading',
        name: 'trading',
        meta: {
            title: 'trading',
            overview: 'home',
            accent: 'accent',
        },
        component: Trading,
    },
    {
        path: '/deposit/:asset/:account',
        name: 'deposit',
        meta: {
            title: 'deposit',
            overview: 'home',
            accent: 'accent',
        },
        component: Deposit,
    },
    {
        path: '/withdraw/:asset/:account',
        name: 'withdraw',
        meta: {
            title: 'withdraw',
            overview: 'home',
            accent: 'accent',
        },
        component: Withdraw,
    },
    {
        path: '/activate/:asset/:account',
        name: 'activate',
        meta: {
            title: 'activate',
            overview: 'home',
            accent: 'accent',
        },
        component: Activate,
    },
    {
        path: '/transfer/:account?/:asset_code?/:to?',
        name: 'transfer',
        meta: {
            accent: 'accent',
            overview: 'home',
            history: 'details',
        },
        component: Transfer,
    },
    {
        path: '/paymentSuccess',
        name: 'paymentSuccess',
        meta: {
            title: 'Success',
            accent: 'accent',
        },
        component: PaymentSuccess,
    },
    {
        path: '/walletinfo/:account',
        name: 'wallet info',

        meta: {
            accent: 'accent',
            transfer: 'transfer',
            info: {
                title: 'wallet info',
                text: 'this is info',
            },
        },
        component: () => import(/* webpackChunkName: "wallet-info" */ '../views/WalletInfo'),
    },
];

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes,
});

router.beforeEach((to, from, next) => {
    window.noCopyPaste = false;

    store.dispatch('disableAccountEventStreams');
    if (!store.getters.initialized && to.name !== 'error' && to.name !== 'init') {
        next({
            name: 'init',
        });
        return;
    }
    next();
});

router.beforeEach((to, from, next) => {
    if (!(to.name === 'buyConfirmation' || to.name === 'trading')) {
        store.commit('clearTradeInfo');
    }
    next();
});

export default router;
