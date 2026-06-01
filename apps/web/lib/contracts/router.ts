import { MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS, type Address } from '@x402/contracts'

/**
 * Returns the active Mantle Sepolia action router address.
 *
 * The deployed router is the default target for visible app actions.
 * An env var can override it if you redeploy later.
 */
export function getMantleSepoliaActionRouterAddress(): Address {
  return (
    process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS ||
    MANTLE_SEPOLIA_ACTION_ROUTER_ADDRESS
  ) as Address
}
