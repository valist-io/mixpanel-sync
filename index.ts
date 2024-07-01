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
    },
    sender: string,
    blockTime: string,
};

const getAccounts = async (page: number = 0, testnet: boolean = false) => {
    const gql = JSON.stringify({
        query: accountsQuery,
        variables: { first: 1000, skip: page == 0 ? 0 : page * 1000 },
    });
    const resp = await axios.post(`https://gateway-arbitrum.network.thegraph.com/api/e6b717ae2cd21ab9b06b792eaabee06f/subgraphs/id/88cRsVabPiks1qmwJ1vPJVJKsWD5M3Z7nvdUSTkmA51f}`, gql);
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
    };
};

const parseEvent = (log: LogEntry) => {
    return {
        event: log.type,
        properties: {
            time: Number(log.blockTime) * 1000,
            blockTime: log.blockTime,
            distinct_id: log.account?.id || log.project.account.id,
            "$insert_id": log.id,
            account_id: log.account?.id || log.project.account.id,
            project_id: log.project?.id || '',
            account_name: log.account?.name || log.project.account.name,
            project_name: log.project?.name || '',
        }
    };
};

const fetchData = async (lastBlockTime: string = '1646441277', testnet: boolean = false) => {
    const gql = JSON.stringify({
        query: logsQuery,
        variables: { first: 1000, lastBlockTime, filterAddresses },
    });
    const subgraphUrl = `https://gateway-arbitrum.network.thegraph.com/api/e6b717ae2cd21ab9b06b792eaabee06f/subgraphs/id/88cRsVabPiks1qmwJ1vPJVJKsWD5M3Z7nvdUSTkmA51f`;
    const resp = await axios.post(subgraphUrl, gql);
    return resp.data.data.logs.map(parseEvent);
};

const main = async () => {
    let lastBlockTime = '1646441277'; // Initial blockTime
    const maxIterations = 100;
    const maxPages = 100;
    const projectSettings = { project_id, 'content-encoding': 'gzip' };

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        console.log('mainnet iteration', iteration);
        const data = await fetchData(lastBlockTime, false);
        if (!data || data.length === 0) break;
        await sdk.importEvents(data, projectSettings);
        lastBlockTime = data[data.length - 1].properties.blockTime.toString();
    }

    // lastBlockTime = '1646441277'; // Reset for testnet
    // for (let iteration = 0; iteration < maxIterations; iteration++) {
    //     console.log('testnet iteration', iteration);
    //     const data = await fetchData(lastBlockTime, true);
    //     if (!data || data.length === 0) break;
    //     await sdk.importEvents(data, projectSettings);
    //     lastBlockTime = data[data.length - 1].properties.blockTime.toString();
    // }

    // import mainnet account profile data
    for (let page = 0; page <= maxPages; page++) {
        console.log('mainnet accounts page', page);
        const mainnetAccounts = await getAccounts(page);
        if (mainnetAccounts.length > 0) {
            await sdk.profileBatchUpdate(mainnetAccounts, {accept: 'text/plain'});
        } else {
            break;
        }
    }

    // import testnet account profile data
    // for (let page = 0; page <= maxPages; page++) {
    //     console.log('testnet accounts page', page);
    //     const testnetAccounts = await getAccounts(page, true);
    //     if (testnetAccounts.length > 0) {
    //         await sdk.profileBatchUpdate(testnetAccounts, {accept: 'text/plain'});
    //     } else {
    //         break;
    //     }
    // }
};

main();
