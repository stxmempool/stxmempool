# The Stxmempool Open Source Project

Stxmempool is an adaptation of The Mempool Open Source Project™. Stxmempool is a mempool visualizer for the the Stacks blockchain ecosystem. A live site is available at [stxmempool.space](https://stxmempool.space/).

The open-source project is developed and operated for the benefit of the Bitcoin and Stacks community, with a focus on the emerging transaction fee market.

![mempool](https://stxmempool.space/resources/screenshots/stacks-v1.1-dashboard.png)

# System Requirements

## Operating System

This repo was developed on a M1 Macbook Pro. We suggest using Linux or Mac OS. However, there are limitations with M1 chips, see below.

### Running a fully independant instance

Running a full independant instance requires running a local Hiro API, Stacks Blockchain node, and a Bitcoin node. This can be done on a Linux distro.

DO NOT ATTEMPT to host a local Hiro API with an Apple M1 chip. There are serious I/O issues with the Hiro API on a M1 chip.

However, a Bitcoin node and a Stacks node can be run on an M1.

### Using the Hiro public node

For miminal setup, one can use the public Hiro API and skip the neccesity of a Stacks node. This setup is M1 friendly and only requires a BTC node for difficulty adjustments.

## Memory

A minimum of 8 GB is suggested. If you decide to run a full Hiro API and a local Stacks Blockchain node, you will need more.

## Storage

Storage: Anywhere from 15 GB to over 700 GB

### Minimal Storage Example

If you are running completely on the public Hiro API, then you will just need a Bitcoin node and space for this repo. The space you designate for the Bitcoin node is up to you.

### Stacks Development Example (using public Hiro API)

- Pruned BTC node: ~15GB
- Stxmempool Repo: ~2.5GB

### Full instance with an ability to launch mempool.space or stxmempool.space

- Full BTC node with indexing enabled: ~550GB

- Synced Stacks node: 80GB+

- Synced local API: ~30GB

This setup will allow you to work with mempool.space and stxmempool.space.

# Installation Methods

Currently Stxmempool supports a local installation with limited production support. Stxmempool is primarily focused on development. Later we wish to provide more support to non-developers.

This codebase does not support the functionality to switch between networks like mempool.space does (i.e. click a dropdown memu and switch to a locally hosted memmpool.space, bisq.markets or liquid.network). The following guide will help you setup a enviroment similar to [stxmempool.space](https://stxmempool.space/).

## Backend

### 1. Clone Stxmempool Repository

Get the latest Stxmempool code:

```
git clone https://github.com/stxmempool/stxmempool
cd mempool
```
### 2. Configure Bitcoin Core

If you want to run mempool.space, set `txindex` to `1`. Otherwise, just enable RPC, and set RPC credentials in `bitcoin.conf`:

```
txindex=0
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

### 4. Prepare Stxmempool Backend

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
    "DEDICATED_API_URL": "http://localhost:3999",
    "STACKS_INSPECT": {
      "PATH_TO_STACKS_INSPECT": "path/to/debug/stacks-inspect",
      "ARGUMENTS": ["try-mine", "path/to/chaindata/", "10", "30000"],
      "ENV": {
        "env": {
          "STACKS_LOG_JSON": "1"
        }
      }
    }
  }
```


`STACKS-INSPECT` is a work in progress, leave as placeholder strings for now.


In particular, make sure:
- the correct Bitcoin Core RPC credentials are specified in `CORE_RPC`
- set `BACKEND` in `MEMPOOL` to "none"
- set `ENABLED` in `MEMPOOL` to false 
- the correct `SOCKET` path is specified in `DATABASE`

### 5. Run Stxempool Backend

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

### 1. Clone Stxmempool Repository

Get the latest Stxmempool code:

```
git clone https://github.com/stxmempool/stxmempool
cd mempool
```
### 2. Configure the Frontend

Copy frontend config:

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

To run your local Stxmempool frontend with your local Stxmempool backend:

```
npm run serve
```
