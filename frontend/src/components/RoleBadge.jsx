import './RoleBadge.css';

const RoleBadge = ({ role, size = 'small' }) => {
  if (!role || role.toUpperCase() !== 'PROFESSOR') return null;

  return (
    <span className={`role-badge ${size}`}>
      DOCENTE
    </span>
  );
};

export default RoleBadge;
