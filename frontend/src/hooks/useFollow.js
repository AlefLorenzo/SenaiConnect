import { useState, useEffect, useCallback } from 'react';
import { USE_MOCK, API_URL } from '../config/api';

// Mock follow status - in a real app this would be stored in a mock database
const mockFollowStatus = new Map();

export const useFollow = (targetUserId) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    // If in mock mode, use mock data
    if (USE_MOCK) {
      setIsFollowing(mockFollowStatus.get(targetUserId) || false);
      setLoading(false);
      return;
    }

    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/follows/${targetUserId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.isFollowing);
      }
    } catch (err) {
      console.error('Erro ao buscar status de follow', err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    // Defer checkStatus to avoid synchronous setState in effect
    setTimeout(() => checkStatus(), 0);
  }, [checkStatus]);

  const toggleFollow = async () => {
    setLoading(true);
    try {
      // If in mock mode, update mock data
      if (USE_MOCK) {
        const newStatus = !isFollowing;
        mockFollowStatus.set(targetUserId, newStatus);
        setIsFollowing(newStatus);
        // Trigger generic event so Profile can refresh stats
        window.dispatchEvent(new CustomEvent('follow_updated'));
        setLoading(false);
        return;
      }

      const token = sessionStorage.getItem('token');
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch(`${API_URL}/api/follows/${targetUserId}`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        // Trigger generic event so Profile can refresh stats
        window.dispatchEvent(new CustomEvent('follow_updated'));
      }
    } catch (err) {
      console.error('Erro ao alterar follow', err);
    } finally {
      setLoading(false);
    }
  };

  return { isFollowing, loading, toggleFollow, refreshStatus: checkStatus };
};
