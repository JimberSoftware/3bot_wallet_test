import AccountCard from '../../../../components/AccountCard';
import { mapActions } from 'vuex';
export default {
    name: 'to-dialog',
    components: {
        AccountCard,
    },
    props: {
        dialog: {
            type: Boolean,
            default: false,
        },
        closeDialog: {
            type: Function,
        },
        accounts: {
            type: Array,
        },
        toRules: {
            type: Array,
        },
        selectedAccount: {
            type: Object,
        },
        selectedCurrency: {
            type: String,
        },
    },
    data() {
        return {
            selected: 0,
            externAddress: '',
            tabs: [
                { name: 'Own wallets', value: 0 },
                { name: 'Others', value: 1 },
            ],
            valid: false,
        };
    },
    computed: {
        computedAccounts() {
            return this.accounts.filter(
                x => x.name != this.selectedAccount.name
            );
        },
    },
    mounted() {
        for (const account of this.computedAccounts) {
            this.updateAccount(account.id);
        }
    },
    methods: {
        ...mapActions(['updateAccount']),
        selectAccount() {
            this.closeDialog(true, {
                address: this.externAddress,
            });
            this.$refs.externForm.reset();
            setTimeout(() => {
                this.selected = 0;
            }, 1000);
        },
        useAccount(account) {
            this.closeDialog(true, {
                address: account.id,
            });
        },
    },
    watch: {
        selected() {
            this.$refs.externForm.resetValidation();
        },
    },
};
