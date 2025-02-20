# @gravity-ui/gateway &middot; [![npm package](https://img.shields.io/npm/v/@gravity-ui/gateway)](https://www.npmjs.com/package/@gravity-ui/gateway) [![CI](https://img.shields.io/github/actions/workflow/status/gravity-ui/gateway/.github/workflows/ci.yml?label=CI&logo=github)](https://github.com/gravity-ui/gateway/actions/workflows/ci.yml?query=branch:main)

Express controller for working with REST/GRPC APIs.

## Install 1

```shell
npm install --save-dev @gravity-ui/gateway
```

## Usage

First of all, you need to create a controller where you will import Gateway and Schema, and then return the initialized gateway controller:

```javascript
import {getGatewayControllers} from '@gravity-ui/gateway';
import Schema from '<schemas package>';

const config = {
  installation: 'external',
  env: 'production',
  includeProtoRoots: ['...'],
};

const {controller: gatewayController} = getGatewayControllers({root: Schema}, config);

export default gatewayController;
```

Next, the controller described above should be connected to a route of the following format (the project should use [expresskit](https://github.com/gravity-ui/expresskit)):

```javascript
{
    'POST   /<prefix>/:scope/:service/:action': {target: '<controller>', afterAuth: ['credentials']}
}
```

The `prefix` can be any prefix for API endpoints (for example, `/gateway/:service/:action`).

### Config Structure

```typescript
import {AxiosRequestConfig} from 'axios';
import {IncomingHttpHeaders} from 'http';

interface OnUnknownActionData {
  service?: string;
  action?: string;
}

interface Stats {
  service: string;
  action: string;
  restStatus: number;
  grpcStatus?: number;
  requestId: string;
  requestTime: number;
  requestMethod: string;
  requestUrl: string;
  timestamp: number;
}

type SendStats = (
  stats: Stats,
  headers: IncomingHttpHeaders,
  ctx: CoreContext,
  meta: {debugHeaders: Headers},
) => void;

type ProxyHeadersFunction = (
  headers: IncomingHttpHeaders,
  type: ControllerType,
) => IncomingHttpHeaders;
type ProxyHeaders = string[] | ProxyHeadersFunction;
type ResponseContentType = AxiosResponse['headers']['Content-Type'];

interface GatewayConfig {
  // Gateway Installation (external/internal/...). If the configuration is not provided, it is determined from process.env.APP_INSTALLATION.
  installation?: string;
  // Gateway Environment (production/testing/...). If the configuration is not provided, it is determined from process.env.APP_ENV.
  env?: string;
  // Additional gRPC client options.
  grpcOptions?: object;
  // Additional Axios client options.
  axiosConfig?: AxiosRequestConfig;
  // List of actions that need to be connected from the schema. By default, all actions are connected.
  actions?: string[];
  // Called when an unknown service or action is provided.
  onUnknownAction?: (req: Request, res: Response, data: OnUnknownActionData) => any;
  // Called before the request is executed.
  onBeforeAction?: (
    req: Request,
    res: Response,
    scope: string,
    service: string,
    action: string,
    config?: ApiServiceActionConfig,
  ) => any;
  // Called upon successful completion of the request.
  onRequestSuccess?: (req: Request, res: Response, data: any) => any;
  // Called in case of unsuccessful request execution.
  onRequestFailed?: (req: Request, res: Response, error: any) => any;
  // List of paths to the necessary proto files for the gateway.
  includeProtoRoots?: string[];
  // Configuration of the path to the certificate in gRPC.
  // Set to null to use system certificates by default.
  caCertificatePath?: string | null;
  // Telemetry sending configuration.
  sendStats?: SendStats;
  // Configuration of headers sent to the API.
  proxyHeaders?: ProxyHeaders;
  // When passing a boolean value, it enables/disables debug headers in the response to the request.
  // For unary requests to gRPC backends, debug headers will include information from the trailing metadata returned by the backend.
  withDebugHeaders?: boolean;
  // Validation schema for parameters used when no schema is present in the action. Documentation: https://ajv.js.org/json-schema.html#json-data-type
  // You can use DEFAULT_VALIDATION_SCHEMA from lib/constants.ts.
  validationSchema?: object;
  // Enables encoding of REST path arguments (default is true).
  encodePathArgs?: boolean;
  // Configuration for automatic connection re-establishment upon connection error through L3 load balancer (default is true).
  grpcRecreateService?: boolean;
  // Enable verification of response contentType header. Actual only for REST actions. This value can be set / redefined the in action confg.
  expectedResponseContentType?: ResponseContentType | ResponseContentType[];
}
```

#### validationSchema

By default, for path params in rest actions used the following regexp: `/^((?!(\.\.|\?|#|\\|\/)).)*$/i`.
If the parameter value does not pass validation, the `GATEWAY_INVALID_PARAM_VALUE` value is returned.

### Usage in Node.js

Upon gateway initialization, in addition to exporting the controller, it also exports an `api` object, which represents the core for executing requests to the backend.

```javascript
import {getGatewayControllers} from '@gravity-ui/gateway';
import Schema from '<schemas package>';

const config = {
  installation: 'external',
  env: 'production',
  includeProtoRoots: ['...'],
  timeout: 25000, // default 25 seconds
  caCertificatePath: '...',
};

const {api: gatewayApi} = getGatewayControllers({root: Schema}, config);
```

Subsequently, in the code, you can use it as follows:

```javascript
gatewayApi[service][action](actionConfig);
```

`actionConfig` has the following structure:

```typescript
interface ApiActionConfig<Context, TRequestData> {
  requestId: string;
  headers: Headers;
  args: TRequestData;
  ctx: Context;
  timeout?: number;
  callback?: (response: TResponseData) => void;
  authArgs?: Record<string, unknown>;
}
```

### Schema Scopes

Each schema belongs to its own namespace. Service and action names between schemas are completely independent and can coincide. Each scope has an independent gRPC context, which eliminates naming conflicts between schemas in proto files.
The scope name is the key in the first parameter of the object containing the schemas.

```javascript
const schemasByScopes = {scope1: schema1, scope2: schema2};
```

Example with two scope namespaces: `root` and `anotherScope`.

```javascript
import {getGatewayControllers} from '@gravity-ui/gateway';

const {
    controller, // Controller
    api, // API (for Node.js environment)
} = getGatewayControllers({ root: rootSchema, anotherScope: anotherSchema}, config);

// API calls are made by specifying the scope.
const resultFromRoot = api.rootSchema.<root-service>.<root-action>(params);
const resultFromAnother = api.anotherSchema.<another-service>.<another-action>(params);
```

There is a special scope called root. Its methods can be invoked without explicitly specifying the scope.

```javascript
const resultFromRoot = api.rootSchema.<root-service>.<root-action>(params);
// Same result
const sameResultFromRoot = api.<root-service>.<root-action>(params);
```

The controller for the expresskit will also expect the `:scope` parameter.

```javascript
{
    'POST   /<prefix>/:scope/:service/:action': {...}
}
```

If the scope parameter is not specified, the default scope is assumed to be `root`.

### Connecting a Specific Set of Actions

When initializing the `gateway`, there is an option to explicitly specify the actions that need to be connected from the schemas. To do this, provide a list of available client-side actions in the `actions` field in the config. If `actions` are not provided, all actions from the schemas are connected by default.

```typescript
import {getGatewayControllers} from '@gravity-ui/gateway';
import rootSchema from '<schemas package>';
import localSchema from '../shared/schemas';

const config = {
  installation: 'external',
  env: 'production',
  includeProtoRoots: ['...'],
  actions: ['local.*', 'root.serviceA.*', 'root.serviceB.get'], // List of actions to be connected from the schemas. By default, all actions are connected.
};

const {api: gatewayApi} = getGatewayControllers({root: rootSchema, local: localSchema}, config);
```

The following combinations are available for specifying connected actions:

- `<scope>.*` - all actions from the scope scope are connected (for example, `local.*`)
- `<scope>.<service>.*` - all actions from the service service are connected (for example, `root.serviceA.*`)
- `<scope>.<service>.action` - only the specified action is connected (for example, `root.serviceB.get`)

**Important.** The actions configuration only affects the list of actions that will be accessible from the client (e.g., via the `sdk`). All actions from the schemas will continue to be accessible on Node.js.

### GATEWAY_ENDPOINTS_OVERRIDES

Through the `GATEWAY_ENDPOINTS_OVERRIDES` environment variable, you can override specific endpoints. This can be useful for testing environments. A simple example: `{"serviceName":{"endpoint":"https://example.com"}}`. You can find a more detailed format in the OverrideParams interface and test examples.

### gRPC Reflection for gRPC Actions

Instead of using gRPC proto files, a gRPC action can determine the structure of the service and the required method through reflection.

**Enabling Reflection**

To use reflection, you need to:

- Install the `grpc-reflection-js` package as a peer dependency.
- Apply patches to the `protobufjs` library. You can do this in the following ways:

  a) Add `npx gateway-reflection-patch` to the `postinstall` script in your project and execute it. This assumes that protobufjs is located in the root of node_modules.

  b) Copy the patch from the library's patches folder to your project's root, install [patch-package](https://www.npmjs.com/package/patch-package), and add the `patch-package` command to the `postinstall` script. In this case, you need to keep an eye on updates to the patches in the gateway when updating it.

  If you encounter a "cannot run in wd [...]" error during Docker build, you can add unsafe-perm = true to your .npmrc file as described here.

- In the `action` configuration, replace the `protoPath` option with the `reflection` option and set its value to the appropriate `GrpcReflection` enum value. For reflection to work, the endpoint must support it.

Possible values for `GrpcReflection`, affecting the caching of reflection results:

- `OnFirstRequest` - Perform reflection on the first action request. Use cached reflections.
- `OnEveryRequest` - Perform reflection before every action request. Do not use cached reflections.

For the `OnFirstRequest` options you can specify the reflectionRefreshSec parameter, which indicates how often in seconds the reflection cache can be updated in the background. Cache updates happen asynchronously and don't block the current request. The initial reflection request with an empty cache might introduce some delay in the request.

**Particularities**

The cache key for reflections consists of `protoKey` and `endpoint`. Therefore, actions with shared keys will use a common cached version, which will be obtained from the earliest scenario (when the first action request with the `OnFirstRequest` strategy is made).

This function is experimental. Fixes have been applied to `protobufjs` using [patch-package](https://github.com/ds300/patch-package) based on the following PRs:

- Conversion of parameter names to camelCase [PR 1073](https://github.com/protobufjs/protobuf.js/pull/1073)
- Fix for handling Map [PR 1478](https://github.com/protobufjs/protobuf.js/pull/1478)
  grpc-reflection-js has also been patched to support custom options.

For development, you need to apply the patch locally using the command `npx patch-package`.

**ChannelCredentials Type Mismatch Error**

This error can occur due to duplicate installations of the `@grpc/grpc-js` library. It's recommended to ensure that all versions of this library are aligned and consistent to avoid this issue.
