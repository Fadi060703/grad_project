import type {
  CourseFileSummaryData,
  Flashcard,
  SummaryContentBlock,
} from "./aiStudyMaterialsService";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const commonStyles = `
  :root {
    color-scheme: light;
    --bg: #f5f7fb;
    --surface: #ffffff;
    --surface-soft: #eef3ff;
    --text: #111827;
    --muted: #667085;
    --primary: #2563eb;
    --primary-dark: #1d4ed8;
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
    width: min(1120px, 100%);
    margin: 0 auto;
    padding: 32px 18px 48px;
  }

  .hero {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(217, 226, 242, 0.88);
    border-radius: 28px;
    padding: clamp(22px, 4vw, 42px);
    box-shadow: var(--shadow);
    backdrop-filter: blur(14px);
    margin-bottom: 24px;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    color: var(--primary-dark);
    font-size: 0.82rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 5vw, 4rem);
    line-height: 1.05;
    letter-spacing: -0.055em;
  }

  .subtitle {
    margin: 16px 0 0;
    max-width: 760px;
    color: var(--muted);
    font-size: clamp(1rem, 2vw, 1.14rem);
    line-height: 1.75;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 22px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface-soft);
    color: #344054;
    padding: 8px 12px;
    font-size: 0.9rem;
    font-weight: 700;
  }

  @media (max-width: 640px) {
    .page { padding: 18px 12px 32px; }
    .hero { border-radius: 22px; }
  }
`;

const fullHtml = (title: string, body: string) => `<!doctype html>
<html lang="" dir="auto">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body>
${body}
</body>
</html>`;

const shuffle = <T>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const renderFlashcardsHtml = (params: {
  title: string;
  courseType: string;
  cards: Flashcard[];
}) => {
  const selectedCards = shuffle(params.cards).slice(0, Math.min(10, params.cards.length));

  const cardsHtml = selectedCards
    .map(
      (card, index) => `
        <article class="card" tabindex="0" role="button" aria-label="Flashcard ${index + 1}. Press to flip.">
          <div class="card-inner">
            <section class="card-face card-front">
              <span class="number">${index + 1}</span>
              <p>${escapeHtml(card.question)}</p>
            </section>
            <section class="card-face card-back">
              <span class="number">Answer</span>
              <p>${escapeHtml(card.answer)}</p>
            </section>
          </div>
        </article>`,
    )
    .join("\n");

  return fullHtml(
    `${params.title} flashcards`,
    `<style>
      ${commonStyles}
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 18px;
      }

      .card {
        min-height: 250px;
        perspective: 1200px;
        cursor: pointer;
        outline: none;
      }

      .card:focus-visible .card-inner {
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.24), var(--shadow);
      }

      .card-inner {
        position: relative;
        width: 100%;
        min-height: 250px;
        transform-style: preserve-3d;
        transition: transform 240ms ease;
      }

      .card.flipped .card-inner { transform: rotateY(180deg); }

      .card-face {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 24px;
        border: 1px solid var(--border);
        border-radius: 26px;
        background: var(--surface);
        box-shadow: var(--shadow);
        backface-visibility: hidden;
        overflow-y: auto;
      }

      .card-back {
        transform: rotateY(180deg);
        color: white;
        border-color: rgba(255, 255, 255, 0.18);
        background: linear-gradient(135deg, var(--primary), #4f46e5);
      }

      .number {
        width: fit-content;
        border-radius: 999px;
        padding: 7px 11px;
        color: var(--primary-dark);
        background: var(--surface-soft);
        font-size: 0.8rem;
        font-weight: 900;
      }

      .card-back .number {
        color: white;
        background: rgba(255, 255, 255, 0.18);
      }

      .card p {
        margin: 0;
        font-size: clamp(1.08rem, 2.4vw, 1.32rem);
        line-height: 1.65;
        font-weight: 750;
      }
    </style>
    <main class="page">
      <header class="hero">
        <p class="eyebrow">AI study flashcards</p>
        <h1>${escapeHtml(params.title)}</h1>
        <p class="subtitle">Tap or press Enter on a card to flip it.</p>
        <div class="meta">
          <span class="pill">${escapeHtml(params.courseType.toLowerCase())}</span>
          <span class="pill">${selectedCards.length} cards</span>
        </div>
      </header>
      <section class="grid">${cardsHtml}</section>
    </main>
    <script>
      document.querySelectorAll('.card').forEach((card) => {
        const flip = () => card.classList.toggle('flipped');
        card.addEventListener('click', flip);
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            flip();
          }
        });
      });
    </script>`,
  );
};

