#!/bin/bash

tsc -p integration-test/tsconfig.server.json
mkdir -p build-integration/proto/
cp -rf integration-test/proto/* build-integration/proto/
node_modules/.bin/grpc_tools_node_protoc --descriptor_set_out=build-integration/proto/descriptor_set.bin --include_imports integration-test/proto/*.proto
