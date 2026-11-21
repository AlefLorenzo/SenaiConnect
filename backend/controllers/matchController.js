const db = require('../db');

const normalizeList = (strOrArray) => {
    if (!strOrArray) return [];
    let arr = [];
    try {
        arr = typeof strOrArray === 'string' ? JSON.parse(strOrArray) : strOrArray;
        if (!Array.isArray(arr)) {
            // handle string like "Python, React"
            arr = typeof strOrArray === 'string' ? strOrArray.split(',') : [strOrArray];
        }
    } catch (e) {
        arr = typeof strOrArray === 'string' ? strOrArray.split(',') : [String(strOrArray)];
    }
    return arr.map(item => String(item).trim().toLowerCase()).filter(item => item.length > 0);
};

const calculateMatch = (me, other) => {
    let score = 0;
    const reasons = [];

    // 1. Course/Area (15%) - Reduced to avoid dominating the score
    let courseScore = 0;
    if (me.course && other.course && me.course.trim().toLowerCase() === other.course.trim().toLowerCase()) {
        courseScore = 15;
        reasons.push(`Vocês são do mesmo curso (${me.course.trim()})`);
    } else if (me.area && other.area && me.area.trim().toLowerCase() === other.area.trim().toLowerCase()) {
        courseScore = 10;
        reasons.push(`Vocês são de áreas de estudo relacionadas`);
    }
    score += courseScore;

    // Normalize arrays
    const mySkills = normalizeList(me.skills);
    const myToLearn = normalizeList(me.skills_to_learn);
    const myInterests = normalizeList(me.interests);

    const otherSkills = normalizeList(other.skills);
    const otherToLearn = normalizeList(other.skills_to_learn);
    const otherInterests = normalizeList(other.interests);

    // 2. Complementary Skills (40%) - The most important factor for a learning community
    let complementaryScore = 0;
    let iTeachThem = mySkills.filter(s => otherToLearn.includes(s));
    let theyTeachMe = otherSkills.filter(s => myToLearn.includes(s));
    
    let mutualLearning = false;
    if (iTeachThem.length > 0 && theyTeachMe.length > 0) {
        mutualLearning = true;
        complementaryScore = 40; // Max score for bidirectional
        reasons.unshift(`🤝 Combinação perfeita: você pode ajudar com ${iTeachThem[0]} e aprender ${theyTeachMe[0]}!`);
    } else if (iTeachThem.length > 0) {
        complementaryScore = 20;
        reasons.push(`💡 Você tem a habilidade que essa pessoa quer aprender (${iTeachThem[0]})`);
    } else if (theyTeachMe.length > 0) {
        complementaryScore = 20;
        reasons.push(`💡 Essa pessoa possui a habilidade que você quer aprender (${theyTeachMe[0]})`);
    }
    score += complementaryScore;

    // 3. Shared Interests (20%)
    const sharedInterests = myInterests.filter(i => otherInterests.includes(i));
    let interestScore = 0;
    if (myInterests.length > 0 && sharedInterests.length > 0) {
        // Proportional to how many we share, cap at 20
        interestScore = Math.min(20, (sharedInterests.length / myInterests.length) * 20);
        if (interestScore > 0) {
            reasons.push(`Vocês têm interesses em comum (como ${sharedInterests[0]})`);
        }
    }
    score += interestScore;

    // 4. Shared Skills (15%)
    const sharedSkills = mySkills.filter(s => otherSkills.includes(s));
    let skillScore = 0;
    if (mySkills.length > 0 && sharedSkills.length > 0) {
        skillScore = Math.min(15, (sharedSkills.length / mySkills.length) * 15);
        if (skillScore > 0) {
            reasons.push(`Vocês já dominam habilidades em comum (como ${sharedSkills[0]})`);
        }
    }
    score += skillScore;

    // 5. Objective/Profile (10%)
    let objectiveScore = 0;
    if (me.objective && other.objective) {
        const myObj = me.objective.trim().toLowerCase();
        const theirObj = other.objective.trim().toLowerCase();
        if (myObj === theirObj || myObj.includes(theirObj) || theirObj.includes(myObj)) {
            objectiveScore = 10;
            reasons.push(`Vocês têm objetivos profissionais alinhados`);
        }
    } else if (me.unit && other.unit && me.unit.trim().toLowerCase() === other.unit.trim().toLowerCase()) {
        objectiveScore = 5; // Fallback to same unit if objective not detailed enough
        if (!reasons.find(r => r.includes('área/curso'))) {
            reasons.push(`Vocês estudam na mesma unidade SENAI`);
        }
    }
    score += objectiveScore;

    const breakdown = {
        course: courseScore,
        complementarity: complementaryScore,
        interests: interestScore,
        skills: skillScore,
        objective: objectiveScore,
        total: Math.min(100, Math.round(score))
    };

    return {
        score: breakdown.total,
        reasons: reasons,
        breakdown
    };
};

const matchController = {
    getRecommendations: async (req, res) => {
        try {
            const userId = req.user.id;

            // Fetch me
            const [[me]] = await db.query(
                'SELECT id, course, area, skills, skills_to_learn, interests, objective, unit FROM users WHERE id = ?', 
                [userId]
            );

            if (!me) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            // Fetch potential matches (exclude self, blocked, and already followed)
            // Note: Currently we'll fetch a batch, calculate in node, and sort.
            // Exclude users we are already following as requested by "don't repeat recommendations".
            const [candidates] = await db.query(
                `SELECT u.id, u.name, u.avatar, u.role, u.course, u.area, u.unit, u.skills, u.skills_to_learn, u.interests, u.objective
                 FROM users u
                 WHERE u.id != ?
                 AND u.onboarding_completed = 1
                 AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = u.id)
                 AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = u.id AND blocked_id = ?)
                 AND NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = u.id)
                 LIMIT 100`, // fetch up to 100 to score them in memory
                [userId, userId, userId, userId]
            );

            const scoredCandidates = [];

            for (const candidate of candidates) {
                const matchResult = calculateMatch(me, candidate);
                
                // Keep only matches with at least some relevance (e.g. > 10%)
                if (matchResult.score >= 10) {
                    scoredCandidates.push({
                        id: candidate.id,
                        name: candidate.name,
                        avatar: candidate.avatar,
                        role: candidate.role,
                        course: candidate.course,
                        unit: candidate.unit,
                        matchPercentage: matchResult.score,
                        reasons: matchResult.reasons,
                        breakdown: matchResult.breakdown
                    });
                }
            }

            // Sort by score descending
            scoredCandidates.sort((a, b) => b.matchPercentage - a.matchPercentage);

            // Return top 5
            res.status(200).json(scoredCandidates.slice(0, 5));
        } catch (error) {
            console.error('Erro ao buscar recomendações:', error);
            res.status(500).json({ error: 'Erro ao processar matchmaking.' });
        }
    }
};

module.exports = matchController;
