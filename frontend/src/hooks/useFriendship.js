import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const useFriendship = (targetId) => {
  const [status, setStatus] = useState('none');
  const [requestId, setRequestId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!targetId) return;
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/friends/status/${targetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        if (data.request_id) setRequestId(data.request_id);
      }
    } catch (err) {
      console.error('Erro ao buscar status de amizade', err);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    // Defer fetchStatus to avoid synchronous setState in effect
    setTimeout(() => fetchStatus(), 0);
  }, [fetchStatus]);

  const sendRequest = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/friends/request/${targetId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status); // ex: 'pending_sent'
      } else {
        const error = await res.json();
        alert(error.error || 'Erro ao enviar solicitação');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const respondRequest = async (action) => {
    if (!requestId) return;
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/friends/respond/${requestId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status); // ex: 'accepted' ou 'rejected'(none)
      } else {
        const error = await res.json();
        alert(error.error || 'Erro ao responder solicitação');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeFriend = async () => {
    if (!window.confirm('Deseja realmente desfazer a amizade?')) return;
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/friends/${targetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setStatus('none');
      } else {
        alert('Erro ao remover amizade');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return { status, loading, sendRequest, respondRequest, removeFriend, refreshStatus: fetchStatus };
};
