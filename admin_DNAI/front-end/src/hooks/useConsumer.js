
import { useState, useEffect } from 'react'

export function useConsumer() {
  const [consumers, setComsumers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      // NOTE: This assumes you have a Next.js API route set up at /api/admin/consumers
      const response = await fetch('/api/admin/consumers')
      const data = await response.json()
      
      if (response.ok) {
        setComsumers(data.users)
        
        setError(null)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const createUser = async (userData) => {
    try {
      const response = await fetch('/api/admin/consumers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      
      const data = await response.json()
      
      if (response.ok) {
        await fetchUsers()
        return { success: true, data }
      } else {
        return { success: false, error: data.error }
      }
    } catch (err) {
      return { success: false, error: 'Failed to create user' }
    }
  }

  const updateUserRole = async (userId, role) => {
    try {
      const response = await fetch(`/api/admin/consumers/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        await fetchUsers()
        return { success: true, data }
      } else {
        return { success: false, error: data.error }
      }
    } catch (err) {
      return { success: false, error: 'Failed to update role' }
    }
  }

  const deleteUser = async (userId) => {
    try {
      const response = await fetch(`/api/admin/consumers/${userId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        await fetchUsers()
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch (err) {
      return { success: false, error: 'Failed to delete user' }
    }
  }

  return { consumers, loading, error, createUser, updateUserRole, deleteUser, refetch: fetchUsers }
}