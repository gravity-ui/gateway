# Changelog

## [4.9.0](https://github.com/gravity-ui/gateway/compare/v4.8.0...v4.9.0) (2025-07-10)


### Features

* add mTLS support for gRPC connections ([#137](https://github.com/gravity-ui/gateway/issues/137)) ([6fd619e](https://github.com/gravity-ui/gateway/commit/6fd619eb6c91eba2080667235ad9adfc4bb31696))

## [4.8.0](https://github.com/gravity-ui/gateway/compare/v4.7.2...v4.8.0) (2025-07-02)


### Features

* allow set service level getAuthArgs and getAuthHeaders ([#143](https://github.com/gravity-ui/gateway/issues/143)) ([fc41d3c](https://github.com/gravity-ui/gateway/commit/fc41d3cb73c1c71d7df3603b7db4aa1fc35e125a))

## [4.7.2](https://github.com/gravity-ui/gateway/compare/v4.7.1...v4.7.2) (2025-06-18)


### Bug Fixes

* update serviceOptions with a fresh deadline for each attempt ([#140](https://github.com/gravity-ui/gateway/issues/140)) ([549fae0](https://github.com/gravity-ui/gateway/commit/549fae0096463e37001cb37c5501653ca302e3de))

## [4.7.1](https://github.com/gravity-ui/gateway/compare/v4.7.0...v4.7.1) (2025-06-09)


### Bug Fixes

* handle invalid unicode in path parameter encoding ([#138](https://github.com/gravity-ui/gateway/issues/138)) ([4a6bae6](https://github.com/gravity-ui/gateway/commit/4a6bae6d001d3a735c06a0c7416a6b9d67bad24d))

## [4.7.0](https://github.com/gravity-ui/gateway/compare/v4.6.0...v4.7.0) (2025-04-09)


### Features

* add third argument (`extra`) in proxyHeaders function ([e3dbb14](https://github.com/gravity-ui/gateway/commit/e3dbb14498f0ac7db444eeccc8ae096fdd84a0c9))

## [4.6.0](https://github.com/gravity-ui/gateway/compare/v4.5.0...v4.6.0) (2025-04-04)


### Features

* support cancelling request on disconnect ([#114](https://github.com/gravity-ui/gateway/issues/114)) ([31e540d](https://github.com/gravity-ui/gateway/commit/31e540d91b1ad947bdb321faddab73c30833c03d))

## [4.5.0](https://github.com/gravity-ui/gateway/compare/v4.4.0...v4.5.0) (2025-03-28)


### Features

* support custom axios-retry-confition for rest actions ([#126](https://github.com/gravity-ui/gateway/issues/126)) ([917cf1b](https://github.com/gravity-ui/gateway/commit/917cf1b30bbf8d4d6daaa731b257c28163530d22))

## [4.4.0](https://github.com/gravity-ui/gateway/compare/v4.3.0...v4.4.0) (2025-03-17)


### Features

* log error for retries ([#117](https://github.com/gravity-ui/gateway/issues/117)) ([8d3958b](https://github.com/gravity-ui/gateway/commit/8d3958b623781b7990b28736450c95c6af4defa5))

## [4.3.0](https://github.com/gravity-ui/gateway/compare/v4.2.1...v4.3.0) (2025-03-13)


### Features

* export isRetryableError function ([#116](https://github.com/gravity-ui/gateway/issues/116)) ([37b1b49](https://github.com/gravity-ui/gateway/commit/37b1b492e5e3f7849acd327572c7f90df8f27d97))

## [4.2.1](https://github.com/gravity-ui/gateway/compare/v4.2.0...v4.2.1) (2025-02-20)


### Bug Fixes

* add [@type](https://github.com/type) field to decoded grpc message ([#110](https://github.com/gravity-ui/gateway/issues/110)) ([c7b93bc](https://github.com/gravity-ui/gateway/commit/c7b93bc34b52cd5cfd99012f940ba3d4f2632c47))

## [4.2.0](https://github.com/gravity-ui/gateway/compare/v4.1.0...v4.2.0) (2025-02-14)


### Features

* custom retries ([#107](https://github.com/gravity-ui/gateway/issues/107)) ([6cc9775](https://github.com/gravity-ui/gateway/commit/6cc9775d72ebf86f67f543a47317ca77391d6a24))

## [4.1.0](https://github.com/gravity-ui/gateway/compare/v4.0.0...v4.1.0) (2025-02-11)


### Features

* add option to override decodeAnyMessage default proto loader options ([#98](https://github.com/gravity-ui/gateway/issues/98)) ([#106](https://github.com/gravity-ui/gateway/issues/106)) ([15f955f](https://github.com/gravity-ui/gateway/commit/15f955f443e5385f6855ea0addd436b38ba008c5))

## [4.0.0](https://github.com/gravity-ui/gateway/compare/v3.1.1...v4.0.0) (2025-01-30)


### ⚠ BREAKING CHANGES

* replace default export from the library with named export ([#99](https://github.com/gravity-ui/gateway/issues/99))

### Bug Fixes

* replace default export from the library with named export ([#99](https://github.com/gravity-ui/gateway/issues/99)) ([1bb0580](https://github.com/gravity-ui/gateway/commit/1bb058000f857a5ffb2cdc7887d839bbe68ae832))

## [3.1.1](https://github.com/gravity-ui/gateway/compare/v3.1.0...v3.1.1) (2024-10-29)


### Bug Fixes

* type for traceId for compatible with nodekit context ([#94](https://github.com/gravity-ui/gateway/issues/94)) ([56835fd](https://github.com/gravity-ui/gateway/commit/56835fd7e4c46354109576d365516ed80ca530fe))

## [3.1.0](https://github.com/gravity-ui/gateway/compare/v3.0.4...v3.1.0) (2024-10-21)


### Features

* **rest:** add ability to add axios interceptors in config ([#92](https://github.com/gravity-ui/gateway/issues/92)) ([766b150](https://github.com/gravity-ui/gateway/commit/766b150901460de2224962c3fc1e2d5858c84401))

## [3.0.4](https://github.com/gravity-ui/gateway/compare/v3.0.3...v3.0.4) (2024-10-17)


### Bug Fixes

* use onRetry function instead of interceptors for setting x-request-attempt header ([#90](https://github.com/gravity-ui/gateway/issues/90)) ([18c2574](https://github.com/gravity-ui/gateway/commit/18c2574cd2b69468e28991b218e827e7c35442ef))

## [3.0.3](https://github.com/gravity-ui/gateway/compare/v3.0.2...v3.0.3) (2024-10-04)


### Bug Fixes

* tune release flow ([#86](https://github.com/gravity-ui/gateway/issues/86)) ([6ddda46](https://github.com/gravity-ui/gateway/commit/6ddda460a9406acd0121203eb7e9d2c88c304288))

## [3.0.2](https://github.com/gravity-ui/gateway/compare/v3.0.1...v3.0.2) (2024-09-30)


### Bug Fixes

* bump object-sizeof to 2.6.5 ([#82](https://github.com/gravity-ui/gateway/issues/82)) ([21db43f](https://github.com/gravity-ui/gateway/commit/21db43fea90fc5f805f7a1aa55f26731928e20b9))

## [3.0.1](https://github.com/gravity-ui/gateway/compare/v3.0.0...v3.0.1) (2024-09-17)


### Bug Fixes

* **rest:** setup axios config ([#79](https://github.com/gravity-ui/gateway/issues/79)) ([29768df](https://github.com/gravity-ui/gateway/commit/29768dfdb15459a0492fe04cf849021662ccc4c1))

## [3.0.0](https://github.com/gravity-ui/gateway/compare/v2.6.0...v3.0.0) (2024-09-02)


### ⚠ BREAKING CHANGES

* use toObject when decoding "Any" messages ([#77](https://github.com/gravity-ui/gateway/issues/77))

### Features

* use toObject when decoding "Any" messages ([#77](https://github.com/gravity-ui/gateway/issues/77)) ([805ff27](https://github.com/gravity-ui/gateway/commit/805ff27a99c7345e3d9dd135b074111c82be102a))

## [2.6.0](https://github.com/gravity-ui/gateway/compare/v2.5.4...v2.6.0) (2024-09-02)


### Features

* send extra params (responseSize, traceId, userId) to stats ([#60](https://github.com/gravity-ui/gateway/issues/60)) ([66c781f](https://github.com/gravity-ui/gateway/commit/66c781f218c42bbc8dee8df45d0eb9fc273c5c95))


### Bug Fixes

* revert potential breaking changes ([#74](https://github.com/gravity-ui/gateway/issues/74)) ([eb9488f](https://github.com/gravity-ui/gateway/commit/eb9488f44180a82ac8307c53c6569ae26fc419c2))

## [2.5.4](https://github.com/gravity-ui/gateway/compare/v2.5.3...v2.5.4) (2024-08-27)


### Bug Fixes

* remove traverseAnyMessage helper ([#70](https://github.com/gravity-ui/gateway/issues/70)) ([685379b](https://github.com/gravity-ui/gateway/commit/685379b12b1b1000cfc15f9f3f0d8ce64125ad9b))

## [2.5.3](https://github.com/gravity-ui/gateway/compare/v2.5.2...v2.5.3) (2024-08-23)


### Bug Fixes

* correctly parse details in grpc error ([#67](https://github.com/gravity-ui/gateway/issues/67)) ([277a51b](https://github.com/gravity-ui/gateway/commit/277a51b3b104b753ffefa0db4ba88b132c06a0e7))

## [2.5.2](https://github.com/gravity-ui/gateway/compare/v2.5.1...v2.5.2) (2024-08-23)


### Bug Fixes

* use proto loader options for decoding "any" messages ([#64](https://github.com/gravity-ui/gateway/issues/64)) ([f544198](https://github.com/gravity-ui/gateway/commit/f544198dca8b3183271c038837ca3cdfdb07cde6))

## [2.5.1](https://github.com/gravity-ui/gateway/compare/v2.5.0...v2.5.1) (2024-08-04)


### Bug Fixes

* param error is returned more explicitly instead of an empty value ([#61](https://github.com/gravity-ui/gateway/issues/61)) ([8f95601](https://github.com/gravity-ui/gateway/commit/8f95601363a3908962e532995a8d661028bea116))

## [2.5.0](https://github.com/gravity-ui/gateway/compare/v2.4.0...v2.5.0) (2024-06-20)


### Features

* added ability to specify headers for timeout and retries count ([#54](https://github.com/gravity-ui/gateway/issues/54)) ([ee6d407](https://github.com/gravity-ui/gateway/commit/ee6d4070208eeed654b2cf391a00fb2c172ddb09))

## [2.4.0](https://github.com/gravity-ui/gateway/compare/v2.3.0...v2.4.0) (2024-04-17)


### Features

* add ability to customize debugHeaders via option proxyDebugHeaders ([#52](https://github.com/gravity-ui/gateway/issues/52)) ([d68411e](https://github.com/gravity-ui/gateway/commit/d68411e607cc5569110ee4a2b3ed86297273a055))

## [2.3.0](https://github.com/gravity-ui/gateway/compare/v2.2.0...v2.3.0) (2024-03-26)


### Features

* add ability to specify an array in expectedResponseContentType ([#48](https://github.com/gravity-ui/gateway/issues/48)) ([10580bd](https://github.com/gravity-ui/gateway/commit/10580bd1c09a6d4d48eeea83c7097ad13be651d2))

## [2.2.0](https://github.com/gravity-ui/gateway/compare/v2.1.0...v2.2.0) (2024-03-25)


### Features

* add ability to validate response content type in rest actions ([#43](https://github.com/gravity-ui/gateway/issues/43)) ([5233ee5](https://github.com/gravity-ui/gateway/commit/5233ee5f149bd887e842dc0a54e31d19d7032686))

## [2.1.0](https://github.com/gravity-ui/gateway/compare/v2.0.0...v2.1.0) (2024-02-27)


### Features

* add ability to return response headers ([#41](https://github.com/gravity-ui/gateway/issues/41)) ([b6578a7](https://github.com/gravity-ui/gateway/commit/b6578a7dd54fd9cc2d9dbe874677094e21773646))

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
