# CULT — Deployment Guide

## Prerequisites

- Aptos CLI installed: `curl -fsSL "https://aptos.dev/scripts/install_aptos.sh" | sh`
- Node.js 18+
- Petra Wallet browser extension
- Funded testnet account (use Aptos faucet: https://aptoslabs.com/testnet-faucet)

---

## 1. Deploy the Move Contract

### 1a. Init your Aptos account (if not done)

```bash
cd cult/move
aptos init --network testnet
```

This creates `.aptos/config.yaml` with your account address. Fund it on the faucet.

### 1b. Update Move.toml

Replace `cult = "_"` with your actual account address:

```toml
[addresses]
cult = "0xYOUR_ACCOUNT_ADDRESS"
```

### 1c. Initialize the platform

The `initialize_platform` entry function must be called once by the deployer.
It sets up the `PlatformConfig` resource under your address, which receives the 5% fee.

### 1d. Compile and deploy

```bash
aptos move compile
aptos move publish --named-addresses cult=0xYOUR_ACCOUNT_ADDRESS
```

Note the transaction hash and verify on https://explorer.aptoslabs.com/?network=testnet

### 1e. Call initialize_platform

```bash
aptos move run \
  --function-id 0xYOUR_ADDRESS::cult::initialize_platform \
  --sender-account default
```

---

## 2. Configure the Frontend

```bash
cd cult/frontend
cp .env.example .env
```

Edit `.env`:

```env
VITE_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_ADDRESS
VITE_PLATFORM_ADDRESS=0xYOUR_PLATFORM_WALLET_ADDRESS
VITE_SHELBY_GATEWAY=https://gateway.shelby.network
VITE_SHELBY_API_KEY=your_shelby_key
```

> Note: `VITE_CONTRACT_ADDRESS` and `VITE_PLATFORM_ADDRESS` are typically the same address
> (the deployer account), unless you want a separate platform treasury wallet.

---

## 3. Run the Frontend Locally

```bash
npm install
npm run dev
```

Opens at http://localhost:3000

---

## 4. Connect Shelby Serves

Shelby Serves is a decentralized hot storage protocol by Aptos Labs + Jump Crypto.

1. Get API access at https://geomi.dev/
2. Set `VITE_SHELBY_API_KEY` and `VITE_SHELBY_GATEWAY` in your `.env`
3. Without a key, the app falls back to **mock mode** for local dev:
   - Files get a fake CID (`bafybeimock...`)
   - Images are previewed via object URLs

### How Shelby integration works in Cult

| Action | What happens |
|---|---|
| Creator uploads content | File sent to Shelby → returns CID → stored on-chain via `publish_content` |
| Fan loads free content | Frontend calls `getShelbyPublicUrl(cid)` directly |
| Fan loads gated content | Frontend verifies on-chain access → requests Shelby read token with wallet signature → plays content via token URL |

---

## 5. Deploy to Production (Vercel)

```bash
npm install -g vercel
vercel --prod
```

Add environment variables in Vercel dashboard:
- `VITE_CONTRACT_ADDRESS`
- `VITE_PLATFORM_ADDRESS`
- `VITE_SHELBY_GATEWAY`
- `VITE_SHELBY_API_KEY`

---

## 6. Adding an Indexer (for Explore page)

The Explore page currently shows mock data. To show real creators:

**Option A — Aptos Indexer GraphQL**
Query `account_resources` filtered by resource type `{CONTRACT}::cult::CreatorProfile`

**Option B — The Graph**
Write a subgraph that indexes `ContentPublishedEvent` and `SubscribeEvent` from your contract.

**Option C — Simple backend**
A lightweight Node.js service that listens to Aptos events and caches creator addresses.

---

## 7. Move Contract: Key Flows Summary

```
Creator:
  register_creator(handle, displayName, bio, avatarCid, bannerCid, tiers...)
  publish_content(type, title, desc, shelbyCid, thumbnailCid, accessLevel, price)
  toggle_content(contentId)
  update_profile(displayName, bio, avatarCid, bannerCid)

Fan:
  subscribe(creatorAddr, tierIndex, platformAddr)       → pays 1 month APT
  renew_subscription(creatorAddr, platformAddr)         → extends 30 days
  purchase_content(creatorAddr, contentId, platformAddr) → unlocks content forever
  tip_creator(creatorAddr, amount, message, platformAddr)

Views (no gas):
  has_active_subscription(fanAddr, creatorAddr) → (bool, tierIndex, expiresAt)
  has_purchased_content(fanAddr, creatorAddr, contentId) → bool
  can_access_content(fanAddr, creatorAddr, contentId) → bool
  get_creator_tier_count(creatorAddr) → u64
  get_platform_stats(platformAddr) → (totalVolume, totalFees)
```

---

## 8. File Structure

```
cult/
├── README.md
├── package-lock.json
├── move/
│   ├── Move.toml
│   ├── .aptos/
│   │   └── config.yaml
│   ├── sources/
│   │   └── cult.move
│   └── build/
│       └── cult/
│           ├── BuildInfo.yaml
│           ├── bytecode_modules/
│           ├── source_maps/
│           └── sources/
│
└── frontend/
    ├── .env.example
    ├── .env
    ├── .env.local
    ├── .gitignore
    ├── .npmrc
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vercel.json
    ├── vite.config.ts
    ├── api/
    │   ├── delete-shelby-blob.js
    │   └── scheduled-publish.js
    ├── public/
    │   ├── icon-192.png
    │   ├── icon-512.png
    │   ├── manifest.json
    │   ├── offline.html
    │   └── sw.js
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── polyfills.ts
        ├── vite-env.d.ts
        ├── hooks/
        ├── wallet/
        │   └── WalletProvider.tsx
        ├── lib/
        │   ├── aptos-core.ts
        │   ├── aptos-read.ts
        │   ├── aptos-write.ts
        │   ├── aptos-types.ts
        │   ├── aptos.ts
        │   ├── shelby-read.ts
        │   ├── shelby-write.ts
        │   ├── shelby.ts
        │   ├── store.ts
        │   └── constants.ts
        ├── pages/
        │   ├── Home.tsx
        │   ├── Explore.tsx
        │   ├── CreatorPage.tsx
        │   ├── Dashboard.tsx
        │   ├── FanProfile.tsx
        │   ├── Feed.tsx
        │   └── Notifications.tsx
        └── components/
            ├── AutoRenewBanner.tsx
            ├── CommentSection.tsx
            ├── ContentViewer.tsx
            ├── DynamicBackground.tsx
            ├── EditContentModal.tsx
            ├── EditProfileModal.tsx
            ├── FollowButton.tsx
            ├── FollowingFeed.tsx
            ├── GiftSubscriptionModal.tsx
            ├── Layout.tsx
            ├── LoveButton.tsx
            ├── NotificationsPopup.tsx
            ├── RegisterCreatorModal.tsx
            ├── SaveButton.tsx
            ├── TipModal.tsx
            ├── UploadContentModal.tsx
            └── UserProfileModal.tsx
```
