const MAX_QUESTIONS = 100;
const MAX_CHOICES = 12;
const idOk = (value) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 200;
export function evaluateSkillAssessment(input) {
    if (!idOk(input.assessmentId) || !idOk(input.attemptId))
        throw new Error('Assessment and attempt IDs must be valid');
    if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > MAX_QUESTIONS)
        throw new Error('Assessment must contain 1-100 questions');
    const threshold = input.passThreshold ?? 80;
    if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100)
        throw new Error('Pass threshold must be between 1 and 100');
    const questionIds = new Set();
    for (const q of input.questions) {
        if (!idOk(q.id) || !idOk(q.skillId) || !idOk(q.prompt))
            throw new Error('Question ID, skill ID and prompt are required');
        if (questionIds.has(q.id))
            throw new Error(`Duplicate question ID: ${q.id}`);
        questionIds.add(q.id);
        if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > MAX_CHOICES || q.choices.some(c => typeof c !== 'string' || !c.trim()))
            throw new Error(`Question ${q.id} has invalid choices`);
        if (!Number.isInteger(q.correctChoice) || q.correctChoice < 0 || q.correctChoice >= q.choices.length)
            throw new Error(`Question ${q.id} has invalid answer key`);
    }
    if (!Array.isArray(input.answers))
        throw new Error('Answers must be a list');
    const answerByQuestion = new Map();
    for (const answer of input.answers) {
        if (!idOk(answer.questionId) || !questionIds.has(answer.questionId))
            throw new Error(`Answer references unknown question: ${answer.questionId}`);
        if (answerByQuestion.has(answer.questionId))
            throw new Error(`Duplicate answer for question: ${answer.questionId}`);
        if (!Number.isInteger(answer.choice) || answer.choice < 0 || answer.choice >= input.questions.find(q => q.id === answer.questionId).choices.length)
            throw new Error(`Invalid choice for question: ${answer.questionId}`);
        answerByQuestion.set(answer.questionId, answer.choice);
    }
    const perSkill = new Map();
    let correct = 0;
    for (const q of input.questions) {
        const bucket = perSkill.get(q.skillId) ?? { total: 0, correct: 0 };
        bucket.total++;
        if (answerByQuestion.get(q.id) === q.correctChoice) {
            bucket.correct++;
            correct++;
        }
        perSkill.set(q.skillId, bucket);
    }
    const score = Math.round((correct / input.questions.length) * 10000) / 100;
    const verifiedSkillIds = [...perSkill].filter(([, v]) => Math.round(v.correct / v.total * 10000) / 100 >= threshold).map(([skill]) => skill).sort();
    const weakSkillIds = [...perSkill].filter(([, v]) => Math.round(v.correct / v.total * 10000) / 100 < threshold).map(([skill]) => skill).sort();
    return {
        assessmentId: input.assessmentId, attemptId: input.attemptId, score, correct, total: input.questions.length,
        passed: score >= threshold, verifiedSkillIds, weakSkillIds,
        recommendations: weakSkillIds.map(skillId => `Review ${skillId} fundamentals, then complete a practical quest and reassess.`),
        rewardIssued: false,
    };
}
