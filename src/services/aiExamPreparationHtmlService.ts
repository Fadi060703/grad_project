import type { ExamPreparation } from "./aiExamPreparationService";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeJsonForScript = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export const renderExamPreparationHtml = (exam: ExamPreparation) => {
  const questionsHtml = exam.questions
    .map(
      (question, index) => `
        <article class="question-card" data-question-index="${index}">
          <div class="question-header">
            <span>Question ${index + 1}</span>
          </div>
          <h2>${escapeHtml(question.question)}</h2>
          <div class="options">
            ${question.options
              .map(
                (option) => `
                  <button type="button" class="option" data-option-id="${escapeHtml(option.id)}">
                    <span class="option-id">${escapeHtml(option.id)}</span>
                    <span>${escapeHtml(option.text)}</span>
                  </button>`,
              )
              .join("\n")}
          </div>
          <p class="feedback" aria-live="polite"></p>
        </article>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="" dir="auto">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(exam.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --surface: #ffffff;
      --surface-soft: #eef3ff;
      --text: #111827;
      --muted: #667085;
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --success: #15803d;
      --success-bg: #dcfce7;
      --danger: #b42318;
      --danger-bg: #fee4e2;
      --border: #d9e2f2;
      --shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.14), transparent 34rem),
        linear-gradient(135deg, #f8fbff 0%, var(--bg) 100%);
    }

    .page {
      width: min(980px, 100%);
      margin: 0 auto;
      padding: 32px 18px 48px;
    }

    .hero,
    .score-card,
    .question-card {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }

    .hero {
      padding: clamp(22px, 4vw, 42px);
      margin-bottom: 18px;
    }

    .eyebrow {
      margin: 0 0 12px;
      color: var(--primary-dark);
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 5vw, 3.6rem);
      line-height: 1.05;
      letter-spacing: -0.055em;
    }

    .subtitle {
      margin: 16px 0 0;
      color: var(--muted);
      font-size: clamp(1rem, 2vw, 1.12rem);
      line-height: 1.75;
    }

    .score-card {
      position: sticky;
      top: 12px;
      z-index: 5;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      padding: 14px 18px;
      margin-bottom: 18px;
      backdrop-filter: blur(12px);
    }

    .score-card strong { color: var(--primary-dark); }

    .questions {
      display: grid;
      gap: 18px;
    }

    .question-card {
      padding: clamp(18px, 3vw, 28px);
    }

    .question-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .question-header span {
      display: inline-flex;
      border-radius: 999px;
      padding: 7px 11px;
      color: var(--primary-dark);
      background: var(--surface-soft);
      font-size: 0.84rem;
      font-weight: 900;
    }

    h2 {
      margin: 0 0 18px;
      font-size: clamp(1.15rem, 2.5vw, 1.55rem);
      line-height: 1.55;
      letter-spacing: -0.025em;
    }

    .options {
      display: grid;
      gap: 10px;
    }

    .option {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: white;
      color: var(--text);
      padding: 14px;
      text-align: start;
      font: inherit;
      line-height: 1.55;
      cursor: pointer;
      transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
    }

    .option:hover,
    .option:focus-visible {
      border-color: var(--primary);
      transform: translateY(-1px);
      outline: none;
    }

    .option-id {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 10px;
      color: var(--primary-dark);
      background: var(--surface-soft);
      font-weight: 900;
    }

    .option.correct {
      border-color: rgba(21, 128, 61, 0.45);
      background: var(--success-bg);
    }

    .option.wrong {
      border-color: rgba(180, 35, 24, 0.45);
      background: var(--danger-bg);
    }

    .question-card.answered .option:not(.selected):not(.correct) {
      opacity: 0.72;
    }

    .feedback {
      display: none;
      margin: 16px 0 0;
      border-radius: 18px;
      padding: 14px;
      line-height: 1.7;
      font-weight: 700;
    }

    .feedback.correct {
      display: block;
      color: var(--success);
      background: var(--success-bg);
    }

    .feedback.wrong {
      display: block;
      color: var(--danger);
      background: var(--danger-bg);
    }

    @media (max-width: 640px) {
      .page { padding: 18px 12px 32px; }
      .hero, .score-card, .question-card { border-radius: 22px; }
      .score-card { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <p class="eyebrow">AI exam preparation</p>
      <h1>${escapeHtml(exam.title)}</h1>
      <p class="subtitle">${escapeHtml(exam.overview)}</p>
    </header>

    <section class="score-card">
      <div>Answered: <strong id="answeredCount">0</strong> / ${exam.questions.length}</div>
      <div>Correct: <strong id="correctCount">0</strong></div>
    </section>

    <section class="questions">
      ${questionsHtml}
    </section>
  </main>

  <script>
    const questions = ${escapeJsonForScript(exam.questions)};
    const answers = new Map();

    const updateScore = () => {
      let correct = 0;
      answers.forEach((isCorrect) => {
        if (isCorrect) correct += 1;
      });
      document.getElementById('answeredCount').textContent = String(answers.size);
      document.getElementById('correctCount').textContent = String(correct);
    };

    document.querySelectorAll('.question-card').forEach((card) => {
      const questionIndex = Number(card.dataset.questionIndex);
      const question = questions[questionIndex];
      const feedback = card.querySelector('.feedback');

      card.querySelectorAll('.option').forEach((button) => {
        button.addEventListener('click', () => {
          if (card.classList.contains('answered')) return;

          const selectedId = button.dataset.optionId;
          const isCorrect = selectedId === question.correct_option_id;
          answers.set(questionIndex, isCorrect);
          card.classList.add('answered');

          card.querySelectorAll('.option').forEach((optionButton) => {
            const optionId = optionButton.dataset.optionId;
            optionButton.disabled = true;
            if (optionId === selectedId) optionButton.classList.add('selected');
            if (optionId === question.correct_option_id) optionButton.classList.add('correct');
          });

          if (!isCorrect) button.classList.add('wrong');

          const sourceText = question.page_reference ? ' Source: ' + question.page_reference : '';

          feedback.className = isCorrect ? 'feedback correct' : 'feedback wrong';
          feedback.textContent = isCorrect
            ? 'Correct. ' + question.explanation + sourceText
            : 'Wrong. Correct answer: ' + question.correct_option_id + '. ' + question.explanation + sourceText;

          updateScore();
        });
      });
    });
  </script>
</body>
</html>`;
};
