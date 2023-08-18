#!/bin/bash

tsc -p integration-test
mkdir -p build-integration/integration-test/proto/
cp -rf integration-test/proto/* build-integration/integration-test/proto/
node_modules/.bin/grpc_tools_node_protoc --descriptor_set_out=build-integration/integration-test/proto/descriptor_set.bin --include_imports integration-test/proto/*.proto
