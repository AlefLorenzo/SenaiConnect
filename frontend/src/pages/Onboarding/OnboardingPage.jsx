import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import Avatar from '../../components/Avatar';
import './OnboardingPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ─── Static data ─────────────────────────────────────────────────────────────
const COURSES = [
  'Desenvolvimento de Sistemas', 'Análise e Desenvolvimento de Sistemas',
  'Redes de Computadores', 'Eletrotécnica', 'Eletrônica', 'Mecânica',
  'Mecatrônica', 'Administração', 'Logística', 'Marketing', 'Design Gráfico',
  'Automação Industrial', 'Edificações', 'Segurança do Trabalho',
  'Cozinha', 'Nutrição', 'Saúde Bucal', 'Farmácia',
];

const SKILLS_BY_COURSE = {
  'Desenvolvimento de Sistemas': ['JavaScript', 'Python', 'React', 'Node.js', 'Java', 'HTML', 'CSS', 'SQL', 'Git', 'TypeScript', 'APIs', 'Docker'],
  'Redes de Computadores':       ['Cisco', 'TCP/IP', 'Firewall', 'Linux', 'Windows Server', 'Cabeamento', 'Segurança', 'VPN', 'DNS', 'DHCP'],
  'Eletrotécnica':                ['Circuitos', 'CLP', 'Automação', 'NR-10', 'SCADA', 'Inversores', 'Pneumática', 'Hidráulica', 'Energia Solar'],
  'Eletrônica':                   ['Arduino', 'ESP32', 'Eletrônica Digital', 'Osciloscópio', 'Soldagem', 'Circuitos', 'IoT', 'Programação C'],
  'Mecânica':                     ['AutoCAD', 'SolidWorks', 'Torno', 'Fresadora', 'GD&T', 'CNC', 'Metrologia', 'Materiais'],
  'Design Gráfico':               ['Photoshop', 'Illustrator', 'Figma', 'InDesign', 'UI/UX', 'Identidade Visual', 'Motion', 'Tipografia'],
  'Administração':                ['Excel', 'Gestão de Projetos', 'Power BI', 'Financeiro', 'RH', 'Liderança', 'Logística', 'Marketing'],
  'Logística':                    ['WMS', 'Transporte', 'Supply Chain', 'Excel', 'Inventário', 'Gestão de Estoque'],
  'Automação Industrial':         ['CLP', 'SCADA', 'Robótica', 'Pneumática', 'Inversores', 'Redes Industriais', 'Servo'],
};

const GENERIC_SKILLS = [
  'Excel', 'Power BI', 'Python', 'Gestão de Projetos', 'Liderança',
  'Comunicação', 'Inglês', 'Espanhol', 'Photoshop', 'Figma', 'SQL',
  'Arduino', 'Programação', 'Marketing', 'Design', 'Finanças',
];

const INTERESTS = [
  'Tecnologia', 'Programação', 'Robótica', 'IA & Machine Learning',
  'Empreendedorismo', 'Inovação', 'Design', 'Games', 'Eletrônica',
  'Automação', 'Indústria 4.0', 'Carreira', 'Negócios', 'Pesquisa',
  'Sustentabilidade', 'Saúde', 'Arte', 'Música', 'Esportes',
];

function getSkillsForCourse(course) {
  if (!course) return GENERIC_SKILLS;
  const key = Object.keys(SKILLS_BY_COURSE).find(
    k => k.toLowerCase() === course.toLowerCase()
  );
  return key ? [...SKILLS_BY_COURSE[key], ...GENERIC_SKILLS.filter(s => !SKILLS_BY_COURSE[key].includes(s))].slice(0, 18)
              : GENERIC_SKILLS;
}

// ─── Save helper with retry ───────────────────────────────────────────────────
async function silentSave(userId, data, token, attempt = 0) {
  try {
    const res = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
      return silentSave(userId, data, token, attempt + 1);
    }
    return false;
  }
}

