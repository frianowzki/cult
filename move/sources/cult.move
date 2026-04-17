/// Cult — Web3 Creator Platform on Aptos
/// Patreon-style monetization: subscriptions, purchases, tips
/// Content stored on Shelby Serves; access controlled on-chain
module cult::cult {
    use std::signer;
    use std::string::{Self, String};
    use std::vector;

    use aptos_framework::account;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};

    // ─── Error Codes ────────────────────────────────────────────────────────────

    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_NOT_CREATOR: u64 = 3;
    const E_CREATOR_NOT_FOUND: u64 = 4;
    const E_INVALID_TIER: u64 = 5;
    const E_ALREADY_SUBSCRIBED: u64 = 6;
    const E_NOT_SUBSCRIBED: u64 = 7;
    const E_SUBSCRIPTION_EXPIRED: u64 = 8;
    const E_CONTENT_NOT_FOUND: u64 = 9;
    const E_ALREADY_PURCHASED: u64 = 10;
    const E_NO_ACCESS: u64 = 11;
    const E_INSUFFICIENT_PAYMENT: u64 = 12;
    const E_INVALID_TIER_COUNT: u64 = 13;
    const E_NOT_PLATFORM: u64 = 14;
    const E_ZERO_AMOUNT: u64 = 15;
    const E_ALREADY_FOLLOWING: u64 = 16;
    const E_NOT_FOLLOWING: u64 = 17;
    const E_CANNOT_FOLLOW_SELF: u64 = 18;

    // ─── Constants ───────────────────────────────────────────────────────────────

    /// Platform fee: 5% = 500 basis points
    const PLATFORM_FEE_BPS: u64 = 500;
    const BPS_DENOMINATOR: u64 = 10000;

    /// Shelby USD fungible asset metadata object
    const SHELBY_USD_METADATA_ADDR: address = @0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1;

    /// Subscription duration: 30 days in seconds
    const SUBSCRIPTION_DURATION_SECS: u64 = 2592000;

    /// Content types
    const CONTENT_TYPE_VIDEO: u8 = 0;
    const CONTENT_TYPE_IMAGE: u8 = 1;
    const CONTENT_TYPE_AUDIO: u8 = 2;
    const CONTENT_TYPE_ARTICLE: u8 = 3;

    /// Access levels
    const ACCESS_FREE: u8 = 0;
    const ACCESS_TIER_1: u8 = 1;
    const ACCESS_TIER_2: u8 = 2;
    const ACCESS_TIER_3: u8 = 3;
    const ACCESS_PURCHASE: u8 = 4;

    // ─── Structs ─────────────────────────────────────────────────────────────────

    /// A subscription tier defined by the creator
    struct Tier has store, copy, drop {
        name: String,           // e.g. "Fan", "Member", "Inner Circle"
        price_per_month: u64, // Shelby USD base units (1 USD = 1e8)
        description: String,
    }

    /// A creator's profile and configuration
    struct CreatorProfile has key {
        creator_addr: address,
        handle: String,         // @handle
        display_name: String,
        bio: String,
        avatar_shelby_cid: String,  // Shelby CID for avatar
        banner_shelby_cid: String,  // Shelby CID for banner
        tiers: vector<Tier>,        // up to 3 tiers
        total_earned: u64,
        subscriber_count: u64,
        content_count: u64,
        created_at: u64,
        // Events
        subscribe_events: EventHandle<SubscribeEvent>,
        purchase_events: EventHandle<PurchaseEvent>,
        tip_events: EventHandle<TipEvent>,
        content_events: EventHandle<ContentPublishedEvent>,
    }

    /// A piece of content published by a creator
    struct Content has store, copy, drop {
        id: u64,
        content_type: u8,           // VIDEO, IMAGE, AUDIO, ARTICLE
        title: String,
        description: String,
        shelby_cid: String,         // Shelby CID for actual content
        thumbnail_shelby_cid: String,
        access_level: u8,           // FREE, TIER_1, TIER_2, TIER_3, PURCHASE
        purchase_price: u64, // Shelby USD base units, only used if access_level == PURCHASE
        published_at: u64,
        is_active: bool,
    }

    /// All content published by a creator
    struct ContentStore has key {
        contents: vector<Content>,
    }

    /// A fan's subscription to a specific creator
    struct Subscription has store, copy, drop {
        creator_addr: address,
        tier_index: u8,         // 0, 1, or 2
        expires_at: u64,        // Unix timestamp
        subscribed_at: u64,
    }

    /// All subscriptions a fan holds (across creators)
    struct FanSubscriptions has key {
        subscriptions: vector<Subscription>,
    }

    /// One-time purchases a fan has made
    struct FanPurchases has key {
        /// Encoded as creator_addr::content_id pairs tracked in a simple list
        purchases: vector<PurchaseRecord>,
    }

    struct PurchaseRecord has store, copy, drop {
        creator_addr: address,
        content_id: u64,
        purchased_at: u64,
    }

    /// Tracks who a fan is following
struct FollowStore has key {
    following: vector<address>,
    follow_events: EventHandle<FollowEvent>,
    unfollow_events: EventHandle<UnfollowEvent>,
}

/// Tracks a creator's follower count
struct FollowerStore has key {
    follower_count: u64,
}

    /// Platform treasury and config
    struct PlatformConfig has key {
        platform_addr: address,
        total_volume: u64,
        total_fees_collected: u64,
    }

    /// Global creator discovery registry
    struct CreatorRegistry has key {
        creators: vector<address>,
    }

    // ─── Events ──────────────────────────────────────────────────────────────────

    struct SubscribeEvent has drop, store {
        fan_addr: address,
        creator_addr: address,
        tier_index: u8,
        amount_paid: u64,
        expires_at: u64,
    }

    struct PurchaseEvent has drop, store {
        fan_addr: address,
        creator_addr: address,
        content_id: u64,
        amount_paid: u64,
    }

    struct TipEvent has drop, store {
        fan_addr: address,
        creator_addr: address,
        amount: u64,
        message: String,
    }

    struct FollowEvent has drop, store {
    fan_addr: address,
    creator_addr: address,
}

