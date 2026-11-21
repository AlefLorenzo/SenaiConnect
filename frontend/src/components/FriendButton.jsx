import { UserPlus, UserCheck, Clock, Check, X } from 'lucide-react';
import './FriendButton.css';

const FriendButton = ({ status, loading, onSend, onRespond, onRemove }) => {
  if (status === 'self') return null;

  if (loading) {
    return <button className="friend-btn loading" disabled>Aguarde...</button>;
  }

  if (status === 'none') {
    return (
      <button className="friend-btn btn-primary" onClick={onSend}>
        <UserPlus size={16} /> Adicionar
      </button>
    );
  }

  if (status === 'pending_sent') {
    return (
      <button className="friend-btn pending" disabled>
        <Clock size={16} /> Pendente
      </button>
    );
  }

  if (status === 'pending_received') {
    return (
      <div className="friend-btn-group">
        <button className="friend-btn accept" onClick={() => onRespond('accept')}>
          <Check size={16} /> Aceitar
        </button>
        <button className="friend-btn reject" onClick={() => onRespond('reject')}>
          <X size={16} /> Recusar
        </button>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <button className="friend-btn accepted" onClick={onRemove}>
        <UserCheck size={16} /> Amigos
      </button>
    );
  }

  return null;
};

export default FriendButton;
