# Changelog

## [2.0.0](https://github.com/gravity-ui/gateway/compare/v1.6.0...v2.0.0) (2024-02-15)


### ⚠ BREAKING CHANGES

* move originalError to debug field ([#39](https://github.com/gravity-ui/gateway/issues/39))
* change default value for encodePathArgs option ([#38](https://github.com/gravity-ui/gateway/issues/38))

### Bug Fixes

* change default value for encodePathArgs option ([#38](https://github.com/gravity-ui/gateway/issues/38)) ([3bed876](https://github.com/gravity-ui/gateway/commit/3bed8769689eed9be97f50a425adf976340b9700))
* move originalError to debug field ([#39](https://github.com/gravity-ui/gateway/issues/39)) ([e8b9d87](https://github.com/gravity-ui/gateway/commit/e8b9d8769214da5c50ff06abc5213d6fc1eaccad))

## [1.6.0](https://github.com/gravity-ui/gateway/compare/v1.5.1...v1.6.0) (2024-02-06)


### Features

* enable option grpcRecreateService by default ([#36](https://github.com/gravity-ui/gateway/issues/36)) ([1682c4e](https://github.com/gravity-ui/gateway/commit/1682c4e5b934f87bc52d9b245797afcaa1ac20d4))

## [1.5.1](https://github.com/gravity-ui/gateway/compare/v1.5.0...v1.5.1) (2023-12-11)


### Bug Fixes

* catch background refresh errors ([b4f8157](https://github.com/gravity-ui/gateway/commit/b4f8157eb157f36c66c1758f85caeb7bf1f197e4))
* consider more params when caching reflection client ([c60bcc8](https://github.com/gravity-ui/gateway/commit/c60bcc81d634c3fae4ecefef3255385d66241aac))
* optimize cache keys ([4dd1e39](https://github.com/gravity-ui/gateway/commit/4dd1e39d20842ddf3ea7b5ba87c0eba29eb35c4b))
* remove failed reflection requests from cache ([665da2e](https://github.com/gravity-ui/gateway/commit/665da2e5847be5bb314e479b3938feae6e19c862))
* share grpc-options with reflection client ([8b8165e](https://github.com/gravity-ui/gateway/commit/8b8165e38912d81d6eb0316b6a1598b57419610c))

## [1.5.0](https://github.com/gravity-ui/gateway/compare/v1.4.0...v1.5.0) (2023-12-01)


### Features

* allow specifying includeProtoRoots for extension proto ([#32](https://github.com/gravity-ui/gateway/issues/32)) ([134abf7](https://github.com/gravity-ui/gateway/commit/134abf7915375a0cb9b1cee9a7501a6f6ff35ffc))

## [1.4.0](https://github.com/gravity-ui/gateway/compare/v1.3.1...v1.4.0) (2023-11-25)


### Features

* add ability to set responseType in ApiServiceRestActionConfig ([#30](https://github.com/gravity-ui/gateway/issues/30)) ([58bc7a4](https://github.com/gravity-ui/gateway/commit/58bc7a46efb7a88a1506149264f486af2dc96f7b))

## [1.3.1](https://github.com/gravity-ui/gateway/compare/v1.3.0...v1.3.1) (2023-11-22)


### Bug Fixes

* auto remove old patches ([#28](https://github.com/gravity-ui/gateway/issues/28)) ([3ad36da](https://github.com/gravity-ui/gateway/commit/3ad36dacc9ccf9b3c4e5a15c885768a449441ea3))

## [1.3.0](https://github.com/gravity-ui/gateway/compare/v1.2.2...v1.3.0) (2023-11-21)


### Features

* update grpc-related packages ([#26](https://github.com/gravity-ui/gateway/issues/26)) ([45d6872](https://github.com/gravity-ui/gateway/commit/45d6872c3a7b1fed04408803061d0a9c9c15fec7))

## [1.2.2](https://github.com/gravity-ui/gateway/compare/v1.2.1...v1.2.2) (2023-11-06)


### Bug Fixes

* update grpc-js package ([#24](https://github.com/gravity-ui/gateway/issues/24)) ([c8ac84e](https://github.com/gravity-ui/gateway/commit/c8ac84eb7ab2ecf0acae37b2d80ba1fa2663c289))

## [1.2.1](https://github.com/gravity-ui/gateway/compare/v1.2.0...v1.2.1) (2023-10-19)


### Bug Fixes

* update grpc-js package ([#22](https://github.com/gravity-ui/gateway/issues/22)) ([595f3ad](https://github.com/gravity-ui/gateway/commit/595f3adf6b9f837e63d8fbc80292da5b9d5a01f9))

## [1.2.0](https://github.com/gravity-ui/gateway/compare/v1.1.1...v1.2.0) (2023-10-09)


### Features

* pass an endpoint timeout to Axios config ([#19](https://github.com/gravity-ui/gateway/issues/19)) ([523bf2e](https://github.com/gravity-ui/gateway/commit/523bf2e7acfdeaec3c30eaade196df3a1bc19e3d))

## [1.1.1](https://github.com/gravity-ui/gateway/compare/v1.1.0...v1.1.1) (2023-09-28)


### Bug Fixes

* tune doc ([a24e5f8](https://github.com/gravity-ui/gateway/commit/a24e5f8cdc32d753bd7be4c172415bd97a87878b))

## [1.1.0](https://github.com/gravity-ui/gateway/compare/v1.0.5...v1.1.0) (2023-09-04)


### Features

* improve logging and processing errors ([#15](https://github.com/gravity-ui/gateway/issues/15)) ([80d4170](https://github.com/gravity-ui/gateway/commit/80d417082748b047809ac223fdc4f73eca0a78e3))

## [1.0.5](https://github.com/gravity-ui/gateway/compare/v1.0.4...v1.0.5) (2023-08-28)


### Bug Fixes

* correct patch file copy ([01e2588](https://github.com/gravity-ui/gateway/commit/01e258843270662e862fb0db49449aeb51d238e8))

## [1.0.4](https://github.com/gravity-ui/gateway/compare/v1.0.3...v1.0.4) (2023-08-22)


### Bug Fixes

* add types in package.json ([6bfba01](https://github.com/gravity-ui/gateway/commit/6bfba01d7389c7cb0cd763a804131b625a753a76))

## [1.0.3](https://github.com/gravity-ui/gateway/compare/v1.0.2...v1.0.3) (2023-08-22)


### Bug Fixes

* change param name ErrorConstructor ([2a62a4c](https://github.com/gravity-ui/gateway/commit/2a62a4c724e74732cdd995519d26856d385ddfc1))

## [1.0.2](https://github.com/gravity-ui/gateway/compare/v1.0.1...v1.0.2) (2023-08-20)


### Bug Fixes

* rename patch name ([944a973](https://github.com/gravity-ui/gateway/commit/944a9738cd539f8494ed59bced24f2aaae9d21ff))

## [1.0.1](https://github.com/gravity-ui/gateway/compare/v1.0.0...v1.0.1) (2023-08-20)


### Bug Fixes

* downgrade libraries versions ([3b11a73](https://github.com/gravity-ui/gateway/commit/3b11a735596feb8623d475370da4c0ad97e6c4f8))

## 1.0.0 (2023-08-18)


### Features

* first version ([3b224b1](https://github.com/gravity-ui/gateway/commit/3b224b1657ee75c2f554589c7db91673823572a4))
