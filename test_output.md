MacBookPro:ragestate tyrelle$ npm test

> ragestate-app@2.0.0 test
> jest

 FAIL  tests/realtimeDbSync.test.ts
  ● Console

    console.error
      Sync error at users/123/profile: {
        code: 'permission-denied',
        message: 'Test error',
        timestamp: 1750825343502,
        path: 'users/123/profile',
        retryCount: 2,
        originalError: Error: Test error
            at Object.<anonymous> (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/tests/realtimeDbSync.test.ts:66:25)
            at Promise.then.completed (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/utils.js:298:28)
            at new Promise (<anonymous>)
            at callAsyncCircusFn (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/utils.js:231:10)
            at _callCircusTest (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:316:40)
            at _runTest (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:252:3)
            at _runTestsForDescribeBlock (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:126:9)
            at _runTestsForDescribeBlock (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:121:9)
            at _runTestsForDescribeBlock (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:121:9)
            at run (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:71:3)
            at runAndTransformResultsToJestFormat (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapterInit.js:122:21)
            at jestAdapter (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapter.js:79:19)
            at runTestInternal (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-runner/build/runTest.js:367:16)
            at runTest (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-runner/build/runTest.js:444:34) {
          code: 'permission-denied'
        }
      }

      240 |     options.onError(syncError);
      241 |   } else {
    > 242 |     console.error(`Sync error at ${path}:`, syncError);
          |             ^
      243 |   }
      244 |
      245 |   return syncError;

      at error (src/utils/realtimeDbSync.ts:242:13)
      at Object.<anonymous> (tests/realtimeDbSync.test.ts:69:40)

    console.log
      Retrying operation at test/path in 10.28347919517595ms (attempt 1/2)

      at log (src/utils/realtimeDbSync.ts:298:17)
          at _loop.throw (<anonymous>)
          at Generator.throw (<anonymous>)

    console.log
      Retrying operation at test/path in 21.50386501008894ms (attempt 2/2)

      at log (src/utils/realtimeDbSync.ts:298:17)
          at _loop.throw (<anonymous>)
          at Generator.throw (<anonymous>)

    console.error
      Sync error at test/path: {
        code: 'unknown',
        message: 'Always fails',
        timestamp: 1750825343585,
        path: 'test/path',
        retryCount: 2,
        originalError: Error: Always fails
            at Object.<anonymous> (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/tests/realtimeDbSync.test.ts:119:28)
            at Generator.next (<anonymous>)
            at asyncGeneratorStep (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
            at _next (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/@babel/runtime/helpers/asyncToGenerator.js:17:9)
            at /Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/@babel/runtime/helpers/asyncToGenerator.js:22:7
            at new Promise (<anonymous>)
            at Object.<anonymous> (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/@babel/runtime/helpers/asyncToGenerator.js:14:12)
            at Promise.then.completed (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/utils.js:298:28)
            at new Promise (<anonymous>)
            at callAsyncCircusFn (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/utils.js:231:10)
            at _callCircusTest (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:316:40)
            at _runTest (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:252:3)
            at _runTestsForDescribeBlock (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:126:9)
            at _runTestsForDescribeBlock (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:121:9)
            at _runTestsForDescribeBlock (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:121:9)
            at run (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/run.js:71:3)
            at runAndTransformResultsToJestFormat (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapterInit.js:122:21)
            at jestAdapter (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapter.js:79:19)
            at runTestInternal (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-runner/build/runTest.js:367:16)
            at runTest (/Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/jest-runner/build/runTest.js:444:34)
      }

      240 |     options.onError(syncError);
      241 |   } else {
    > 242 |     console.error(`Sync error at ${path}:`, syncError);
          |             ^
      243 |   }
      244 |
      245 |   return syncError;

      at error (src/utils/realtimeDbSync.ts:242:13)
      at handleSyncError (src/utils/realtimeDbSync.ts:311:21)
          at Generator.throw (<anonymous>)
      at asyncGeneratorStep (node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
      at _throw (node_modules/@babel/runtime/helpers/asyncToGenerator.js:20:9)

  ● Realtime Database Sync Utilities › executeWithRetry › should throw after maximum retries

    expect(received).rejects.toMatchObject(expected)

    - Expected  - 1
    + Received  + 1

      Object {
    -   "code": "unknown-error",
    +   "code": "unknown",
        "message": "Always fails",
        "retryCount": 2,
      }

      125 |           maxBackoffDelay: 50,
      126 |         })
    > 127 |       ).rejects.toMatchObject({
          |                 ^
      128 |         code: "unknown-error",
      129 |         message: "Always fails",
      130 |         retryCount: 2,

      at Object.toMatchObject (node_modules/expect/build/index.js:218:22)
      at Object.toMatchObject (tests/realtimeDbSync.test.ts:127:17)
      at asyncGeneratorStep (node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
      at _next (node_modules/@babel/runtime/helpers/asyncToGenerator.js:17:9)
      at node_modules/@babel/runtime/helpers/asyncToGenerator.js:22:7
      at Object.<anonymous> (node_modules/@babel/runtime/helpers/asyncToGenerator.js:14:12)

 PASS  src/__tests__/utils/spacing.test.ts
 FAIL  tests/paginationHandler.test.ts
  ● Test suite failed to run

    Jest encountered an unexpected token

    Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.

    Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.

    By default "node_modules" folder is ignored by transformers.

    Here's what you can do:
     • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
     • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
     • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
     • If you need a custom transformation specify a "transform" option in your config.
     • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.

    You'll find more details and examples of these config options in the docs:
    https://jestjs.io/docs/configuration
    For information about custom transformations, see:
    https://jestjs.io/docs/code-transformation

    Details:

    /Users/tyrelle/Desktop/RS APP 2.0/rs-app/ragestate/node_modules/firebase/firestore/dist/esm/index.esm.js:1
    ({"Object.<anonymous>":function(module,exports,require,__dirname,__filename,jest){export * from '@firebase/firestore';
                                                                                      ^^^^^^

    SyntaxError: Unexpected token 'export'

      13 | // Mock Firestore
      14 | jest.mock("firebase/firestore", () => {
    > 15 |   const originalModule = jest.requireActual("firebase/firestore");
         |                               ^
      16 |
      17 |   // Mock documents for testing
      18 |   const mockDocs = Array(20)

      at Runtime.createScriptFromCode (node_modules/jest-runtime/build/index.js:1505:14)
      at requireActual (tests/paginationHandler.test.ts:15:31)
      at Object.require (src/utils/paginationHandler.ts:8:1)
      at Object.require (tests/paginationHandler.test.ts:5:1)

Test Suites: 2 failed, 1 passed, 3 total
Tests:       1 failed, 11 passed, 12 total
Snapshots:   0 total
Time:        0.56 s, estimated 1 s
Ran all test suites.