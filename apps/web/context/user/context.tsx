'use client'

import { createContext, useContext, useCallback, useMemo, useEffect, useState, type ReactNode } from 'react'
import { useConnection, useBalance, useDisconnect } from 'wagmi'
import type { Address } from 'viem'
import type { UserContextValue } from './types'
import type { UserBalance, UserSession } from '@/types'
import { SESSION_CREATED_EVENT, SESSION_DESTROYED_EVENT } from '@/context'

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const { address, chainId, isConnected, isConnecting, isReconnecting } = useConnection();
  const disconnect  = useDisconnect()

  // Server session state - tracks if user has completed SIWX authentication
  const [hasServerSession, setHasServerSession] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  // Function to check server session status
  const checkServerSession = useCallback(async () => {
    if (!isConnected || !address) {
      setHasServerSession(false)
      setIsCheckingSession(false)
      return
    }

    try {
      setIsCheckingSession(true)
      const response = await fetch('/api/auth/session')
      const data = await response.json()

      // Verify the session matches the connected wallet
      const sessionValid = data.authenticated &&
        data.user?.walletAddress?.toLowerCase() === address.toLowerCase()

      setHasServerSession(sessionValid)
    } catch (error) {
      console.error('Failed to check server session:', error)
      setHasServerSession(false)
    } finally {
      setIsCheckingSession(false)
    }
  }, [isConnected, address])

  // Check server session status when wallet connection changes
  useEffect(() => {
    checkServerSession()
  }, [checkServerSession])

  // Listen for session events from ServerSyncStorage
  useEffect(() => {
    const handleSessionCreated = () => {
      checkServerSession()
    }

    const handleSessionDestroyed = () => {
      setHasServerSession(false)
    }

    window.addEventListener(SESSION_CREATED_EVENT, handleSessionCreated)
    window.addEventListener(SESSION_DESTROYED_EVENT, handleSessionDestroyed)

    return () => {
      window.removeEventListener(SESSION_CREATED_EVENT, handleSessionCreated)
      window.removeEventListener(SESSION_DESTROYED_EVENT, handleSessionDestroyed)
    }
  }, [checkServerSession])

  // Native MNT balance
  const {
    data: nativeBalanceData,
    isLoading: isNativeBalanceLoading,
    refetch: refetchNativeBalance,
  } = useBalance({
    address: address as Address | undefined,
    query: { enabled: !!address },
  })

  // Build session object - only authenticated if BOTH wallet connected AND server session exists
  const session: UserSession | null = useMemo(() => {
    if (!isConnected || !address || !chainId) return null
    return {
      walletAddress: address,
      chainId,
      isAuthenticated: hasServerSession,
    }
  }, [isConnected, address, chainId, hasServerSession])

  // Build balance object
  const balance: UserBalance | null = useMemo(() => {
    if (!nativeBalanceData) return null
    return {
      native: nativeBalanceData.value,
      mnt: nativeBalanceData.value,
    }
  }, [nativeBalanceData])

  // Operations
  const signOut = useCallback(async () => {
    disconnect.mutate()
  }, [disconnect])

  const refreshBalance = useCallback(async () => {
    await refetchNativeBalance()
  }, [refetchNativeBalance])

  const value: UserContextValue = useMemo(
    () => ({
      session,
      balance,
      isLoading: isConnecting || isReconnecting || isCheckingSession,
      isBalanceLoading: isNativeBalanceLoading,
      error: null,
      signOut,
      refreshBalance,
      refreshSession: checkServerSession,
    }),
    [
      session,
      balance,
      isConnecting,
      isReconnecting,
      isCheckingSession,
      isNativeBalanceLoading,
      signOut,
      refreshBalance,
      checkServerSession,
    ]
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUserContext(): UserContextValue {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider')
  }
  return context
}
