# @gravity-ui/gateway &middot; [![npm package](https://img.shields.io/npm/v/@gravity-ui/gateway)](https://www.npmjs.com/package/@gravity-ui/gateway) [![CI](https://img.shields.io/github/actions/workflow/status/gravity-ui/gateway/.github/workflows/ci.yml?label=CI&logo=github)](https://github.com/gravity-ui/gateway/actions/workflows/ci.yml?query=branch:main)

A flexible and powerful Express controller for working with REST and gRPC APIs in Node.js applications.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Configuration](#configuration)
  - [Validation Schema](#validation-schema)
  - [Using the API in Node.js](#using-the-api-in-nodejs)
  - [Schema Scopes](#schema-scopes)
  - [Connecting Specific Actions](#connecting-specific-actions)
  - [Overriding Endpoints](#overriding-endpoints)
  - [Authentication](#authentication)
  - [Error Handling](#error-handling)
  - [gRPC Reflection](#grpc-reflection-for-grpc-actions)
  - [Retryable Errors](#retryable-errors)
  - [Request Cancellation](#request-cancellation)
  - [Response Content Type Validation](#response-content-type-validation)
- [Development](#development)
  - [Running Tests](#running-tests)
  - [Contributing](#contributing)

## Installation

```shell
npm install --save @gravity-ui/gateway
```

## Basic Usage

First, create a controller by importing Gateway and your API schemas:

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

Then, connect the controller to your Express routes (using [expresskit](https://github.com/gravity-ui/expresskit)):

```javascript
{
    'POST   /<prefix>/:scope/:service/:action': {target: '<controller>', afterAuth: ['credentials']}
}
```

The `prefix` can be any prefix for API endpoints (for example, `/gateway/:service/:action`).

## Configuration

```typescript
import {AxiosRequestConfig} from 'axios';
import {IncomingHttpHeaders} from 'http';
import {IAxiosRetryConfig} from 'axios-retry';

interface OnUnknownActionData {
  service?: string;
  action?: string;
}

interface Stats {
  service: string;
  action: string;
  restStatus: number;
  grpcStatus?: number;
  responseSize: number;
  requestId: string;
  requestTime: number;
  requestMethod: string;
  requestUrl: string;
  timestamp: number;
  userId?: string;
  traceId: string;
}

type SendStats = (
  stats: Stats,
  headers: IncomingHttpHeaders,
  ctx: CoreContext,
  meta: {debugHeaders: Headers},
) => void;

type GrpcRetryCondition = (error: ServiceError) => boolean;
type AxiosRetryCondition = IAxiosRetryConfig['retryCondition'];

type ControllerType = 'rest' | 'grpc';

type ProxyHeadersFunctionExtra = {
  service: string;
  action: string;

  protopath?: string;
  protokey?: string;
};

type ProxyHeadersFunction = (
  headers: IncomingHttpHeaders,
  type: ControllerType,
  extra: ProxyHeadersFunctionExtra,
) => IncomingHttpHeaders;
type ProxyHeaders = string[] | ProxyHeadersFunction;
type ResponseContentType = AxiosResponse['headers']['Content-Type'];

type GetAuthHeadersParams<AuthArgs = Record<string, unknown>> = {
  actionType: ControllerType;
  serviceName: string;
  requestHeaders: Headers;
  authArgs: AuthArgs | undefined;
};

interface AppErrorArgs {
  code?: string | number;
  details?: object;
  debug?: object;
}

interface AppErrorWrapArgs extends AppErrorArgs {
  message?: string;
}

interface AppErrorConstructor {
  new (message?: string, args?: AppErrorArgs): Error;

  wrap: (error: Error, args?: AppErrorWrapArgs) => Error;
}

interface GatewayConfig {
  // Gateway Installation (external/internal/...). If not provided, determined from process.env.APP_INSTALLATION.
  installation?: string;

  // Gateway Environment (production/testing/...). If not provided, determined from process.env.APP_ENV.
  env?: string;

  // Additional gRPC client options.
  grpcOptions?: object;

  // Additional Axios client options.
  axiosConfig?: AxiosRequestConfig;

  // List of actions to connect from the schema. By default, all actions are connected.
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
  withDebugHeaders?: boolean | ((req: Request, res: Response) => boolean);

  // Validation schema for parameters used when no schema is present in the action.
  // You can use DEFAULT_VALIDATION_SCHEMA from lib/constants.ts.
  validationSchema?: object;

  // Enables encoding of REST path arguments (default is true).
  encodePathArgs?: boolean;

  // Configuration for automatic connection re-establishment upon connection error through L3 load balancer (default is true).
  grpcRecreateService?: boolean;

  // Customize retry behavior for grpc requests
  grpcRetryCondition?: GrpcRetryCondition;

  // Customize retry behavior for rest (axios) requests
  axiosRetryCondition?: AxiosRetryCondition;

  // Enable verification of response contentType header. Actual only for REST actions.
  // This value can be set/redefined in the action config.
  expectedResponseContentType?: ResponseContentType | ResponseContentType[];

  // Function to get authentication arguments for API requests
  getAuthArgs: (req: Request, res: Response) => Record<string, unknown> | undefined;

  // Function to get authentication headers for API requests
  getAuthHeaders: (params: GetAuthHeadersParams) => Record<string, string> | undefined;

  // Error constructor for handling errors
  ErrorConstructor: AppErrorConstructor;

  // Axios interceptors configuration
  axiosInterceptors?: AxiosInterceptorsConfig;
}
```

### `proxyHeaders`

`GatewayConfig.proxyHeaders` is an optional method that allows setting headers for requests at the entire `gateway` level:

```javascript
const proxyHeaders = (headers, actionType, extra) => {
  const normalizedHeaders = {...headers};
  const {service, action, protopath, protokey} = extra;

  if (actionType === 'rest' && service === 'mail') {
    normalizedHeaders['x-mail-service-action'] = action;
  }

  return normalizedHeaders;
};

const {controller: gatewayController} = getGatewayControllers(
  {root: Schema},
  {...config, proxyHeaders},
);
```

The `extra` parameter contains additional information about the request:

- `service`: The service name
- `action`: The action name
- `protopath`: The proto path (for gRPC actions)
- `protokey`: The proto key (for gRPC actions)

You can set headers for a specific action using `ApiServiceBaseActionConfig.proxyHeaders`:

```javascript
const schema = {
  userService: {
    serviceName: 'users',
    endpoints: {...},
    actions: {
      getProfile: {
        path: () => '/profile',
        method: 'GET',
        proxyHeaders: (headers) => ({...headers, ['x-users-service-action']: 'get-profile'}),
      },
    },
  },
};
```

The `GatewayConfig.proxyHeaders` and `ApiServiceBaseActionConfig.proxyHeaders` are merged when the action is called. The strategy for merging headers is not guaranteed.

It is recommended to use `GatewayConfig.proxyHeaders` for assigning headers that are common to the entire application or a large number of actions. Otherwise, it is preferable to use `ApiServiceBaseActionConfig.proxyHeaders`.

### Validation Schema

By default, for path params in REST actions, the following regexp is used: `/^((?!(\.\.|\?|#|\\|\/)).)*$/i`.
If the parameter value does not pass validation, the `GATEWAY_INVALID_PARAM_VALUE` error is returned.

You can use the `DEFAULT_VALIDATION_SCHEMA` from `lib/constants.ts` as a starting point:

```javascript
export const DEFAULT_VALIDATION_SCHEMA = {
  additionalProperties: {
    oneOf: [
      {
        type: 'number',
      },
      {
        type: 'string',
        pattern: '^((?!(\\.\\.|\\?|#|\\\\|\\/)).)*$',
      },
      {
        type: 'object',
      },
    ],
  },
};
```

### Using the API in Node.js

In addition to the Express controller, the gateway also exports an `api` object for making direct requests to backend services:

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

// Use the API to make requests
const result = await gatewayApi.serviceName.actionName({
  authArgs: {token: 'auth-token'},
  requestId: '123',
  headers: {},
  args: {param1: 'value1'},
  ctx: context,
});
```

The `actionConfig` parameter has the following structure:

```typescript
interface ApiActionConfig<Context, TRequestData> {
  requestId: string;
  headers: Headers;
  args: TRequestData;
  ctx: Context;
  timeout?: number;
  callback?: (response: TResponseData) => void;
  authArgs?: Record<string, unknown>;
  userId?: string;
  abortSignal?: AbortSignal;
}
```

### Schema Scopes

Each schema belongs to its own namespace. Service and action names between schemas are completely independent and can coincide. Each scope has an independent gRPC context, which eliminates naming conflicts between schemas in proto files.

The scope name is the key in the first parameter of the object containing the schemas:

```javascript
const schemasByScopes = {scope1: schema1, scope2: schema2};
```

Example with two scope namespaces: `root` and `anotherScope`:

```javascript
import {getGatewayControllers} from '@gravity-ui/gateway';

const {
  controller, // Controller
  api, // API (for Node.js environment)
} = getGatewayControllers({root: rootSchema, anotherScope: anotherSchema}, config);

// API calls are made by specifying the scope
const resultFromRoot = api.root.rootService.rootAction(params);
const resultFromAnother = api.anotherScope.anotherService.anotherAction(params);
```

There is a special scope called `root`. Its methods can be invoked without explicitly specifying the scope:

```javascript
const resultFromRoot = api.root.rootService.rootAction(params);
// Same result
const sameResultFromRoot = api.rootService.rootAction(params);
```

The controller for expresskit will also expect the `:scope` parameter. If the scope parameter is not specified, the default scope is assumed to be `root`.

```javascript
{
    'POST   /<prefix>/:scope/:service/:action': gatewayController
}
```

### Connecting Specific Actions

You can explicitly specify which actions to connect from the schemas using the `actions` field in the config. If actions are not provided, all actions from the schemas are connected by default.

```javascript
import {getGatewayControllers} from '@gravity-ui/gateway';
import rootSchema from '<schemas package>';
import localSchema from '../shared/schemas';

const config = {
  installation: 'external',
  env: 'production',
  includeProtoRoots: ['...'],
  actions: [
    'local.*', // All actions from the 'local' scope
    'root.serviceA.*', // All actions from 'serviceA' in the 'root' scope
    'root.serviceB.getUser', // Only the 'getUser' action from 'serviceB' in the 'root' scope
  ],
};

const {api: gatewayApi} = getGatewayControllers({root: rootSchema, local: localSchema}, config);
```

Available patterns for specifying actions:

- `<scope>.*` - all actions from the specified scope
- `<scope>.<service>.*` - all actions from the specified service
- `<scope>.<service>.<action>` - only the specified action

**Note:** This configuration only affects client-side access. All actions remain accessible on the server side.

### Overriding Endpoints

You can override specific endpoints using the `GATEWAY_ENDPOINTS_OVERRIDES` environment variable. This is useful for testing environments.

Example format:

```javascript
GATEWAY_ENDPOINTS_OVERRIDES = JSON.stringify({
  serviceName: {
    endpoint: 'https://example.com',
  },
  'example.exampleService': {
    endpoint: 'https://overrided.example.com',
  },
});
```

### Authentication

The gateway supports set up authentication through the `getAuthArgs` and `getAuthHeaders` config options:

```javascript
const config = {
  // ...other config options

  // Get authentication arguments for request
  getAuthArgs: (req, res) => ({
    token: req.authorization.token,
  }),

  // Generate authentication headers for backend requests
  getAuthHeaders: (params) => {
    if (!params?.token) return undefined;

    return {
      Authorization: `Bearer ${params.token}`,
    };
  },
};
```

You can define authentication at three levels:
|

1. **Gateway level** (global) - as shown above
2. **Service level** - by adding authentication methods to the service definition
3. **Action level** (most specific) - by adding authentication methods to individual actions
   |
   The authentication methods are checked in the following order: action > service > gateway.
   |
   **Service-level authentication:**
   |

```javascript
const schema = {
  userService: {
    serviceName: 'users',
    endpoints: {...},
    // Service-level authentication
    getAuthHeaders: (params) => ({
      'X-User-Service-Auth': params.authArgs.token,
    }),
    getAuthArgs: (req, res) => ({
      token: req.authorization.token,
      serviceSpecificData: req.headers['x-service-data'],
    }),
    actions: {
      getProfile: {
        path: () => '/profile',
        method: 'GET',
        // Uses service-level authentication
      },
      updateProfile: {
        path: () => '/profile',
        method: 'PUT',
        // Action-level authentication (overrides service-level)
        getAuthHeaders: (params) => ({
          'X-Special-Auth': params.token,
        }),
      },
    },
  },
};
```

### Error Handling

The gateway provides several ways to handle errors:

1. **Error constructor** through the `ErrorConstructor` (reqiured field) config option:

```javascript
class CustomError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CustomError';
    this.code = options.code || 'UNKNOWN_ERROR';
    this.status = options.status || 500;
    this.details = options.details;
  }

  static wrap(error) {
    if (error instanceof CustomError) return error;
    return new CustomError(error.message, {
      code: error.code || 'INTERNAL_ERROR',
      status: error.status || 500,
    });
  }
}

const config = {
  // ...other config options
  ErrorConstructor: CustomError,
};
```

2. **Custom request error handling** through the `onRequestFailed` config option:

```javascript
const config = {
  // ...other config options
  onRequestFailed: (req, res, error) => {
    console.error('Request failed:', error);
    return res.status(error.status || 500).json({
      error: error.message,
      code: error.code,
    });
  },
};
```

### Retryable Errors

#### REST-actions

The **default** retry condition for REST-actions includes the following conditions:

- Network errors (detected by `axiosRetry.isNetworkError`)
- Other retryable errors (detected by `axiosRetry.isRetryableError`)

You can customize retry behavior using the `axiosRetryCondition` config option:

```javascript
const config = {
  // ...other config options
  axiosRetryCondition: (error) => {
    // Custom logic to determine if the request should be retried
    return error.code === 'TIMEOUT';
  },
};
```

You can also set retry conditions at the action level:

```javascript
const schema = {
  userService: {
    serviceName: 'users',
    endpoints: {...},
    actions: {
      getProfile: {
        path: () => '/profile',
        method: 'GET',
        axiosRetryCondition: (error) => {
          // Custom logic for this specific action
          return error.code === 'ECONNRESET';
        },
      },
    },
  },
};
```

#### gRPC-actions

The **default** retry condition for gRPC-actions includes the certain gRPC status codes:

- `UNAVAILABLE`
- `CANCELLED`
- `ABORTED`
- `UNKNOWN`

You can customize retry behavior using the `grpcRetryCondition` config option:

```javascript
const config = {
  // ...other config options
  grpcRetryCondition: (error) => {
    // Custom logic to determine if the request should be retried
    return error.code === 'RESOURCE_EXHAUSTED';
  },
};
```

The library exports the `isRetryableGrpcError` function that you can use to check if a gRPC error is retryable according to the default conditions:

```javascript
import {isRetryableGrpcError} from '@gravity-ui/gateway';

// Use in your custom retry condition
const customGrpcRetryCondition = (error) => {
  return isRetryableGrpcError(error) || error.code === 'RESOURCE_EXHAUSTED';
};
```

For gRPC-requests that fail with `DEADLINE_EXCEEDED`, the service connection is recreated before retrying if config option `grpcRecreateService` is not set to `false`.

### Request Cancellation

The gateway supports cancelling requests when the client disconnects. This is useful for long-running operations where you want to avoid unnecessary processing if the client is no longer waiting for the response.

This feature is enabled by default for exported controller. For API requests, you can pass an `AbortSignal` to cancel the request:

```javascript
const abortController = new AbortController();

const result = await gatewayApi.serviceName.actionName({
  authArgs: {token: 'auth-token'},
  requestId: '123',
  headers: {},
  args: {param1: 'value1'},
  ctx: context,
  abortSignal: abortController.signal,
});
```

You can also control this behavior at the action level using the `abortOnClientDisconnect` option:

```javascript
const schema = {
  userService: {
    serviceName: 'users',
    endpoints: {...},
    actions: {
      longRunningOperation: {
        path: () => '/process',
        method: 'POST',
        abortOnClientDisconnect: true, // Enable cancellation for this action
      },
    },
  },
};
```

### Response Content Type Validation

For REST actions, you can validate the content type of the response to ensure it matches your expectations. This is useful for ensuring that the API returns the expected format.

You can set the expected content type at the gateway level:

```javascript
const config = {
  // ...other config options
  expectedResponseContentType: 'application/json',
};
```

Or at the action level:

```javascript
const schema = {
  userService: {
    serviceName: 'users',
    endpoints: {...},
    actions: {
      getProfile: {
        path: () => '/profile',
        method: 'GET',
        expectedResponseContentType: 'application/json',
      },
      getDocument: {
        path: () => '/document',
        method: 'GET',
        expectedResponseContentType: ['application/pdf', 'application/octet-stream'],
      },
    },
  },
};
```

You can specify either a single content type or an array of acceptable content types. If the response content type doesn't match any of the expected types, an error will be thrown.

### gRPC Reflection for gRPC Actions

Instead of using gRPC proto files, you can use gRPC reflection to determine the structure of services and methods.

**Prerequisites:**

1. Install the `grpc-reflection-js` package:

   ```shell
   npm install --save grpc-reflection-js
   ```

2. Apply patches to the `protobufjs` library:
   - Add `npx gateway-reflection-patch` to your project's `postinstall` script. This assumes that protobufjs is located in the root of node_modules.
   - Copy the patch from the library's patches folder to your project root, install [patch-package](https://www.npmjs.com/package/patch-package), and add the patch-package command to the `postinstall` script. In this case, you need to keep an eye on updates to the patches in the gateway when updating it.

If you encounter a "cannot run in wd [...]" error during Docker build, you can add unsafe-perm = true to your .npmrc file.

3. Configure your action to use reflection:

   ```javascript
   import {GrpcReflection} from '@gravity-ui/gateway';

   const schema = {
     userService: {
       serviceName: 'users',
       endpoints: {...},
       actions: {
         getUser: {
           protoKey: 'users.v1.UserService',
           action: 'GetUser',
           reflection: GrpcReflection.OnFirstRequest,
           // Optional: refresh reflection cache every 3600 seconds (1 hour)
           reflectionRefreshSec: 3600,
         },
       },
     },
   };
   ```

**Reflection Options:**

- `GrpcReflection.OnFirstRequest` - Perform reflection on the first request. Use cached reflections.
- `GrpcReflection.OnEveryRequest` - Perform reflection before every request. Do not use cached reflections.

For the `OnFirstRequest` options you can specify the `reflectionRefreshSec` parameter, which indicates how often in seconds the reflection cache can be updated in the background. Cache updates happen asynchronously and don't block the current request. The initial reflection request with an empty cache might introduce some delay in the request.

**Particularities**

The cache key for reflections consists of `protoKey` and `endpoint`. Therefore, actions with shared keys will use a common cached version, which will be obtained from the earliest scenario (when the first action request with the `OnFirstRequest` strategy is made).

This function is experimental. Fixes have been applied to `protobufjs` using [patch-package](https://github.com/ds300/patch-package) based on the following PRs:

- Conversion of parameter names to camelCase [PR 1073](https://github.com/protobufjs/protobuf.js/pull/1073)
- Fix for handling Map [PR 1478](https://github.com/protobufjs/protobuf.js/pull/1478)
  grpc-reflection-js has also been patched to support custom options.

For development, you need to apply the patch locally using the command `npx patch-package`.

**ChannelCredentials Type Mismatch Error**

This error can occur due to duplicate installations of the `@grpc/grpc-js` library. It's recommended to ensure that all versions of this library are aligned and consistent to avoid this issue.

## Development

### Running Tests

```shell
# Run unit tests
npm test

# Run integration tests
npm run test-integration
```

### Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT
