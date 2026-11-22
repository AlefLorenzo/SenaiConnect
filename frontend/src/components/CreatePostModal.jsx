import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { acquireModalScrollLock } from '../utils/modalScrollLock.js';
import { Image, X } from 'lucide-react';
import Avatar from './Avatar';
import './CreatePostModal.css';

const CreatePostModal = ({
  isOpen,
  onClose,
  user,
  content,
  onContentChange,
  placeholder,
  imagePreview,
  onRemoveImage,
  onImageSelect,
  onSubmit,
  isSubmitting,
}) => {
  const fileInputRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const releaseScrollLock = acquireModalScrollLock();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      releaseScrollLock();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="create-post-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.dataset.backdropTouch = 'true';
      }}
      onTouchEnd={(event) => {
        if (event.target === event.currentTarget && event.currentTarget.dataset.backdropTouch === 'true') {
          delete event.currentTarget.dataset.backdropTouch;
          onClose();
        }
      }}
    >
      <section
        className="create-post-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-post-dialog-title"
      >
        <header className="create-post-dialog-header">
          <h2 id="create-post-dialog-title">Criar publicação</h2>
          <button type="button" className="create-post-dialog-close" onClick={onClose} aria-label="Fechar criação de publicação">
            <X size={22} />
          </button>
        </header>

        <form
          className="create-post-dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="create-post-dialog-author">
            <Avatar user={user} className="create-post-dialog-avatar" />
            <span>{user?.name || user?.username || 'Sua publicação'}</span>
          </div>

          <textarea
            className="create-post-dialog-input"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            placeholder={placeholder || 'No que você está pensando?'}
            aria-label="Texto da publicação"
            rows={5}
            autoComplete="off"
          />

          {imagePreview && (
            <div className="create-post-dialog-preview">
              <img src={imagePreview} alt="Prévia da imagem da publicação" />
              <button type="button" onClick={onRemoveImage} aria-label="Remover imagem da publicação">
                <X size={18} />
              </button>
            </div>
          )}

          <div className="create-post-dialog-footer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="create-post-dialog-file"
              aria-label="Selecionar imagem"
              onChange={onImageSelect}
            />
            <button
              type="button"
              className="create-post-dialog-photo"
              onClick={() => fileInputRef.current?.click()}
            >
              <Image size={19} />
              <span>Adicionar foto</span>
            </button>
            <button
              type="submit"
              className="create-post-dialog-submit"
              disabled={isSubmitting || (!content.trim() && !imagePreview)}
            >
              {isSubmitting ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
};

export default CreatePostModal;
