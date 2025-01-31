import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

import {protoPath} from './constants.cjs';

const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
export const v1Package = grpc.loadPackageDefinition(packageDefinition).v1;