struct UnfollowEvent has drop, store {
    fan_addr: address,
    creator_addr: address,
}

    struct ContentPublishedEvent has drop, store {
        creator_addr: address,
        content_id: u64,
        content_type: u8,
        title: String,
        access_level: u8,
    }

    // ─── Platform Init ───────────────────────────────────────────────────────────

    /// Called once by the platform deployer
    public entry fun initialize_platform(platform: &signer) {
        let platform_addr = signer::address_of(platform);
        assert!(!exists<PlatformConfig>(platform_addr), E_ALREADY_INITIALIZED);

        move_to(platform, PlatformConfig {
            platform_addr,
            total_volume: 0,
            total_fees_collected: 0,
        });

        move_to(platform, CreatorRegistry {
            creators: vector::empty<address>(),
        });
    }

    public entry fun init_creator_registry(platform: &signer) {
        let platform_addr = signer::address_of(platform);
        assert!(exists<PlatformConfig>(platform_addr), E_NOT_INITIALIZED);
        assert!(!exists<CreatorRegistry>(platform_addr), E_ALREADY_INITIALIZED);

        move_to(platform, CreatorRegistry {
            creators: vector::empty<address>(),
        });
    }

    public entry fun backfill_creator_to_registry(
        platform: &signer,
        creator_addr: address,
    ) {
        let platform_addr = signer::address_of(platform);
        assert!(exists<PlatformConfig>(platform_addr), E_NOT_INITIALIZED);
        assert!(exists<CreatorRegistry>(platform_addr), E_NOT_INITIALIZED);
        assert!(exists<CreatorProfile>(creator_addr), E_NOT_CREATOR);

        let profile = borrow_global<CreatorProfile>(creator_addr);
        assert!(string::length(&profile.handle) > 0, E_NOT_CREATOR);

        let registry = borrow_global_mut<CreatorRegistry>(platform_addr);
        let len = vector::length(&registry.creators);
        let i = 0u64;

        while (i < len) {
            if (*vector::borrow(&registry.creators, i) == creator_addr) {
                return
            };
            i = i + 1;
        };

        vector::push_back(&mut registry.creators, creator_addr);
    }

    // ─── Creator Functions ───────────────────────────────────────────────────────

    /// Register as a creator with up to 3 tiers
        public entry fun register_creator(
        creator: &signer,
        handle: String,
        display_name: String,
        bio: String,
        avatar_shelby_cid: String,
        banner_shelby_cid: String,
        tier1_name: String,
        tier1_price: u64,
        tier1_desc: String,
        tier2_name: String,
        tier2_price: u64,
        tier2_desc: String,
        tier3_name: String,
        tier3_price: u64,
        tier3_desc: String,
    ) acquires CreatorProfile, ContentStore, CreatorRegistry {
        let creator_addr = signer::address_of(creator);

        let tiers = vector::empty<Tier>();

        vector::push_back(&mut tiers, Tier {
            name: tier1_name,
            price_per_month: tier1_price,
            description: tier1_desc,
        });

        if (string::length(&tier2_name) > 0) {
            vector::push_back(&mut tiers, Tier {
                name: tier2_name,
                price_per_month: tier2_price,
                description: tier2_desc,
            });
        };

        if (string::length(&tier3_name) > 0) {
            vector::push_back(&mut tiers, Tier {
                name: tier3_name,
                price_per_month: tier3_price,
                description: tier3_desc,
            });
        };

        if (!exists<CreatorProfile>(creator_addr)) {
            move_to(creator, CreatorProfile {
                creator_addr,
                handle,
                display_name,
                bio,
                avatar_shelby_cid,
                banner_shelby_cid,
                tiers,
                total_earned: 0,
                subscriber_count: 0,
                content_count: 0,
                created_at: timestamp::now_seconds(),
                subscribe_events: account::new_event_handle<SubscribeEvent>(creator),
                purchase_events: account::new_event_handle<PurchaseEvent>(creator),
                tip_events: account::new_event_handle<TipEvent>(creator),
                content_events: account::new_event_handle<ContentPublishedEvent>(creator),
            });

            move_to(creator, ContentStore {
                contents: vector::empty<Content>(),
            });
        } else {
            let profile = borrow_global_mut<CreatorProfile>(creator_addr);
            assert!(string::length(&profile.handle) == 0, E_ALREADY_INITIALIZED);

            profile.creator_addr = creator_addr;
            profile.handle = handle;
            profile.display_name = display_name;
            profile.bio = bio;
            profile.avatar_shelby_cid = avatar_shelby_cid;
            profile.banner_shelby_cid = banner_shelby_cid;
            profile.tiers = tiers;
            profile.total_earned = 0;
            profile.subscriber_count = 0;
            profile.content_count = 0;
            profile.created_at = timestamp::now_seconds();

            if (exists<ContentStore>(creator_addr)) {
                let store = borrow_global_mut<ContentStore>(creator_addr);
                store.contents = vector::empty<Content>();
            } else {
                move_to(creator, ContentStore {
                    contents: vector::empty<Content>(),
                });
            };
        };

                if (exists<CreatorRegistry>(@cult)) {
            let registry = borrow_global_mut<CreatorRegistry>(@cult);
            let len = vector::length(&registry.creators);
            let i = 0u64;
            let found = false;

            while (i < len) {
                if (*vector::borrow(&registry.creators, i) == creator_addr) {
                    found = true;
                    break
                };
                i = i + 1;
            };

            if (!found) {
                vector::push_back(&mut registry.creators, creator_addr);
            };
        };
    }

    /// Update creator profile metadata
    public entry fun update_profile(
        creator: &signer,
        display_name: String,
        bio: String,
        avatar_shelby_cid: String,
        banner_shelby_cid: String,
    ) acquires CreatorProfile {
        let creator_addr = signer::address_of(creator);
        assert!(exists<CreatorProfile>(creator_addr), E_NOT_CREATOR);

        let profile = borrow_global_mut<CreatorProfile>(creator_addr);
        profile.display_name = display_name;
        profile.bio = bio;
        profile.avatar_shelby_cid = avatar_shelby_cid;
        profile.banner_shelby_cid = banner_shelby_cid;
    }

    /// Update creator subscription tiers
    public entry fun update_tiers(
        creator: &signer,
        tier1_name: String,
        tier1_price: u64,
        tier1_desc: String,
        tier2_name: String,
        tier2_price: u64,
        tier2_desc: String,
        tier3_name: String,
        tier3_price: u64,
        tier3_desc: String,
    ) acquires CreatorProfile {
        let creator_addr = signer::address_of(creator);
        assert!(exists<CreatorProfile>(creator_addr), E_NOT_CREATOR);
        assert!(string::length(&tier1_name) > 0, E_INVALID_TIER_COUNT);

        let tiers = vector::empty<Tier>();

        vector::push_back(&mut tiers, Tier {
            name: tier1_name,
            price_per_month: tier1_price,
            description: tier1_desc,
        });

        if (string::length(&tier2_name) > 0) {
            vector::push_back(&mut tiers, Tier {
                name: tier2_name,
                price_per_month: tier2_price,
                description: tier2_desc,
            });
        };

        if (string::length(&tier3_name) > 0) {
            vector::push_back(&mut tiers, Tier {
                name: tier3_name,
                price_per_month: tier3_price,
                description: tier3_desc,
            });
        };

        let profile = borrow_global_mut<CreatorProfile>(creator_addr);
        profile.tiers = tiers;
    }

    /// Delete creator profile and remove from registry
        public entry fun delete_creator(
        creator: &signer,
    ) acquires CreatorProfile, ContentStore, CreatorRegistry {
        let creator_addr = signer::address_of(creator);
        assert!(exists<CreatorProfile>(creator_addr), E_NOT_CREATOR);

        let profile = borrow_global_mut<CreatorProfile>(creator_addr);
        profile.handle = string::utf8(b"");
        profile.display_name = string::utf8(b"");
        profile.bio = string::utf8(b"");
        profile.avatar_shelby_cid = string::utf8(b"");
        profile.banner_shelby_cid = string::utf8(b"");
        profile.tiers = vector::empty<Tier>();
        profile.total_earned = 0;
        profile.subscriber_count = 0;
        profile.content_count = 0;
        profile.created_at = 0;

        if (exists<ContentStore>(creator_addr)) {
            let store = borrow_global_mut<ContentStore>(creator_addr);
            store.contents = vector::empty<Content>();
        };

                if (exists<CreatorRegistry>(@cult)) {
            let registry = borrow_global_mut<CreatorRegistry>(@cult);
            let len = vector::length(&registry.creators);
            let i = 0u64;

            while (i < len) {
                if (*vector::borrow(&registry.creators, i) == creator_addr) {
                    vector::remove(&mut registry.creators, i);
                    return
                };
                i = i + 1;
            };
        };
    }

    /// Publish a new piece of content (Shelby CID stored on-chain)
    public entry fun publish_content(
        creator: &signer,
        content_type: u8,
        title: String,
        description: String,
        shelby_cid: String,
        thumbnail_shelby_cid: String,
        access_level: u8,
        purchase_price: u64,
    ) acquires CreatorProfile, ContentStore {
        let creator_addr = signer::address_of(creator);
        assert!(exists<CreatorProfile>(creator_addr), E_NOT_CREATOR);

        let profile = borrow_global_mut<CreatorProfile>(creator_addr);
        let content_id = profile.content_count;
        profile.content_count = content_id + 1;

        let store = borrow_global_mut<ContentStore>(creator_addr);
        vector::push_back(&mut store.contents, Content {
            id: content_id,
            content_type,
            title,
            description,
            shelby_cid,
            thumbnail_shelby_cid,
            access_level,
            purchase_price,
            published_at: timestamp::now_seconds(),
            is_active: true,
        });

        event::emit_event(&mut profile.content_events, ContentPublishedEvent {
            creator_addr,
            content_id,
            content_type,
            title: *&store.contents[vector::length(&store.contents) - 1].title,
            access_level,
        });
    }

    /// Edit an existing piece of content metadata and storage refs
    public entry fun edit_content(
        creator: &signer,
        content_id: u64,
        title: String,
        description: String,
        shelby_cid: String,
        thumbnail_shelby_cid: String,
        access_level: u8,
        purchase_price: u64,
    ) acquires ContentStore {
        let creator_addr = signer::address_of(creator);
        assert!(exists<ContentStore>(creator_addr), E_NOT_CREATOR);

        let store = borrow_global_mut<ContentStore>(creator_addr);
        let len = vector::length(&store.contents);
        let i = 0u64;
        while (i < len) {
            let content = vector::borrow_mut(&mut store.contents, i);
            if (content.id == content_id) {
                content.title = title;
                content.description = description;
                content.shelby_cid = shelby_cid;
                content.thumbnail_shelby_cid = thumbnail_shelby_cid;
                content.access_level = access_level;
                content.purchase_price = purchase_price;
                return
            };
            i = i + 1;
        };
        abort E_CONTENT_NOT_FOUND
    }

    /// Toggle content active/inactive
    public entry fun toggle_content(
        creator: &signer,
        content_id: u64,
    ) acquires ContentStore {
        let creator_addr = signer::address_of(creator);
        assert!(exists<ContentStore>(creator_addr), E_NOT_CREATOR);

        let store = borrow_global_mut<ContentStore>(creator_addr);
        let len = vector::length(&store.contents);
        let i = 0u64;
        while (i < len) {
            let content = vector::borrow_mut(&mut store.contents, i);
            if (content.id == content_id) {
                content.is_active = !content.is_active;
                return
            };
            i = i + 1;
        };
        abort E_CONTENT_NOT_FOUND
    }

        fun shelby_usd_metadata(): Object<Metadata> {
        object::address_to_object<Metadata>(SHELBY_USD_METADATA_ADDR)
    }

    // ─── Fan Functions ────────────────────────────────────────────────────────────

    /// Subscribe to a creator at a specific tier (pays 1 month upfront)
    public entry fun subscribe(
        fan: &signer,
        creator_addr: address,
        tier_index: u8,
        platform_addr: address,
    ) acquires CreatorProfile, FanSubscriptions, PlatformConfig {
        assert!(exists<CreatorProfile>(creator_addr), E_CREATOR_NOT_FOUND);

        let fan_addr = signer::address_of(fan);
        let profile = borrow_global_mut<CreatorProfile>(creator_addr);

        // Validate tier
        let tier_count = vector::length(&profile.tiers);
        assert!((tier_index as u64) < tier_count, E_INVALID_TIER);

        let tier = vector::borrow(&profile.tiers, (tier_index as u64));
        let price = tier.price_per_month;

        // Check for existing active subscription
        if (!exists<FanSubscriptions>(fan_addr)) {
            move_to(fan, FanSubscriptions { subscriptions: vector::empty() });
        };

        let fan_subs = borrow_global_mut<FanSubscriptions>(fan_addr);
        let now = timestamp::now_seconds();

        // Check for existing subscription to this creator
        let sub_len = vector::length(&fan_subs.subscriptions);
        let i = 0u64;
        while (i < sub_len) {
            let sub = vector::borrow(&fan_subs.subscriptions, i);
            if (sub.creator_addr == creator_addr && sub.expires_at > now) {
                abort E_ALREADY_SUBSCRIBED
            };
            i = i + 1;
        };

        // Calculate fees: 5% platform, 95% creator
        let platform_fee = price * PLATFORM_FEE_BPS / BPS_DENOMINATOR;
        let creator_amount = price - platform_fee;

        // Transfer APT
        let metadata = shelby_usd_metadata();
        primary_fungible_store::transfer(fan, metadata, creator_addr, creator_amount);
        primary_fungible_store::transfer(fan, metadata, platform_addr, platform_fee);

        let expires_at = now + SUBSCRIPTION_DURATION_SECS;

        // Record subscription
        vector::push_back(&mut fan_subs.subscriptions, Subscription {
            creator_addr,
            tier_index,
            expires_at,
            subscribed_at: now,
        });

        // Update creator stats
        profile.total_earned = profile.total_earned + creator_amount;
        profile.subscriber_count = profile.subscriber_count + 1;

        // Update platform stats
        let platform_config = borrow_global_mut<PlatformConfig>(platform_addr);
        platform_config.total_volume = platform_config.total_volume + price;
        platform_config.total_fees_collected = platform_config.total_fees_collected + platform_fee;

        event::emit_event(&mut profile.subscribe_events, SubscribeEvent {
            fan_addr,
            creator_addr,
            tier_index,
            amount_paid: price,
            expires_at,
        });
    }

    /// Renew an existing or expired subscription
    public entry fun renew_subscription(
        fan: &signer,
        creator_addr: address,
        platform_addr: address,
    ) acquires CreatorProfile, FanSubscriptions, PlatformConfig {
        assert!(exists<CreatorProfile>(creator_addr), E_CREATOR_NOT_FOUND);

        let fan_addr = signer::address_of(fan);
        assert!(exists<FanSubscriptions>(fan_addr), E_NOT_SUBSCRIBED);

        let fan_subs = borrow_global_mut<FanSubscriptions>(fan_addr);
        let now = timestamp::now_seconds();

        let sub_len = vector::length(&fan_subs.subscriptions);
        let i = 0u64;
        let found = false;
        while (i < sub_len) {
            let sub = vector::borrow_mut(&mut fan_subs.subscriptions, i);
            if (sub.creator_addr == creator_addr) {
                found = true;
                let profile = borrow_global_mut<CreatorProfile>(creator_addr);
                let tier = vector::borrow(&profile.tiers, (sub.tier_index as u64));
                let price = tier.price_per_month;

                let platform_fee = price * PLATFORM_FEE_BPS / BPS_DENOMINATOR;
                let creator_amount = price - platform_fee;

                let metadata = shelby_usd_metadata();
                primary_fungible_store::transfer(fan, metadata, creator_addr, creator_amount);
                primary_fungible_store::transfer(fan, metadata, platform_addr, platform_fee);

                // Extend: if still active, add from expiry; else reset from now
                if (sub.expires_at > now) {
                    sub.expires_at = sub.expires_at + SUBSCRIPTION_DURATION_SECS;
                } else {
                    sub.expires_at = now + SUBSCRIPTION_DURATION_SECS;
                    profile.subscriber_count = profile.subscriber_count + 1;
                };

                profile.total_earned = profile.total_earned + creator_amount;

                let platform_config = borrow_global_mut<PlatformConfig>(platform_addr);
                platform_config.total_volume = platform_config.total_volume + price;
                platform_config.total_fees_collected = platform_config.total_fees_collected + platform_fee;

                event::emit_event(&mut profile.subscribe_events, SubscribeEvent {
                    fan_addr,
                    creator_addr,
                    tier_index: sub.tier_index,
                    amount_paid: price,
                    expires_at: sub.expires_at,
                });
                break
            };
            i = i + 1;
        };
        assert!(found, E_NOT_SUBSCRIBED);
    }

    /// One-time purchase of a specific content item
    public entry fun purchase_content(
        fan: &signer,
        creator_addr: address,
        content_id: u64,
        platform_addr: address,
    ) acquires CreatorProfile, ContentStore, FanPurchases, PlatformConfig {
        assert!(exists<CreatorProfile>(creator_addr), E_CREATOR_NOT_FOUND);

        let fan_addr = signer::address_of(fan);

        // Ensure fan purchases store exists
        if (!exists<FanPurchases>(fan_addr)) {
            move_to(fan, FanPurchases { purchases: vector::empty() });
        };

        // Check not already purchased
        let fan_purchases = borrow_global_mut<FanPurchases>(fan_addr);
        let p_len = vector::length(&fan_purchases.purchases);
        let i = 0u64;
        while (i < p_len) {
            let rec = vector::borrow(&fan_purchases.purchases, i);
            if (rec.creator_addr == creator_addr && rec.content_id == content_id) {
                abort E_ALREADY_PURCHASED
            };
            i = i + 1;
        };

        // Find content and price
        let store = borrow_global<ContentStore>(creator_addr);
        let content_len = vector::length(&store.contents);
        let j = 0u64;
        let price = 0u64;
        let found = false;
        while (j < content_len) {
            let content = vector::borrow(&store.contents, j);
            if (content.id == content_id && content.is_active) {
                assert!(content.access_level == ACCESS_PURCHASE, E_NO_ACCESS);
                price = content.purchase_price;
                found = true;
                break
            };
            j = j + 1;
        };
        assert!(found, E_CONTENT_NOT_FOUND);
        assert!(price > 0, E_ZERO_AMOUNT);

        let platform_fee = price * PLATFORM_FEE_BPS / BPS_DENOMINATOR;
        let creator_amount = price - platform_fee;

        let metadata = shelby_usd_metadata();
        primary_fungible_store::transfer(fan, metadata, creator_addr, creator_amount);
        primary_fungible_store::transfer(fan, metadata, platform_addr, platform_fee);

        vector::push_back(&mut fan_purchases.purchases, PurchaseRecord {
            creator_addr,
            content_id,
            purchased_at: timestamp::now_seconds(),
        });

        let profile = borrow_global_mut<CreatorProfile>(creator_addr);
        profile.total_earned = profile.total_earned + creator_amount;

        let platform_config = borrow_global_mut<PlatformConfig>(platform_addr);
        platform_config.total_volume = platform_config.total_volume + price;
        platform_config.total_fees_collected = platform_config.total_fees_collected + platform_fee;

        event::emit_event(&mut profile.purchase_events, PurchaseEvent {
            fan_addr,
            creator_addr,
            content_id,
            amount_paid: price,
        });
    }

    /// Tip a creator with an optional message
    public entry fun tip_creator(
        fan: &signer,
        creator_addr: address,
        amount: u64,
        message: String,
        platform_addr: address,
    ) acquires CreatorProfile, PlatformConfig {
        assert!(exists<CreatorProfile>(creator_addr), E_CREATOR_NOT_FOUND);
        assert!(amount > 0, E_ZERO_AMOUNT);

        let fan_addr = signer::address_of(fan);

        let platform_fee = amount * PLATFORM_FEE_BPS / BPS_DENOMINATOR;
        let creator_amount = amount - platform_fee;

        let metadata = shelby_usd_metadata();
        primary_fungible_store::transfer(fan, metadata, creator_addr, creator_amount);
        primary_fungible_store::transfer(fan, metadata, platform_addr, platform_fee);

        let profile = borrow_global_mut<CreatorProfile>(creator_addr);
        profile.total_earned = profile.total_earned + creator_amount;

        let platform_config = borrow_global_mut<PlatformConfig>(platform_addr);
        platform_config.total_volume = platform_config.total_volume + amount;
        platform_config.total_fees_collected = platform_config.total_fees_collected + platform_fee;

        event::emit_event(&mut profile.tip_events, TipEvent {
            fan_addr,
            creator_addr,
            amount,
            message,
        });
    }

    // ─── View / Access Check Functions ───────────────────────────────────────────

    #[view]
    public fun has_active_subscription(
        fan_addr: address,
        creator_addr: address,
    ): (bool, u8, u64) acquires FanSubscriptions {
        if (!exists<FanSubscriptions>(fan_addr)) {
            return (false, 0, 0)
        };

        let fan_subs = borrow_global<FanSubscriptions>(fan_addr);
        let now = timestamp::now_seconds();
        let len = vector::length(&fan_subs.subscriptions);
        let i = 0u64;

        while (i < len) {
            let sub = vector::borrow(&fan_subs.subscriptions, i);
            if (sub.creator_addr == creator_addr && sub.expires_at > now) {
                return (true, sub.tier_index, sub.expires_at)
            };
            i = i + 1;
        };

        (false, 0, 0)
    }

    #[view]
    public fun has_purchased_content(
        fan_addr: address,
        creator_addr: address,
        content_id: u64,
    ): bool acquires FanPurchases {
        if (!exists<FanPurchases>(fan_addr)) {
            return false
        };

        let fan_purchases = borrow_global<FanPurchases>(fan_addr);
        let len = vector::length(&fan_purchases.purchases);
        let i = 0u64;

        while (i < len) {
            let rec = vector::borrow(&fan_purchases.purchases, i);
            if (rec.creator_addr == creator_addr && rec.content_id == content_id) {
                return true
            };
            i = i + 1;
        };

        false
    }

    #[view]
    public fun can_access_content(
        fan_addr: address,
        creator_addr: address,
        content_id: u64,
    ): bool acquires ContentStore, FanSubscriptions, FanPurchases {
        if (!exists<ContentStore>(creator_addr)) return false;

        let store = borrow_global<ContentStore>(creator_addr);
        let len = vector::length(&store.contents);
        let i = 0u64;

        while (i < len) {
            let content = vector::borrow(&store.contents, i);
            if (content.id == content_id && content.is_active) {
                let access = content.access_level;

                // Free content
                if (access == ACCESS_FREE) return true;

                // Purchase-gated
                if (access == ACCESS_PURCHASE) {
                    return has_purchased_content(fan_addr, creator_addr, content_id)
                };

                // Tier-gated: check if fan has a tier >= required
                let (is_sub, tier_idx, _) = has_active_subscription(fan_addr, creator_addr);
                if (!is_sub) return false;

                // tier_idx 0 = tier 1, etc. access_level 1 = tier 1
                return (tier_idx + 1) >= access
            };
            i = i + 1;
        };

        false
    }

    #[view]
    public fun get_creator_tier_count(creator_addr: address): u64 acquires CreatorProfile {
        if (!exists<CreatorProfile>(creator_addr)) return 0;
        let profile = borrow_global<CreatorProfile>(creator_addr);
        vector::length(&profile.tiers)
    }

    #[view]
    public fun get_all_creators(): vector<address> acquires CreatorRegistry {
        if (!exists<CreatorRegistry>(@cult)) {
            return vector::empty<address>()
        };

        let registry = borrow_global<CreatorRegistry>(@cult);
        *&registry.creators
    }

    #[view]
    public fun get_creator_by_handle(handle: String): address acquires CreatorRegistry, CreatorProfile {
        if (!exists<CreatorRegistry>(@cult)) {
            return @0x0
        };

        let registry = borrow_global<CreatorRegistry>(@cult);
        let len = vector::length(&registry.creators);
        let i = 0u64;

        while (i < len) {
            let addr = *vector::borrow(&registry.creators, i);
            if (exists<CreatorProfile>(addr)) {
                let profile = borrow_global<CreatorProfile>(addr);
                if (profile.handle == handle && string::length(&profile.handle) > 0) {
                    return addr
                };
            };
            i = i + 1;
        };

        @0x0
    }

    #[view]
    public fun get_platform_stats(platform_addr: address): (u64, u64) acquires PlatformConfig {
        let config = borrow_global<PlatformConfig>(platform_addr);
        (config.total_volume, config.total_fees_collected)
    }
    /// Follow a creator
