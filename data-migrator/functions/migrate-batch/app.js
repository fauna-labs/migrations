// Copyright Fauna, Inc.
// SPDX-License-Identifier: MIT-0

'use strict';

const { SSM } = require('aws-sdk');
const ssm = new SSM();
const f = require('faunadb'),
    q = f.query;

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

    const batchSize = event.batch_size || process.env.FAUNA_BATCH_SIZE || 100;
    let options = { size: batchSize }

    if (event.after != null) {
        let after = q.Ref(q.Collection("FirewallRule"), event.after[0]['@ref'].id)
        options.after = after;
    }

    let result = await client.query(
        q.Map(
            q.Paginate(
                q.Documents(q.Collection("FirewallRule")),
                options
            ),
            q.Lambda(
                "rule",
                q.Call(
                    "migrate_firewall_rule",
                    q.Var("rule")
                )
            )
        )
    );

    const response = {
        batch_size: batchSize, 
        after: result.after
    };

    return response;
}
