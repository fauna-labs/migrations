// Copyright Fauna, Inc.
// SPDX-License-Identifier: MIT-0

'use strict';

const { SSM } = require('aws-sdk');
const ssm = new SSM();
const f = require('faunadb'),
    q = f.query;
const faker = require('faker');

let client;

const init = async () => {
    // Get the Fauna Server Key from AWS Systems Manager Parameter Store at runtime.
    const { Parameter: { Value } } = await ssm.getParameter({ Name:  process.env.FAUNA_SECRET_PARAMETER, WithDecryption: true }).promise();
    
    // Setup our Fauna client
    client = new f.Client({ secret: Value }, { headers: { 'X-Fauna-Source': 'migration-series' } });
}

// This starts our initialization before a handler is invoked by calling the `init` function above
const initComplete = init();

exports.lambdaHandler = async (event) => {
    await initComplete;

    let rules = [];
    const numRules = event.num_rules || process.env.FAUNA_NUM_RULES || 10;

    for (let i = 0; i < numRules; i++) {
        rules.push({
            action: faker.random.arrayElement(['allow', 'deny']),
            port: faker.datatype.number({ min: 1, max: 65535 }),
            ipRange: faker.internet.ip() + "/" + faker.datatype.number({ min: 1, max: 32 }),
            description: faker.lorem.sentence(),
        })
    }

    let result = await client.query(
        q.Call(
            "bulk_creator",
            rules
        )
    );

    const response = {
        statusCode: 200,
        body: {
            count: numRules
    }
    };

    return response;
}