public entry fun follow_creator(
    fan: &signer,
    creator_addr: address,
) acquires FollowStore {
    let fan_addr = signer::address_of(fan);
    assert!(fan_addr != creator_addr, E_CANNOT_FOLLOW_SELF);
    assert!(exists<CreatorProfile>(creator_addr), E_CREATOR_NOT_FOUND);

    // Init FollowStore if first follow
    if (!exists<FollowStore>(fan_addr)) {
        move_to(fan, FollowStore {
            following: vector::empty(),
            follow_events: account::new_event_handle<FollowEvent>(fan),
            unfollow_events: account::new_event_handle<UnfollowEvent>(fan),
        });
    };

    let follow_store = borrow_global_mut<FollowStore>(fan_addr);

    // Check not already following
    let len = vector::length(&follow_store.following);
    let i = 0u64;
    while (i < len) {
        assert!(*vector::borrow(&follow_store.following, i) != creator_addr, E_ALREADY_FOLLOWING);
        i = i + 1;
    };

    vector::push_back(&mut follow_store.following, creator_addr);

    event::emit_event(&mut follow_store.follow_events, FollowEvent {
        fan_addr,
        creator_addr,
    });

    // Increment creator's follower count
    if (!exists<FollowerStore>(creator_addr)) {
        // Can't move_to on another account — track on fan side only
        // Follower count is computed via indexer in frontend
    };
}

