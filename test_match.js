/**
 * Audit script for matchController algorithm.
 * Run with: node test_match.js
 */

// ─── Inline the normalizeList and calculateMatch from matchController ─────────
const normalizeList = (strOrArray) => {
    if (!strOrArray) return [];
    let arr = [];
    try {
        arr = typeof strOrArray === 'string' ? JSON.parse(strOrArray) : strOrArray;
        if (!Array.isArray(arr)) {
            arr = typeof strOrArray === 'string' ? strOrArray.split(',') : [strOrArray];
        }
    } catch (e) {
        arr = typeof strOrArray === 'string' ? strOrArray.split(',') : [String(strOrArray)];
    }
    return arr.map(item => String(item).trim().toLowerCase()).filter(item => item.length > 0);
};

const calculateMatch = (me, other) => {
    const breakdown = {};

    // 1. Course/Area (max 15)
    let courseScore = 0;
    if (me.course && other.course && me.course.trim().toLowerCase() === other.course.trim().toLowerCase()) {
        courseScore = 15;
    } else if (me.area && other.area && me.area.trim().toLowerCase() === other.area.trim().toLowerCase()) {
        courseScore = 10;
    }
    breakdown.course = { raw: courseScore, max: 15 };

    // Normalize
    const mySkills    = normalizeList(me.skills);
    const myToLearn   = normalizeList(me.skills_to_learn);
    const myInterests = normalizeList(me.interests);
    const otherSkills    = normalizeList(other.skills);
    const otherToLearn   = normalizeList(other.skills_to_learn);
    const otherInterests = normalizeList(other.interests);

    // 2. Complementarity (max 40)
    let complementaryScore = 0;
    const iTeachThem = mySkills.filter(s => otherToLearn.includes(s));
    const theyTeachMe = otherSkills.filter(s => myToLearn.includes(s));
    if (iTeachThem.length > 0 && theyTeachMe.length > 0) {
        complementaryScore = 40;
    } else if (iTeachThem.length > 0 || theyTeachMe.length > 0) {
        complementaryScore = 20;
    }
    breakdown.complementarity = { raw: complementaryScore, max: 40, iTeachThem, theyTeachMe };

    // 3. Shared Interests (max 20)
    const sharedInterests = myInterests.filter(i => otherInterests.includes(i));
    let interestScore = 0;
    if (myInterests.length > 0 && sharedInterests.length > 0) {
        interestScore = Math.min(20, (sharedInterests.length / myInterests.length) * 20);
    }
    breakdown.interests = { raw: interestScore, max: 20, shared: sharedInterests };

    // 4. Shared Skills (max 15)
    const sharedSkills = mySkills.filter(s => otherSkills.includes(s));
    let skillScore = 0;
    if (mySkills.length > 0 && sharedSkills.length > 0) {
        skillScore = Math.min(15, (sharedSkills.length / mySkills.length) * 15);
    }
    breakdown.skills = { raw: skillScore, max: 15, shared: sharedSkills };

    // 5. Objective (max 10)
    let objectiveScore = 0;
    if (me.objective && other.objective) {
        const myObj = me.objective.trim().toLowerCase();
        const theirObj = other.objective.trim().toLowerCase();
        if (myObj === theirObj || myObj.includes(theirObj) || theirObj.includes(myObj)) {
            objectiveScore = 10;
        }
    } else if (me.unit && other.unit && me.unit.trim().toLowerCase() === other.unit.trim().toLowerCase()) {
        objectiveScore = 5;
    }
    breakdown.objective = { raw: objectiveScore, max: 10 };

    const total = courseScore + complementaryScore + interestScore + skillScore + objectiveScore;
    const clamped = Math.min(100, Math.max(0, Math.round(total)));

    return { score: clamped, breakdown };
};

// ─── Print helper ─────────────────────────────────────────────────────────────
function printResult(label, me, other) {
    const result = calculateMatch(me, other);
    const b = result.breakdown;
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 ${label}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`   Curso/Área:         ${b.course.raw.toFixed(1).padStart(5)} / ${b.course.max}`);
    console.log(`   Complementaridade:  ${b.complementarity.raw.toFixed(1).padStart(5)} / ${b.complementarity.max}`);
    if (b.complementarity.iTeachThem.length > 0)
        console.log(`     → Eu ensino: ${b.complementarity.iTeachThem.join(', ')}`);
    if (b.complementarity.theyTeachMe.length > 0)
        console.log(`     → Aprendo: ${b.complementarity.theyTeachMe.join(', ')}`);
    console.log(`   Interesses comuns:  ${b.interests.raw.toFixed(1).padStart(5)} / ${b.interests.max}  [${b.interests.shared.join(', ')}]`);
    console.log(`   Skills comuns:      ${b.skills.raw.toFixed(1).padStart(5)} / ${b.skills.max}  [${b.skills.shared.join(', ')}]`);
    console.log(`   Objetivo:           ${b.objective.raw.toFixed(1).padStart(5)} / ${b.objective.max}`);
    console.log(`   ${'─'.repeat(40)}`);
    console.log(`   ✅ MATCH TOTAL:     ${String(result.score).padStart(5)} / 100`);
}

