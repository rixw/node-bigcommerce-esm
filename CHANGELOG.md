4.0.0

## 5.0.2

### Patch Changes

- 38e6431: Move testing module to dev dependencies

## 5.0.1

### Patch Changes

- # 70642b7: First changeset
- [breaking] Updated to `async/await`
- [breaking] Removed body from error text, added as property in error (#62)
- [breaking] Added gzip support (#60)

  # 3.0.0

- Removed all callbacks, only Promise is supported now.
- Removed `authorise` method in favor of `authorize`.
- Removed `callback` method, `verify` will now throw an Error.
- Removed the logger, use `DEBUG=node-bigcommerce:*` as an environment variable to get debug messages.
- Dropped support of node-v4 for missing `class` implementation.
- Removed [catalogue](https://github.com/getconversio/node-bigcommerce/pull/18) hack, please use `apiVersion` configuration property.