/// Unfollow a creator
public entry fun unfollow_creator(
    fan: &signer,
    creator_addr: address,
) acquires FollowStore {
    let fan_addr = signer::address_of(fan);
    assert!(exists<FollowStore>(fan_addr), E_NOT_FOLLOWING);

    let follow_store = borrow_global_mut<FollowStore>(fan_addr);
    let len = vector::length(&follow_store.following);
    let i = 0u64;
    let found = false;

    while (i < len) {
        if (*vector::borrow(&follow_store.following, i) == creator_addr) {
            vector::remove(&mut follow_store.following, i);
            found = true;
            break
        };
        i = i + 1;
    };

    assert!(found, E_NOT_FOLLOWING);

    event::emit_event(&mut follow_store.unfollow_events, UnfollowEvent {
        fan_addr,
        creator_addr,
    });
}

// Check if a fan is following a creator
#[view]
public fun is_following(
    fan_addr: address,
    creator_addr: address,
): bool acquires FollowStore {
    if (!exists<FollowStore>(fan_addr)) return false;
    let follow_store = borrow_global<FollowStore>(fan_addr);
    let len = vector::length(&follow_store.following);
    let i = 0u64;
    while (i < len) {
        if (*vector::borrow(&follow_store.following, i) == creator_addr) return true;
        i = i + 1;
    };
    false
}