// ─── TEST CASES ───────────────────────────────────────────────────────────────

// Caso A — Complementaridade Perfeita (deve ser muito alto)
printResult('Caso A — Complementaridade perfeita',
    { course: 'Desenvolvimento de Sistemas', skills: ['JavaScript'], skills_to_learn: ['Python'], interests: [], objective: null, unit: null, area: null },
    { course: 'Redes', skills: ['Python'], skills_to_learn: ['JavaScript'], interests: [], objective: null, unit: null, area: null }
);

// Caso B — Mesmo curso, skills iguais, interesses diferentes (similaridade, não complementaridade)
printResult('Caso B — Mesma área, pouca complementaridade',
    { course: 'Desenvolvimento de Sistemas', skills: ['JavaScript'], skills_to_learn: [], interests: ['Games'], objective: null, unit: null, area: null },
    { course: 'Desenvolvimento de Sistemas', skills: ['JavaScript'], skills_to_learn: [], interests: ['Eletrônica'], objective: null, unit: null, area: null }
);

// Caso C — Cursos diferentes mas grande complementaridade (deve superar B)
printResult('Caso C — Cursos diferentes, alta complementaridade',
    { course: 'Desenvolvimento de Sistemas', skills: ['JavaScript'], skills_to_learn: ['Python'], interests: [], objective: null, unit: null, area: null },
    { course: 'Redes', skills: ['Python'], skills_to_learn: ['JavaScript'], interests: [], objective: null, unit: null, area: null }
);

// Caso D — Perfil vazio (não pode quebrar ou inventar)
printResult('Caso D — Perfil completamente vazio',
    { course: null, skills: null, skills_to_learn: null, interests: null, objective: null, unit: null, area: null },
    { course: null, skills: null, skills_to_learn: null, interests: null, objective: null, unit: null, area: null }
);

// Caso E — Um perfil vazio, outro completo
printResult('Caso E — Um completo, um vazio',
    { course: 'Eletrotécnica', skills: ['CLP', 'Automação'], skills_to_learn: ['Python'], interests: ['Robótica', 'IoT'], objective: 'Trabalhar com automação', unit: 'Unidade Centro', area: null },
    { course: null, skills: null, skills_to_learn: null, interests: null, objective: null, unit: null, area: null }
);

// Caso F — Complementaridade unilateral (só eu ensino, não aprendo)
printResult('Caso F — Complementaridade unilateral (só eu ensino)',
    { course: null, skills: ['Python'], skills_to_learn: ['React'], interests: [], objective: null, unit: null, area: null },
    { course: null, skills: ['HTML', 'CSS'], skills_to_learn: ['Python'], interests: [], objective: null, unit: null, area: null }
);

// Caso G — Verifica que A > B: complementaridade > similaridade de curso
const caseA = calculateMatch(
    { course: 'Dev', skills: ['JavaScript'], skills_to_learn: ['Python'], interests: [], objective: null, unit: null, area: null },
    { course: 'Redes', skills: ['Python'], skills_to_learn: ['JavaScript'], interests: [], objective: null, unit: null, area: null }
);
const caseB = calculateMatch(
    { course: 'Dev', skills: ['JavaScript'], skills_to_learn: [], interests: ['Games'], objective: null, unit: null, area: null },
    { course: 'Dev', skills: ['JavaScript'], skills_to_learn: [], interests: ['Eletrônica'], objective: null, unit: null, area: null }
);

console.log('\n' + '═'.repeat(60));
console.log('🏆 VALIDAÇÃO FINAL DOS CRITÉRIOS DO PLANO');
console.log('═'.repeat(60));
console.log(`   Caso A (complementaridade perfeita):    ${caseA.score}/100`);
console.log(`   Caso B (similaridade sem aprendizado):  ${caseB.score}/100`);
console.log(`   ✅ A > B? ${caseA.score > caseB.score ? 'SIM ✓ (correto)' : 'NÃO ✗ (problema!)'}`);
console.log(`   ✅ Nenhum score > 100? ${[caseA.score, caseB.score].every(s => s <= 100 && s >= 0) ? 'SIM ✓' : 'NÃO ✗ (problema!)'}`);
console.log('');
