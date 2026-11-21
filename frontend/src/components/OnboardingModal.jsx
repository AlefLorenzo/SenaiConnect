import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, GraduationCap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import './OnboardingModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const OnboardingModal = () => {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Form states
  const [course, setCourse] = useState(user?.course || '');
  const [unit, setUnit] = useState(user?.unit || '');
  const [objective, setObjective] = useState(user?.objective || '');

  useEffect(() => {
    // Show only if explicitly false (so it doesn't show randomly if undefined)
    if (user && user.onboarding_completed === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
    }
  }, [user]);

  if (!isVisible) return null;

  const handleNext = () => setStep(prev => prev + 1);

  const handleFinish = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({
          course,
          unit,
          objective,
          onboarding_completed: 1
        })
      });

      if (res.ok) {
        setUser(prev => ({ ...prev, course, unit, objective, onboarding_completed: 1 }));
        setIsVisible(false);
        navigate('/explore'); // Take them to explore page to find people!
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao concluir onboarding.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal card">
        <div className="onboarding-header">
          <div className="onboarding-logo">
            <span className="logo-text">SENAI</span>
            <span className="logo-sub">CONNECT</span>
          </div>
          <div className="onboarding-progress">
            <div className={`progress-dot ${step >= 1 ? 'active' : ''}`}></div>
            <div className={`progress-dot ${step >= 2 ? 'active' : ''}`}></div>
            <div className={`progress-dot ${step >= 3 ? 'active' : ''}`}></div>
          </div>
        </div>

        <div className="onboarding-content">
          {step === 1 && (
            <div className="step-content animate-fade-in">
              <h2>Bem-vindo(a) ao SENAI Connect! 🎉</h2>
              <p>Esta é sua rede educacional e profissional. Para te conectarmos com as pessoas certas, precisamos de algumas informações básicas.</p>
              
              <div className="form-group">
                <label><Building size={16} /> Sua Unidade SENAI</label>
                <input 
                  type="text" 
                  className="modal-input" 
                  placeholder="Ex: SENAI Suíço-Brasileira" 
                  value={unit} 
                  onChange={e => setUnit(e.target.value)} 
                />
                <small>Isso ajuda a encontrar colegas da mesma unidade.</small>
              </div>

              <div className="form-group">
                <label><GraduationCap size={16} /> Qual seu Curso/Área?</label>
                <input 
                  type="text" 
                  className="modal-input" 
                  placeholder="Ex: Desenvolvimento de Sistemas" 
                  value={course} 
                  onChange={e => setCourse(e.target.value)} 
                />
                <small>Usamos isso para recomendar conteúdos relevantes.</small>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-content animate-fade-in">
              <h2>Seus Objetivos 🚀</h2>
              <p>O SENAI Connect também é um portfólio profissional. O que você busca no momento?</p>
              
              <div className="form-group">
                <label>Objetivo Profissional (Opcional)</label>
                <textarea 
                  className="modal-textarea" 
                  placeholder="Ex: Procuro um estágio em desenvolvimento frontend e quero aprender React..." 
                  value={objective} 
                  onChange={e => setObjective(e.target.value)}
                  style={{ minHeight: '100px' }}
                />
                <small>Você sempre pode mudar isso depois no seu perfil.</small>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step-content animate-fade-in step-final">
              <div className="success-icon-wrapper">
                <CheckCircle2 size={64} color="var(--senai-blue-primary)" />
              </div>
              <h2>Tudo pronto, {user.name.split(' ')[0]}!</h2>
              <p>Seu perfil está configurado. A seguir, vamos para a tela "Explorar" para você encontrar professores e colegas do seu curso para seguir.</p>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          {step > 1 ? (
            <button className="btn-secondary" onClick={() => setStep(prev => prev - 1)} disabled={loading}>Voltar</button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button className="btn-primary" onClick={handleNext} disabled={step === 1 && (!unit.trim() || !course.trim())}>
              Próximo <ArrowRight size={16} style={{marginLeft: '8px'}} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleFinish} disabled={loading}>
              {loading ? 'Concluindo...' : 'Começar!'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