// Get all addresses a fan is following
#[view]
public fun get_following(fan_addr: address): vector<address> acquires FollowStore {
    if (!exists<FollowStore>(fan_addr)) return vector::empty();
    let follow_store = borrow_global<FollowStore>(fan_addr);
    *&follow_store.following
}

// ─── ADD THESE ERROR CODES to the existing error codes section ────────────────

const E_ALREADY_LOVED: u64 = 19;
const E_NOT_LOVED: u64 = 20;
const E_NO_ACCESS_TO_REACT: u64 = 21;
const E_COMMENT_TOO_LONG: u64 = 22;
const E_CONTENT_NOT_ACTIVE: u64 = 23;

// ─── ADD THESE STRUCTS after the existing structs ─────────────────────────────

struct LoveRecord has store, copy, drop {
    fan_addr: address,
    content_id: u64,
    loved_at: u64,
}

struct LoveStore has key {
    loves: vector<LoveRecord>,
    love_events: EventHandle<LoveEvent>,
}

struct Comment has store, copy, drop {
    id: u64,
    fan_addr: address,
    content_id: u64,
    text: String,
    posted_at: u64,
}

struct CommentStore has key {
    comments: vector<Comment>,
    comment_count: u64,
    comment_events: EventHandle<CommentEvent>,
}

