import axios from 'axios';
import { filterAddresses, logsQuery, accountsQuery } from './graphql';

require('dotenv').config();

const sdk = require('api')('@mixpaneldevdocs/v3.08#260uf4wkzq3unav');

sdk.auth(process.env.MIXPANEL_ACCOUNT, process.env.MIXPANEL_SECRET);

const project_id = '2846312';
const project_token = '5f93bbd2b7cdef8740828bb41c43c9a8';

type LogEntry = {
    id: string,
    type: string,
    account: {
        id: string,
        name: string,
    },
    project: {
        id: string,
        name: string,
        account: {
            id: string,
            name: string,
        },
    }
    sender: string,
    blockTime: string,
}

const getAccounts = async (page: number = 0, testnet: boolean = false) => {
    const gql = JSON.stringify({
        query: accountsQuery,
        variables: { first: 1000, skip: page == 0 ? 0 : page * 1000 },
    });
    const resp = await axios.post(`https://api.thegraph.com/subgraphs/name/valist-io/valist${testnet ? 'mumbai' : ''}`, gql);
    return resp.data.data.accounts.map(parseAccounts);
}

const parseAccounts = (account: { id: string, name: string, blockTime: string }) => {
    return {
        "$token": project_token,
        "$distinct_id": account.id,
        "$set": {
            "name": account.name,
            "account_id": account.id,
            "account_name": account.name,
            "created_at": new Date(Number(account.blockTime) * 1000)
        }
    }
}

const getData = async (page: number = 0, testnet: boolean = false) => {
    const gql: string = JSON.stringify({
        query: logsQuery,
        variables: { first: 1000, skip: page == 0 ? 0 : page * 1000, filterAddresses },
    });
    const resp = await axios.post(`https://api.thegraph.com/subgraphs/name/valist-io/valist${testnet ? 'mumbai' : ''}`, gql);
    return resp.data.data.logs.map(parseEvent) as LogEntry[];
}

const parseEvent = (log: LogEntry) => {
    return {
        event: log.type,
        properties: {
            time: Number(log.blockTime) * 1000,
            distinct_id: log.account?.id || log.project.account.id,
            "$insert_id": log.id,
            account_id: log.account?.id || log.project.account.id,
            project_id: log.project?.id || '',
            account_name: log.account?.name || log.project.account.name,
            project_name: log.project?.name || '',
        }
    };
}

const main = async () => {

    const maxPages = 100;

    // import mainnet data
    for (let page = 0; page <= maxPages; page++) {
        console.log('mainnet data page', page);
        try {
            const mainnetData = await getData(page);
            if (mainnetData.length > 0) {
                await sdk.importEvents(mainnetData, { project_id, 'content-encoding': 'gzip' });
            } else {
                break;
            }
        } catch (e) {
            console.error(e);
        }
    }

    // import testnet data
    for (let page = 0; page <= maxPages; page++) {
        console.log('testnet data page', page);
        try {
            const testnetData = await getData(page, true);
            if (testnetData.length > 0) {
                await sdk.importEvents(testnetData, { project_id, 'content-encoding': 'gzip' });
            } else {
                break;
            }
        } catch (e) {
            console.error(e);
        }
    }

    // import mainnet account profile data
    for (let page = 0; page <= maxPages; page++) {
        console.log('mainnet accounts page', page);
        try {
            const mainnetAccounts = await getAccounts(page);
            if (mainnetAccounts.length > 0) {
                await sdk.profileBatchUpdate(mainnetAccounts, {accept: 'text/plain'});
            } else {
                break;
            }
        } catch (e) {
            console.error(e);
        }
    }

    // import testnet account profile data
    for (let page = 0; page <= maxPages; page++) {
        console.log('testnet accounts page', page);
        try {
            const testnetAccounts = await getAccounts(page, true);
            if (testnetAccounts.length > 0) {
                await sdk.profileBatchUpdate(testnetAccounts, {accept: 'text/plain'});
            } else {
                break;
            }
        } catch (e) {
            console.error(e);
        }
    }

}

main();