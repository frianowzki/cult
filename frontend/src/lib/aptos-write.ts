import { CONTRACT_ADDRESS, MODULE_NAME, OCTAS_PER_APT, PLATFORM_ADDRESS } from './constants'

export const usdToUnitsStr = (usd: number): string =>
  Math.floor(usd * OCTAS_PER_APT).toString()

export function buildRegisterCreatorPayload(params: {
  handle: string
  displayName: string
  bio: string
  avatarCid: string
  bannerCid: string
  tiers: Array<{ name: string; priceUsd: number; description: string }>
}) {
  const { handle, displayName, bio, avatarCid, bannerCid, tiers } = params

  const tier1 = tiers[0] || { name: '', priceUsd: 0, description: '' }
  const tier2 = tiers[1] || { name: '', priceUsd: 0, description: '' }
  const tier3 = tiers[2] || { name: '', priceUsd: 0, description: '' }

  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::register_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      handle,
      displayName,
      bio,
      avatarCid,
      bannerCid,
      tier1.name,
      usdToUnitsStr(tier1.priceUsd),
      tier1.description,
      tier2.name,
      usdToUnitsStr(tier2.priceUsd),
      tier2.description,
      tier3.name,
      usdToUnitsStr(tier3.priceUsd),
      tier3.description,
    ],
  }
}

export function buildPublishContentPayload(params: {
  contentType: number
  title: string
  description: string
  shelbyCid: string
  thumbnailCid: string
  accessLevel: number
  purchasePriceUsd: number
}) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::publish_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      params.contentType,
      params.title,
      params.description,
      params.shelbyCid,
      params.thumbnailCid,
      params.accessLevel,
      usdToUnitsStr(params.purchasePriceUsd),
    ],
  }
}

export function buildEditContentPayload(params: {
  contentId: number
  title: string
  description: string
  shelbyCid: string
  thumbnailCid: string
  accessLevel: number
  purchasePriceUsd: number
}) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::edit_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      params.contentId.toString(),
      params.title,
      params.description,
      params.shelbyCid,
      params.thumbnailCid,
      params.accessLevel,
      usdToUnitsStr(params.purchasePriceUsd),
    ],
  }
}

export function buildSubscribePayload(creatorAddr: string, tierIndex: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::subscribe` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, tierIndex.toString(), PLATFORM_ADDRESS],
  }
}

export function buildRenewSubscriptionPayload(creatorAddr: string) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::renew_subscription` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, PLATFORM_ADDRESS],
  }
}

export function buildPurchaseContentPayload(creatorAddr: string, contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::purchase_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, contentId.toString(), PLATFORM_ADDRESS],
  }
}

export function buildTipPayload(creatorAddr: string, amountUsd: number, message: string) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::tip_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, usdToUnitsStr(amountUsd), message, PLATFORM_ADDRESS],
  }
}

export function buildUpdateTiersPayload(params: {
  tiers: Array<{ name: string; priceUsd: number; description: string }>
}) {
  const tier1 = params.tiers[0] || { name: '', priceUsd: 0, description: '' }
  const tier2 = params.tiers[1] || { name: '', priceUsd: 0, description: '' }
  const tier3 = params.tiers[2] || { name: '', priceUsd: 0, description: '' }

  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::update_tiers` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      tier1.name,
      usdToUnitsStr(tier1.priceUsd),
      tier1.description,
      tier2.name,
      usdToUnitsStr(tier2.priceUsd),
      tier2.description,
      tier3.name,
      usdToUnitsStr(tier3.priceUsd),
      tier3.description,
    ],
  }
}

export function buildToggleContentPayload(contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::toggle_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [contentId.toString()],
  }
}

export function buildDeleteCreatorPayload() {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::delete_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [],
  }
}

export function buildFollowPayload(creatorAddr: string) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::follow_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr],
  }
}

export function buildUnfollowPayload(creatorAddr: string) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::unfollow_creator` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr],
  }
}

export function buildLoveContentPayload(creatorAddr: string, contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::love_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, contentId.toString()],
  }
}

export function buildUnloveContentPayload(contentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::unlove_content` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [contentId.toString()],
  }
}

export function buildPostCommentPayload(creatorAddr: string, contentId: number, text: string) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::post_comment` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [creatorAddr, contentId.toString(), text],
  }
}

export function buildDeleteCommentPayload(creatorAddr: string, contentId: number, commentId: number) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::delete_comment_v2`,
    typeArguments: [],
    functionArguments: [creatorAddr, contentId.toString(), commentId.toString()],
  }
}

export function buildRegisterUserProfilePayload(params: { displayName: string; bio: string; avatarCid: string }) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::register_user_profile` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [params.displayName, params.bio, params.avatarCid],
  }
}

export function buildUpdateUserProfilePayload(params: { displayName: string; bio: string; avatarCid: string }) {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::update_user_profile` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [params.displayName, params.bio, params.avatarCid],
  }
}

export function buildInitGlobalCommentStorePayload() {
  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::init_global_comment_store` as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [],
  }
}
