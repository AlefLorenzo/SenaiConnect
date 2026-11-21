import { useState, useRef, useEffect } from 'react';
import { useContext } from 'react';
import { Image, Smile, MapPin, Send, X, Camera } from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import Avatar from './Avatar';
import './CreatePostCard.css';

const CreatePostCard = ({ className = '', isMobile = false }) => {
  const { user } = useContext(AuthContext);
  const [content, setContent] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [feeling, setFeeling] = useState(null);
  const [showFeelingOptions, setShowFeelingOptions] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Check for creation type from sessionStorage (set by FAB)
  useEffect(() => {
    const createType = sessionStorage.getItem('createPostType');
    if (createType) {
      sessionStorage.removeItem('createPostType');
      setExpanded(true);
      // Set placeholder based on type
      const placeholders = {
        photo: 'Compartilhe uma foto...',
        video: 'Compartilhe um vídeo...',
        project: 'Compartilhe seu projeto...',
        question: 'Faça uma pergunta...',
        tip: 'Compartilhe uma dica útil...',
        event: 'Crie um evento...',
        post: 'O que você quer compartilhar?',
      };
      if (textareaRef.current) {
        textareaRef.current.placeholder = placeholders[createType] || placeholders.post;
        textareaRef.current.focus();
      }
    }
  }, []);

  const feelingOptions = [
    { value: 'feliz', label: '😊 Feliz', color: '#FFD700' },
    { value: 'triste', label: '😢 Triste', color: '#4A90D9' },
    { value: 'animado', label: '🤩 Animado', color: '#FF6B6B' },
    { value: 'pensativo', label: '🤔 Pensativo', color: '#9B59B6' },
    { value: 'grato', label: '🙏 Grato', color: '#2ECC71' },
    { value: 'cansado', label: '😴 Cansado', color: '#95A5A6' },
  ];

  const handleTextareaFocus = () => {
    setExpanded(true);
  };

  const handleTextareaBlur = () => {
    if (!content.trim() && !mediaFiles.length && !feeling) {
      setExpanded(false);
    }
  };

  const handleContentChange = (e) => {
    setContent(e.target.value);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      const validTypes = ['image/', 'video/'];
      return validTypes.some(type => file.type.startsWith(type));
    });
    setMediaFiles(prev => [...prev, ...validFiles.slice(0, 5 - prev.length)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeMedia = (index) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFeelingSelect = (feelingValue) => {
    setFeeling(feelingValue);
    setShowFeelingOptions(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim() && !mediaFiles.length && !feeling) return;

    // Dispatch custom event for parent to handle
    const event = new CustomEvent('post_created', {
      detail: { content, mediaFiles, feeling }
    });
    window.dispatchEvent(event);

    // Reset form
    setContent('');
    setMediaFiles([]);
    setFeeling(null);
    setExpanded(false);
    textareaRef.current?.blur();
  };

  return (
    <div className={`create-post-card ${className} ${expanded ? 'expanded' : ''} ${isMobile ? 'mobile' : ''}`}>
      <form onSubmit={handleSubmit} className="create-post-form">
        <div className="create-post-header">
          <Avatar user={user} className="create-post-avatar" size={40} />
          <div className="create-post-input-wrapper">
            <textarea
              ref={textareaRef}
              className="create-post-textarea"
              placeholder={isMobile ? 'O que você quer compartilhar?' : 'O que você está pensando?'}
              value={content}
              onChange={handleContentChange}
              onFocus={handleTextareaFocus}
              onBlur={handleTextareaBlur}
              rows={expanded || isMobile ? 4 : 1}
              aria-label="Conteúdo da publicação"
            />
            {expanded && (
              <div className="create-post-feeling">
                <button
                  type="button"
                  className={`feeling-trigger ${feeling ? 'has-feeling' : ''}`}
                  onClick={() => setShowFeelingOptions(!showFeelingOptions)}
                  aria-label={feeling ? `Sentimento: ${feeling}` : 'Adicionar sentimento'}
                  aria-expanded={showFeelingOptions}
                  aria-haspopup="listbox"
                >
                  <Smile size={20} strokeWidth={2} />
                  <span>{feeling ? feeling.charAt(0).toUpperCase() + feeling.slice(1) : 'Sentimento/Atividade'}</span>
                </button>
                {showFeelingOptions && (
                  <div className="feeling-options-dropdown" role="listbox" aria-label="Escolher sentimento">
                    {feelingOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        className="feeling-option"
                        onClick={() => handleFeelingSelect(option.value)}
                        role="option"
                        aria-selected={feeling === option.value}
                        style={{ borderLeftColor: option.color }}
                      >
                        <span className="feeling-emoji">{option.label.split(' ')[0]}</span>
                        <span className="feeling-label">{option.label.split(' ').slice(1).join(' ')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div className="create-post-media">
            {mediaFiles.map((file, index) => (
              <div key={index} className="media-preview-item">
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Prévia da imagem"
                    className="media-preview-image"
                  />
                ) : (
                  <video
                    src={URL.createObjectURL(file)}
                    className="media-preview-video"
                    controls
                    muted
                  />
                )}
                <button
                  type="button"
                  className="media-remove-btn"
                  onClick={() => removeMedia(index)}
                  aria-label="Remover mídia"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            ))}

            {mediaFiles.length < 5 && (
              <label className="media-add-btn">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="media-file-input"
                  aria-label="Adicionar foto ou vídeo"
                />
                <Camera size={24} strokeWidth={2} />
                <span>Adicionar mídia</span>
              </label>
            )}
          </div>
        )}

        {expanded && (
          <div className="create-post-actions">
            <div className="create-post-action-buttons">
              <label className="action-btn media-btn" htmlFor="media-input">
                <Image size={20} strokeWidth={2} />
                <span>Foto/Vídeo</span>
              </label>
              <label className="action-btn feeling-btn">
                <Smile size={20} strokeWidth={2} />
                <span>Sentimento</span>
              </label>
              <label className="action-btn location-btn">
                <MapPin size={20} strokeWidth={2} />
                <span>Localização</span>
              </label>
            </div>
            <button type="submit" className="create-post-submit" disabled={!content.trim() && !mediaFiles.length && !feeling}>
              <Send size={20} strokeWidth={2.5} />
              <span>Publicar</span>
            </button>
          </div>
        )}
      </form>

      {/* Hidden file input for media button */}
      <input
        id="media-input"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden-file-input"
        aria-hidden="true"
      />
    </div>
  );
};

export default CreatePostCard;