// ─── Chip component ───────────────────────────────────────────────────────────
function Chip({ label, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      className={`ob-chip ${selected ? 'ob-chip--selected' : ''} ${disabled && !selected ? 'ob-chip--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled && !selected}
      aria-pressed={selected}
    >
      {selected && <span className="ob-chip-check" aria-hidden="true">✓</span>}
      {label}
    </button>
  );
}

// ─── Match Card component ─────────────────────────────────────────────────────
function MatchCard({ person, onFollow, onViewProfile }) {
  const [following, setFollowing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFollow = async () => {
    if (following || saving) return;
    setSaving(true);
    const ok = await onFollow(person.id);
    if (ok) setFollowing(true);
    setSaving(false);
  };

  return (
    <div className="ob-match-card">
      <div className="ob-match-card__header">
        <Avatar
          src={person.avatar}
          name={person.name}
          size={52}
          className="ob-match-card__avatar"
        />
        <div className="ob-match-card__info">
          <span className="ob-match-card__name">{person.name}</span>
          <span className="ob-match-card__course">{person.course || 'SENAI Connect'}</span>
        </div>
        <div className="ob-match-badge">
          <span className="ob-match-badge__pct">{person.matchPercentage}%</span>
          <span className="ob-match-badge__label">match</span>
        </div>
      </div>

      {person.reasons && person.reasons.length > 0 && (
        <div className="ob-match-reasons-wrap">
          <p className="ob-match-reasons-title">Por que vocês combinam?</p>
          <ul className="ob-match-reasons-list">
            {person.reasons.map((reason, idx) => (
              <li key={idx} className="ob-match-card__reason">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ob-match-card__actions">
        <button
          className={`ob-btn ob-btn--follow ${following ? 'ob-btn--following' : ''}`}
          onClick={handleFollow}
          disabled={saving}
        >
          {saving ? '...' : following ? 'Seguindo ✓' : 'Seguir'}
        </button>
        <button className="ob-btn ob-btn--ghost" onClick={() => onViewProfile(person.id)}>
          Ver perfil
        </button>
      </div>
    </div>
  );
}

// ─── Main OnboardingPage ──────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const token = sessionStorage.getItem('token');

  const [step, setStep] = useState(1); // 1–7
  const [direction, setDirection] = useState('forward'); // for animation

  // Form state
  const [courseSearch, setCourseSearch] = useState(user?.course || '');
  const [course, setCourse] = useState(user?.course || '');
  const [skills, setSkills] = useState(() => {
    try { return JSON.parse(user?.skills || '[]'); } catch { return []; }
  });
  const [skillsToLearn, setSkillsToLearn] = useState(() => {
    try { return JSON.parse(user?.skills_to_learn || '[]'); } catch { return []; }
  });
  const [interests, setInterests] = useState(() => {
    try { return JSON.parse(user?.interests || '[]'); } catch { return []; }
  });

  const [saveError, setSaveError] = useState(false);
  const [matches, setMatches] = useState([]);
  const [finishing, setFinishing] = useState(false);

  const filteredCourses = COURSES.filter(c =>
    c.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const availableSkills = getSkillsForCourse(course);

  // ── Transitions ───────────────────────────────────────────────────────────
  const [animKey, setAnimKey] = useState(0);
  const goTo = useCallback((nextStep, dir = 'forward') => {
    setDirection(dir);
    setAnimKey(k => k + 1);
    setStep(nextStep);
  }, []);

  // ── Save logic ────────────────────────────────────────────────────────────
  const save = useCallback(async (data) => {
    setSaveError(false);
    const ok = await silentSave(user.id, data, token);
    if (!ok) setSaveError(true);
    return ok;
  }, [user.id, token]);

  // ── Step navigation ───────────────────────────────────────────────────────
  const handleStep1Next = async () => {
    if (!course) return;
    await save({ course });
    setUser(prev => ({ ...prev, course }));
    goTo(2);
  };

  const handleStep2Next = async () => {
    await save({ skills: JSON.stringify(skills) });
    setUser(prev => ({ ...prev, skills: JSON.stringify(skills) }));
    goTo(3);
  };

  const handleStep3Next = async () => {
    await save({ skills_to_learn: JSON.stringify(skillsToLearn) });
    setUser(prev => ({ ...prev, skills_to_learn: JSON.stringify(skillsToLearn) }));
    goTo(4);
  };

  const handleStep4Next = async () => {
    await save({ interests: JSON.stringify(interests) });
    setUser(prev => ({ ...prev, interests: JSON.stringify(interests) }));
    goTo(5); // loading
  };

  // When reaching step 5 (loading), fetch matches then go to step 6
  useEffect(() => {
    if (step !== 5) return;
     
    // setLoadingMatches(true); // removed unused variable

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/match/recommendations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMatches(data);
        }
      } catch { /* non-critical */ }
      // setLoadingMatches(false); // removed unused variable
      goTo(6);
    }, 2200); // elegant pause

    return () => clearTimeout(timeout);
  }, [step, goTo, token]);

  const handleFollow = async (targetId) => {
    try {
      const res = await fetch(`${API_URL}/api/follows/${targetId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch { return false; }
  };

  const handleViewProfile = (id) => {
    // Open in new tab so the user can return to onboarding
    window.open(`/profile/${id}`, '_blank');
  };

  const handleFinish = async () => {
    setFinishing(true);
    await save({ onboarding_completed: 1 });
    setUser(prev => ({ ...prev, onboarding_completed: 1 }));
    navigate('/');
  };

  const toggleSkill = (list, setList, item, max = 5) => {
    setList(prev => {
      if (prev.includes(item)) return prev.filter(s => s !== item);
      if (prev.length >= max) return prev;
      return [...prev, item];
    });
  };

  // ── Step content ──────────────────────────────────────────────────────────
  const stepAnimClass = `ob-step ob-step--${direction}`;

  return (
    <div className="ob-root">
      <div className="ob-container">

        {/* Logo */}
        <div className="ob-logo">
          <span className="ob-logo__senai">SENAI</span>
          <span className="ob-logo__connect">Connect</span>
        </div>

        {/* Progress bar (steps 1–4 only) */}
        {step <= 4 && (
          <div className="ob-progress" role="progressbar" aria-valuenow={step} aria-valuemax={4}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`ob-progress__dot ${step >= s ? 'ob-progress__dot--active' : ''} ${step > s ? 'ob-progress__dot--done' : ''}`} />
            ))}
          </div>
        )}

        {/* ─── STEPS ──────────────────────────────────────────────────── */}
        <div className={stepAnimClass} key={animKey}>

          {/* STEP 1 — Course */}
          {step === 1 && (
            <div className="ob-card">
              <div className="ob-card__eyebrow">Bem-vindo, {user?.name?.split(' ')[0]} 👋</div>
              <h1 className="ob-card__title">Qual curso você está fazendo?</h1>
              <p className="ob-card__subtitle">Isso nos ajuda a encontrar pessoas e conteúdos que fazem sentido para você.</p>

              <div className="ob-search-wrap">
                <input
                  className="ob-search"
                  type="text"
                  placeholder="Pesquisar curso..."
                  value={courseSearch}
                  onChange={e => setCourseSearch(e.target.value)}
                  autoFocus
                  aria-label="Pesquisar curso"
                />
              </div>

              <div className="ob-course-list">
                {filteredCourses.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`ob-course-item ${course === c ? 'ob-course-item--selected' : ''}`}
                    onClick={() => { setCourse(c); setCourseSearch(c); }}
                    aria-pressed={course === c}
                  >
                    {c}
                    {course === c && <span className="ob-course-check" aria-hidden="true">✓</span>}
                  </button>
                ))}
                {filteredCourses.length === 0 && courseSearch.length > 1 && (
                  <button
                    type="button"
                    className={`ob-course-item ob-course-item--custom ${course === courseSearch ? 'ob-course-item--selected' : ''}`}
                    onClick={() => setCourse(courseSearch)}
                  >
                    Usar "{courseSearch}"
                    {course === courseSearch && <span className="ob-course-check" aria-hidden="true">✓</span>}
                  </button>
                )}
              </div>

              <button
                className="ob-btn ob-btn--primary ob-btn--full"
                onClick={handleStep1Next}
                disabled={!course}
              >
                Continuar
              </button>
            </div>
          )}

          {/* STEP 2 — Skills */}
          {step === 2 && (
            <div className="ob-card">
              <div className="ob-card__eyebrow">2 de 4</div>
              <h1 className="ob-card__title">O que você já sabe fazer?</h1>
              <p className="ob-card__subtitle">
                Escolha até <strong>5 habilidades</strong>.
                <span className={`ob-counter ${skills.length >= 5 ? 'ob-counter--max' : ''}`}>
                  {skills.length}/5 selecionadas
                </span>
              </p>

              <div className="ob-chips">
                {availableSkills.map(s => (
                  <Chip
                    key={s}
                    label={s}
                    selected={skills.includes(s)}
                    onClick={() => toggleSkill(skills, setSkills, s)}
                    disabled={skills.length >= 5}
                  />
                ))}
              </div>

              <div className="ob-nav">
                <button className="ob-btn ob-btn--ghost" onClick={() => goTo(1, 'back')}>Voltar</button>
                <button className="ob-btn ob-btn--primary" onClick={handleStep2Next}>Continuar</button>
              </div>
            </div>
          )}

          {/* STEP 3 — Skills to learn */}
          {step === 3 && (
            <div className="ob-card">
              <div className="ob-card__eyebrow">3 de 4</div>
              <h1 className="ob-card__title">O que você quer aprender?</h1>
              <p className="ob-card__subtitle">
                Isso nos ajuda a encontrar pessoas que podem te ensinar.
                <span className={`ob-counter ${skillsToLearn.length >= 5 ? 'ob-counter--max' : ''}`}>
                  {skillsToLearn.length}/5 selecionadas
                </span>
              </p>

              <div className="ob-chips">
                {availableSkills.map(s => (
                  <Chip
                    key={s}
                    label={s}
                    selected={skillsToLearn.includes(s)}
                    onClick={() => toggleSkill(skillsToLearn, setSkillsToLearn, s)}
                    disabled={skillsToLearn.length >= 5}
                  />
                ))}
              </div>

              <div className="ob-nav">
                <button className="ob-btn ob-btn--ghost" onClick={() => goTo(2, 'back')}>Voltar</button>
                <button className="ob-btn ob-btn--primary" onClick={handleStep3Next}>Continuar</button>
              </div>
            </div>
          )}

          {/* STEP 4 — Interests */}
          {step === 4 && (
            <div className="ob-card">
              <div className="ob-card__eyebrow">4 de 4</div>
              <h1 className="ob-card__title">O que desperta seu interesse?</h1>
              <p className="ob-card__subtitle">Além do seu curso, o que você gosta?</p>

              <div className="ob-chips">
                {INTERESTS.map(i => (
                  <Chip
                    key={i}
                    label={i}
                    selected={interests.includes(i)}
                    onClick={() => toggleSkill(interests, setInterests, i, 10)}
                    disabled={interests.length >= 10}
                  />
                ))}
              </div>

              <div className="ob-nav">
                <button className="ob-btn ob-btn--ghost" onClick={() => goTo(3, 'back')}>Voltar</button>
                <button className="ob-btn ob-btn--primary" onClick={handleStep4Next}>Continuar</button>
              </div>
            </div>
          )}

          {/* STEP 5 — Loading matchmaking */}
          {step === 5 && (
            <div className="ob-loading-screen">
              <div className="ob-loading-ring" aria-hidden="true">
                <div /><div /><div /><div />
              </div>
              <h2 className="ob-loading-title">Encontrando pessoas que combinam com você...</h2>
              <p className="ob-loading-sub">Analisando habilidades, interesses e possíveis conexões de aprendizagem.</p>
            </div>
          )}

          {/* STEP 6 — Recommendations */}
          {step === 6 && (
            <div className="ob-card ob-card--wide">
              <div className="ob-card__eyebrow">Conexões sugeridas</div>
              <h1 className="ob-card__title">
                {matches.length > 0
                  ? 'Encontramos pessoas que combinam com você'
                  : 'Sua comunidade está crescendo'}
              </h1>
              <p className="ob-card__subtitle">
                {matches.length > 0
                  ? 'Você pode seguir quem quiser agora ou depois, sem pressa.'
                  : 'Ainda não encontramos pessoas muito próximas ao seu perfil. Conforme a comunidade crescer, novas conexões aparecerão.'}
              </p>

              {matches.length > 0 && (
                <div className="ob-matches">
                  {matches.map(person => (
                    <MatchCard
                      key={person.id}
                      person={person}
                      onFollow={handleFollow}
                      onViewProfile={handleViewProfile}
                    />
                  ))}
                </div>
              )}

              <button
                className="ob-btn ob-btn--primary ob-btn--full"
                onClick={() => goTo(7)}
                style={{ marginTop: '24px' }}
              >
                {matches.length > 0 ? 'Continuar' : 'Entrar na comunidade'}
              </button>
            </div>
          )}

          {/* STEP 7 — Done */}
          {step === 7 && (
            <div className="ob-card ob-card--center">
              <div className="ob-done-icon" aria-hidden="true">🎉</div>
              <h1 className="ob-card__title">Sua comunidade está pronta.</h1>
              <p className="ob-card__subtitle">
                Agora você já pode descobrir pessoas, projetos e oportunidades que fazem sentido para você.
              </p>
              <button
                className="ob-btn ob-btn--primary ob-btn--full"
                onClick={handleFinish}
                disabled={finishing}
              >
                {finishing ? 'Entrando...' : 'Entrar na comunidade'}
              </button>
            </div>
          )}

        </div>

        {/* Discrete save error */}
        {saveError && (
          <div className="ob-save-error" role="alert">
            Não conseguimos salvar agora. Tentando novamente...
          </div>
        )}
      </div>
    </div>
  );
}