// ─── ADD THESE EVENTS after the existing events ───────────────────────────────

struct LoveEvent has drop, store {
    fan_addr: address,
    creator_addr: address,
    content_id: u64,
}

struct CommentEvent has drop, store {
    fan_addr: address,
    creator_addr: address,
    content_id: u64,
    comment_id: u64,
    text: String,
}

// ─── ADD THESE ENTRY FUNCTIONS after the existing fan functions ────────────────

public entry fun love_content(
    fan: &signer,
    creator_addr: address,
    content_id: u64,
) acquires ContentStore, FanSubscriptions, FanPurchases, LoveStore {
    let fan_addr = signer::address_of(fan);

    // verify content exists and is active, get its access_level
    assert!(exists<ContentStore>(creator_addr), E_CREATOR_NOT_FOUND);
    let store = borrow_global<ContentStore>(creator_addr);
    let len = vector::length(&store.contents);
    let i = 0u64;
    let found = false;
    let access_level = 0u8;
    while (i < len) {
        let content = vector::borrow(&store.contents, i);
        if (content.id == content_id) {
            assert!(content.is_active, E_CONTENT_NOT_ACTIVE);
            access_level = content.access_level;
            found = true;
            break
        };
        i = i + 1;
    };
    assert!(found, E_CONTENT_NOT_FOUND);

    // check access rights
    if (access_level != ACCESS_FREE) {
        if (access_level == ACCESS_PURCHASE) {
            assert!(has_purchased_content(fan_addr, creator_addr, content_id), E_NO_ACCESS_TO_REACT);
        } else {
            let (is_sub, tier_idx, _) = has_active_subscription(fan_addr, creator_addr);
            assert!(is_sub && (tier_idx + 1) >= access_level, E_NO_ACCESS_TO_REACT);
        };
    };

    // init LoveStore if first time
    if (!exists<LoveStore>(fan_addr)) {
        move_to(fan, LoveStore {
            loves: vector::empty(),
            love_events: account::new_event_handle<LoveEvent>(fan),
        });
    };

    let love_store = borrow_global_mut<LoveStore>(fan_addr);

    // check not already loved
    let j = 0u64;
    let loves_len = vector::length(&love_store.loves);
    while (j < loves_len) {
        let rec = vector::borrow(&love_store.loves, j);
        assert!(!(rec.content_id == content_id && rec.fan_addr == fan_addr), E_ALREADY_LOVED);
        j = j + 1;
    };

    vector::push_back(&mut love_store.loves, LoveRecord {
        fan_addr,
        content_id,
        loved_at: timestamp::now_seconds(),
    });

    event::emit_event(&mut love_store.love_events, LoveEvent {
        fan_addr,
        creator_addr,
        content_id,
    });
}

