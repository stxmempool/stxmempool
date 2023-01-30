# The Stxmempool Open Source Project

Stxmempool is an adaptation of the The Mempool Open Source Project™. Stxmempool is a mempool visualizer for the the Stacks blockchain ecosystem. A live site is available at [stxmempool.space](https://stxmempool.space/).

It is an open-source project developed and operated for the benefit of the Bitcoin and Stacks community, with a focus on the emerging transaction fee market.

![mempool](https://mempool.space/resources/screenshots/stacks-v1.1-dashboard.png)

# Installation Methods

Currently Stxmempool supports a local installation with limited production support. Stxmempool is primarily focused on development. Later we wish to provide more support to non-developers.

This codebase does not support being able to switch between networks like The Mempool Open Source Project™. The following guide will help you setup a enviroment similar to [stxmempool.space](https://stxmempool.space/).

## Backend


### 1. Clone Mempool Repository

Get the latest Stxmempool code:

```
git clone https://github.com/stxmempool/stxmempool
cd mempool
```
### 2. Configure Bitcoin Core

Turn on `txindex`, enable RPC, and set RPC credentials in `bitcoin.conf`:

```
txindex=1
server=1
rpcuser=mempool
rpcpassword=mempool
```

### 3. Configure MariaDB

_Mempool needs MariaDB v10.5 or later. If you already have MySQL installed, make sure to migrate any existing databases **before** installing MariaDB._

Get MariaDB from your operating system's package manager:

```
# Debian, Ubuntu, etc.
apt-get install mariadb-server mariadb-client

# macOS
brew install mariadb
mysql.server start
```

Create a database and grant privileges:

```
MariaDB [(none)]> drop database mempool;
Query OK, 0 rows affected (0.00 sec)

MariaDB [(none)]> create database mempool;
Query OK, 1 row affected (0.00 sec)

MariaDB [(none)]> grant all privileges on mempool.* to 'mempool'@'%' identified by 'mempool';
Query OK, 0 rows affected (0.00 sec)
```

### 4. Prepare Mempool Backend

#### Build

_Make sure to use Node.js 16.10 and npm 7._

Install dependencies with `npm` and build the backend:

```
cd backend
npm install
npm run build
```

#### Configure

In the backend folder, make a copy of the sample config file:

```
cp mempool-config.sample.json mempool-config.json
```

Edit `mempool-config.json` as needed.

Set `INDEXING_BLOCKS_AMOUNT` in either `MEMPOOL` or `STACKS` to `0` to disable indexing or `-1` to index all blocks.

Here is a example of the `STACKS` block that has block indexing enabled for up to 10 blocks off of the current chain tip, block summaries indexing enabled, and does not have a dedicated local [stacks-blockchain-api](https://github.com/hirosystems/stacks-blockchain-api):
```
  "STACKS": {
    "ENABLED": true,
    "BLOCK_MAX_RUNTIME": 5000000000,
    "BLOCK_MAX_READ_COUNT": 15000,
    "BLOCK_MAX_READ_LENGTH": 100000000,
    "BLOCK_MAX_WRITE_COUNT": 15000,
    "BLOCK_MAX_WRITE_LENGTH": 15000000,
    "BLOCK_MAX_SIZE": 2000000,
    "INITIAL_BLOCKS_AMOUNT": 8,
    "MEMPOOL_BLOCKS_AMOUNT": 8,
    "BLOCKS_SUMMARIES_INDEXING": true,
    "INDEXING_BLOCKS_AMOUNT": 10,
    "DEDICATED_API": false,
    "DEDICATED_API_URL": "http://localhost:3999"
  }
```

In particular, make sure:
- the correct Bitcoin Core RPC credentials are specified in `CORE_RPC`
- set `BACKEND` in `MEMPOOL` to "none"
- set `ENABLED` in `MEMPOOL` to false 
- the correct `SOCKET` path is specified in `DATABASE`

### 6. Run Stxempool Backend

Run the Stxmempool backend:

```
npm run start
```
You can also set env var `MEMPOOL_CONFIG_FILE` to specify a custom config file location:
```
MEMPOOL_CONFIG_FILE=/path/to/mempool-config.json npm run start
```

For development purposes use the following command after making changes:
```
npm run build && npm run start
```

Everytime you make changes and rebuild the backend, it will requery the past number of blocks set in the mempool-config file under `"INITIAL_BLOCKS_AMOUNT": 8` in `STACKS`, and resync the mempool. Setting this to `1` or `2` can be very helpful for a faster restart.

## Frontend

### 1. Clone Mempool Repository

Get the latest Stxmempool code:

```
git clone https://github.com/stxmempool/stxmempool
cd mempool
```
### 2. Configure the Frontend

Copy frontend config

```
cd frontend
cp mempool-frontend-config.sample.json mempool-frontend-config.json
```

Modify the config to match this setup:

```
  "TESTNET_ENABLED": false,
  "SIGNET_ENABLED": false,
  "LIQUID_ENABLED": false,
  "LIQUID_TESTNET_ENABLED": false,
  "BISQ_ENABLED": false,
  "BISQ_SEPARATE_BACKEND": false,
  "STACKS_ENABLED": true,
  "ITEMS_PER_PAGE": 10,
  "KEEP_BLOCKS_AMOUNT": 8,
  "NGINX_PROTOCOL": "http",
  "NGINX_HOSTNAME": "127.0.0.1",
  "NGINX_PORT": "80",
  "BLOCK_WEIGHT_UNITS": 4000000,
  "MEMPOOL_BLOCKS_AMOUNT": 8,
  "BASE_MODULE": "stacks",
  "MEMPOOL_WEBSITE_URL": "https://mempool.space",
  "LIQUID_WEBSITE_URL": "https://liquid.network",
  "BISQ_WEBSITE_URL": "https://bisq.markets",
  "STACKS_WEBSITE_URL": "https://stxmempool.space",
  "MINING_DASHBOARD": false,
  "MAINNET_BLOCK_AUDIT_START_HEIGHT": 0,
  "TESTNET_BLOCK_AUDIT_START_HEIGHT": 0,
  "SIGNET_BLOCK_AUDIT_START_HEIGHT": 0,
  "LIGHTNING": false
```

### 3. Build the Frontend

_Make sure to use Node.js 16.10 and npm 7._

Build the frontend:

```
npm install
npm run build
```

#### Development

To run your local Stxmempool frontend with your local StxMempool backend:

```
npm run serve
```

#### Production

The `npm run build` command from step 1 above should have generated a `dist` directory. Put the contents of `dist/` onto your web server.

You will probably want to set up a reverse proxy, TLS, etc. There are sample nginx configuration files in the top level of the repository for reference, but note that support for such tasks is outside the scope of this project.