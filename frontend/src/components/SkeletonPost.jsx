import './Skeleton.css';

const SkeletonPost = () => {
  return (
    <div className="skeleton-post">
      <div className="skeleton-header">
        <div className="skeleton-avatar"></div>
        <div className="skeleton-info">
          <div className="skeleton-line"></div>
          <div className="skeleton-line short"></div>
        </div>
      </div>

      <div className="skeleton-content"></div>

      <div className="skeleton-actions">
        <div className="skeleton-action"></div>
        <div className="skeleton-action"></div>
        <div className="skeleton-action"></div>
        <div className="skeleton-action"></div>
      </div>
    </div>
  );
};

export default SkeletonPost;