public entry fun unlove_content(
    fan: &signer,
    content_id: u64,
) acquires LoveStore {
    let fan_addr = signer::address_of(fan);
    assert!(exists<LoveStore>(fan_addr), E_NOT_LOVED);

    let love_store = borrow_global_mut<LoveStore>(fan_addr);
    let len = vector::length(&love_store.loves);
    let i = 0u64;
    let found = false;

    while (i < len) {
        let rec = vector::borrow(&love_store.loves, i);
        if (rec.content_id == content_id && rec.fan_addr == fan_addr) {
            vector::remove(&mut love_store.loves, i);
            found = true;
            break
        };
        i = i + 1;
    };

    assert!(found, E_NOT_LOVED);
}

public entry fun post_comment(
    fan: &signer,
    creator_addr: address,
    content_id: u64,
    text: String,
) acquires ContentStore, FanSubscriptions, FanPurchases, CommentStore, GlobalCommentStore {
    let fan_addr = signer::address_of(fan);

    // max 500 chars
    assert!(string::length(&text) <= 500, E_COMMENT_TOO_LONG);

    // verify content exists, is active, check access
    assert!(exists<ContentStore>(creator_addr), E_CREATOR_NOT_FOUND);
    let store = borrow_global<ContentStore>(creator_addr);
    let len = vector::length(&store.contents);
    let i = 0u64;
    let found = false;
    let access_level = 0u8;
    while (i < len) {
        let content = vector::borrow(&store.contents, i);
        if (content.id == content_id) {
            assert!(content.is_active, E_CONTENT_NOT_ACTIVE);
            access_level = content.access_level;
            found = true;
            break
        };
        i = i + 1;
    };
    assert!(found, E_CONTENT_NOT_FOUND);

    // same access check as love
    if (access_level != ACCESS_FREE) {
        if (access_level == ACCESS_PURCHASE) {
            assert!(has_purchased_content(fan_addr, creator_addr, content_id), E_NO_ACCESS_TO_REACT);
        } else {
            let (is_sub, tier_idx, _) = has_active_subscription(fan_addr, creator_addr);
            assert!(is_sub && (tier_idx + 1) >= access_level, E_NO_ACCESS_TO_REACT);
        };
    };

    // init CommentStore under creator if first comment on this creator's content
    if (!exists<CommentStore>(creator_addr)) {
        // cannot move_to another account — store under fan instead
        // we store all comments under the creator's address
        // NOTE: only the creator can call move_to for their own address
        // so we store comments under a global resource keyed by fan
        // Workaround: store CommentStore under fan_addr
    };

    if (!exists<CommentStore>(fan_addr)) {
        move_to(fan, CommentStore {
            comments: vector::empty(),
            comment_count: 0,
            comment_events: account::new_event_handle<CommentEvent>(fan),
        });
    };

    let comment_store = borrow_global_mut<CommentStore>(fan_addr);
    let comment_id = comment_store.comment_count;
    comment_store.comment_count = comment_id + 1;

    vector::push_back(&mut comment_store.comments, Comment {
        id: comment_id,
        fan_addr,
        content_id,
        text: *&text,
        posted_at: timestamp::now_seconds(),
    });

    event::emit_event(&mut comment_store.comment_events, CommentEvent {
        fan_addr,
        creator_addr,
        content_id,
        comment_id,
        text,
    });

    // Store globally so all users can see comments (for free content; access control for paid content is in frontend)
    if (!exists<GlobalCommentStore>(creator_addr)) {
        // Creator must call init_global_comment_store() once (added below)
        assert!(false, E_NOT_INITIALIZED);
    };
    let global_store = borrow_global_mut<GlobalCommentStore>(creator_addr);
    vector::push_back(&mut global_store.comments, Comment {
        id: comment_id,
        fan_addr,
        content_id,
        text: *&text,
        posted_at: timestamp::now_seconds(),
    });
    global_store.comment_count = global_store.comment_count + 1;
}

