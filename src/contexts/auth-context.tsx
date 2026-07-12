"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { api } from "@/lib/api"

type User = {
  id: string
  phone: string
  email?: string | null
  username: string
  name: string
  tenant_id: string
  setup_completed: boolean
}

type AuthContextType = {
  user: User | null
  loading: boolean
  requestOTP: (phone: string) => Promise<void>
  verifyOTP: (phone: string, code: string) => Promise<{ needs_setup: boolean; setup_completed: boolean }>
  claimUsername: (username: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        const res = await api<{ user: User }>("/auth/me", { redirectOnUnauthorized: false })
        if (active) setUser(res.user)
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSession()
    return () => {
      active = false
    }
  }, [])

  const requestOTP = useCallback(async (phone: string) => {
    await api("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    })
  }, [])

  const verifyOTP = useCallback(async (phone: string, code: string) => {
    const res = await api<{ user: User; needs_setup: boolean }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    })
    setUser(res.user)
    return { needs_setup: res.needs_setup, setup_completed: res.user.setup_completed }
  }, [])

  const claimUsername = useCallback(async (username: string) => {
    const res = await api<{ user: User }>("/auth/username", {
      method: "POST",
      body: JSON.stringify({ username }),
    })
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, requestOTP, verifyOTP, claimUsername, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