const renderContentBlock = (block: SummaryContentBlock) => {
  switch (block.type) {
    case "text":
      return `<p>${escapeHtml(block.text)}</p>`;
    case "list":
      return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    case "formula":
      return `<figure class="formula"><code>${escapeHtml(block.latex)}</code>${block.fallback_text ? `<figcaption>${escapeHtml(block.fallback_text)}</figcaption>` : block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}</figure>`;
    case "code":
      return `<pre><span>${escapeHtml(block.language ?? "code")}</span><code>${escapeHtml(block.code)}</code></pre>`;
    case "table":
      return `<div class="table-wrap"><table><thead><tr>${block.headers
        .map((header) => `<th>${escapeHtml(header)}</th>`)
        .join("")}</tr></thead><tbody>${block.rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody></table></div>`;
  }
};

export const renderSummaryHtml = (params: {
  title: string;
  courseType: string;
  summary: CourseFileSummaryData;
}) => {
  const sectionsHtml = params.summary.sections
    .map(
      (section, index) => `
        <section class="section-card">
          <div class="section-heading">
            <span>${index + 1}</span>
            <div>
              <h2>${escapeHtml(section.heading)}</h2>
              ${section.page_reference ? `<p>${escapeHtml(section.page_reference)}</p>` : ""}
            </div>
          </div>
          <div class="content">${section.content.map(renderContentBlock).join("\n")}</div>
        </section>`,
    )
    .join("\n");

  const glossaryHtml = params.summary.glossary.length
    ? `<section class="glossary"><h2>Glossary</h2><div class="glossary-grid">${params.summary.glossary
        .map(
          (item) =>
            `<article><h3>${escapeHtml(item.term)}</h3><p>${escapeHtml(item.definition)}</p></article>`,
        )
        .join("")}</div></section>`
    : "";

  return fullHtml(
    `${params.title} summary`,
    `<style>
      ${commonStyles}
      .layout {
        display: grid;
        gap: 18px;
      }

      .section-card,
      .glossary {
        border: 1px solid var(--border);
        border-radius: 26px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 12px 38px rgba(15, 23, 42, 0.08);
        padding: clamp(18px, 3vw, 28px);
      }

      .section-heading {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        margin-bottom: 18px;
      }

      .section-heading > span {
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 14px;
        color: white;
        background: var(--primary);
        font-weight: 900;
      }

      h2 {
        margin: 0;
        font-size: clamp(1.25rem, 3vw, 1.8rem);
        letter-spacing: -0.03em;
      }

      .section-heading p {
        margin: 6px 0 0;
        color: var(--muted);
        font-weight: 700;
      }

      .content {
        color: #253044;
        font-size: 1rem;
        line-height: 1.85;
      }

      .content p { margin: 0 0 14px; }
      .content ul { margin: 0 0 14px; padding-inline-start: 24px; }
      .content li { margin: 6px 0; }

      .formula {
        margin: 18px 0;
        border-radius: 18px;
        background: #0f172a;
        color: white;
        padding: 18px;
        overflow-x: auto;
      }

      .formula code {
        font-family: "SFMono-Regular", Consolas, monospace;
        white-space: pre-wrap;
      }

      .formula figcaption {
        margin-top: 8px;
        color: rgba(255, 255, 255, 0.74);
      }

      pre {
        margin: 18px 0;
        border-radius: 18px;
        background: #101828;
        color: #e5e7eb;
        overflow-x: auto;
      }

      pre span {
        display: block;
        padding: 10px 14px;
        color: #bfdbfe;
        background: rgba(255, 255, 255, 0.05);
        font-size: 0.82rem;
        font-weight: 800;
      }

      pre code {
        display: block;
        padding: 16px;
        font-family: "SFMono-Regular", Consolas, monospace;
        white-space: pre;
      }

      .table-wrap {
        overflow-x: auto;
        margin: 18px 0;
        border: 1px solid var(--border);
        border-radius: 18px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 520px;
        background: white;
      }

      th, td {
        padding: 13px 14px;
        border-bottom: 1px solid var(--border);
        text-align: start;
        vertical-align: top;
      }

      th {
        color: #344054;
        background: var(--surface-soft);
        font-size: 0.88rem;
      }

      tr:last-child td { border-bottom: 0; }

      .glossary h2 { margin-bottom: 16px; }
      .glossary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }

      .glossary article {
        border-radius: 18px;
        background: var(--surface-soft);
        padding: 16px;
      }

      .glossary h3 {
        margin: 0 0 8px;
        color: var(--primary-dark);
      }

      .glossary p { margin: 0; color: #475467; line-height: 1.7; }
    </style>
    <main class="page">
      <header class="hero">
        <p class="eyebrow">AI course-file summary</p>
        <h1>${escapeHtml(params.summary.title || params.title)}</h1>
        <p class="subtitle">${escapeHtml(params.summary.overview)}</p>
        <div class="meta">
          <span class="pill">${escapeHtml(params.courseType.toLowerCase())}</span>
          <span class="pill">${params.summary.sections.length} sections</span>
        </div>
      </header>
      <div class="layout">${sectionsHtml}${glossaryHtml}</div>
    </main>`,
  );
};