public entry fun delete_comment(
    fan: &signer,
    comment_id: u64,
) acquires CommentStore {
    let fan_addr = signer::address_of(fan);
    assert!(exists<CommentStore>(fan_addr), E_CONTENT_NOT_FOUND);

    let comment_store = borrow_global_mut<CommentStore>(fan_addr);
    let len = vector::length(&comment_store.comments);
    let i = 0u64;
    let found = false;

    while (i < len) {
        let c = vector::borrow(&comment_store.comments, i);
        if (c.id == comment_id && c.fan_addr == fan_addr) {
            vector::remove(&mut comment_store.comments, i);
            found = true;
            break
        };
        i = i + 1;
    };

    assert!(found, E_CONTENT_NOT_FOUND);
}

public entry fun delete_comment_v2(
    fan: &signer,
    creator_addr: address,
    content_id: u64,
    comment_id: u64,
) acquires CommentStore, GlobalCommentStore {
    let fan_addr = signer::address_of(fan);

    // Delete from personal store if exists
    if (exists<CommentStore>(fan_addr)) {
        let comment_store = borrow_global_mut<CommentStore>(fan_addr);
        let len = vector::length(&comment_store.comments);
        let i = 0u64;
        while (i < len) {
            let c = vector::borrow(&comment_store.comments, i);
            if (c.id == comment_id && c.fan_addr == fan_addr) {
                vector::remove(&mut comment_store.comments, i);
                break;
            };
            i = i + 1;
        };
    }

    // Delete from global store
    if (exists<GlobalCommentStore>(creator_addr)) {
        let global_store = borrow_global_mut<GlobalCommentStore>(creator_addr);
        let glen = vector::length(&global_store.comments);
        let j = 0u64;
        while (j < glen) {
            let gc = vector::borrow(&global_store.comments, j);
            if (gc.id == comment_id && gc.fan_addr == fan_addr && gc.content_id == content_id) {
                vector::remove(&mut global_store.comments, j);
                global_store.comment_count = global_store.comment_count - 1;
                break;
            };
            j = j + 1;
        };
    }
}

// ─── ADD THESE VIEW FUNCTIONS ─────────────────────────────────────────────────

#[view]
public fun has_loved_content(
    fan_addr: address,
    content_id: u64,
): bool acquires LoveStore {
    if (!exists<LoveStore>(fan_addr)) return false;
    let love_store = borrow_global<LoveStore>(fan_addr);
    let len = vector::length(&love_store.loves);
    let i = 0u64;
    while (i < len) {
        let rec = vector::borrow(&love_store.loves, i);
        if (rec.content_id == content_id) return true;
        i = i + 1;
    };
    false
}

#[view]
public fun get_fan_comments(
    fan_addr: address,
    content_id: u64,
): vector<Comment> acquires CommentStore {
    if (!exists<CommentStore>(fan_addr)) return vector::empty();
    let comment_store = borrow_global<CommentStore>(fan_addr);
    let result = vector::empty<Comment>();
    let len = vector::length(&comment_store.comments);
    let i = 0u64;
    while (i < len) {
        let c = vector::borrow(&comment_store.comments, i);
        if (c.content_id == content_id) {
            vector::push_back(&mut result, *c);
        };
        i = i + 1;
    };
    result
}

    // ─── Global Comment Store Initialization ──────────────────────────────────────

    public entry fun init_global_comment_store(creator: &signer) {
        let creator_addr = signer::address_of(creator);
        assert!(!exists<GlobalCommentStore>(creator_addr), E_ALREADY_INITIALIZED);
        move_to(creator, GlobalCommentStore {
            comments: vector::empty(),
            comment_count: 0,
        });
    }

#[view]
public fun get_comments_for_content(
    creator_addr: address,
    content_id: u64,
): vector<Comment> acquires GlobalCommentStore {
    if (!exists<GlobalCommentStore>(creator_addr)) return vector::empty();
    let store = borrow_global<GlobalCommentStore>(creator_addr);
    let result = vector::empty<Comment>();
    let len = vector::length(&store.comments);
    let i = 0u64;
    while (i < len) {
        let c = vector::borrow(&store.comments, i);
        if (c.content_id == content_id) {
            vector::push_back(&mut result, *c);
        };
        i = i + 1;
    };
    result
}

struct GlobalCommentStore has key {
    comments: vector<Comment>,
    comment_count: u64,
}

// ─── User Profile (restored for backward compatibility) ───────────────────────

struct UserProfile has key, copy, drop, store {
    user_addr: address,
    display_name: String,
    bio: String,
    avatar_shelby_cid: String,
    created_at: u64,
    updated_at: u64,
}

#[view]
public fun has_user_profile(user_addr: address): bool {
    exists<UserProfile>(user_addr)
}

#[view]
public fun get_user_profile(user_addr: address): UserProfile acquires UserProfile {
    assert!(exists<UserProfile>(user_addr), E_NOT_INITIALIZED);
    *borrow_global<UserProfile>(user_addr)
}

public entry fun register_user_profile(
    user: &signer,
    display_name: String,
    bio: String,
    avatar_cid: String,
) {
    let user_addr = signer::address_of(user);
    assert!(!exists<UserProfile>(user_addr), E_ALREADY_INITIALIZED);

    move_to(user, UserProfile {
        user_addr,
        display_name,
        bio,
        avatar_shelby_cid: avatar_cid,
        created_at: timestamp::now_seconds(),
        updated_at: timestamp::now_seconds(),
    });
}

public entry fun update_user_profile(
    user: &signer,
    display_name: String,
    bio: String,
    avatar_cid: String,
) acquires UserProfile {
    let user_addr = signer::address_of(user);
    assert!(exists<UserProfile>(user_addr), E_NOT_INITIALIZED);

    let profile = borrow_global_mut<UserProfile>(user_addr);
    profile.display_name = display_name;
    profile.bio = bio;
    profile.avatar_shelby_cid = avatar_cid;
    profile.updated_at = timestamp::now_seconds();
}
}