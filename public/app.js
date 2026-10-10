const form = document.getElementById('chatForm');
const promptInput = document.getElementById('prompt');
const messages = document.getElementById('messages');
const scroll = document.getElementById('chatScroll');
const intro = document.getElementById('intro');
const sendButton = form.querySelector('button[type="submit"]');

function bottom() { scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' }); }
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function addUser(text) {
  const row = element('div', 'message-row user-row');
  row.append(element('div', 'user-bubble', text));
  messages.append(row);
  bottom();
}

function addStatus(text) {
  const row = element('div', 'message-row assistant-row');
  row.append(element('div', 'assistant-avatar', '#'));
  const bubble = element('div', 'status-bubble', text);
  row.append(bubble);
  messages.append(row);
  bottom();
  return row;
}

function addChoices(result) {
  const row = element('div', 'message-row assistant-row');
  row.append(element('div', 'assistant-avatar', '#'));
  const content = element('div', 'choice-content');
  content.append(element('p', 'assistant-caption', result.error));
  const list = element('div', 'choice-list');
  result.choices.forEach(choice => {
    const button = element('button', 'choice-button', choice.label + '  ↗');
    button.type = 'button';
    button.addEventListener('click', () => submit(choice.prompt));
    list.append(button);
  });
  content.append(list);
  row.append(content);
  messages.append(row);
  bottom();
}

function addResult(result) {
  const row = element('div', 'message-row assistant-row');
  row.append(element('div', 'assistant-avatar', '#'));
  const content = element('div', 'result-content');
  content.append(element('p', 'assistant-caption', result.player ? `${result.player} · ${result.team} · #${result.number}` : `Here’s your ${result.team} #${result.number}.`));
  const card = element('article', 'jersey-card');
  const imageStage = element('div', 'jersey-stage');
  const image = element('img', 'jersey-image');
  image.src = result.imageUrl;
  image.alt = `${result.team} jersey with number ${result.number}`;
  image.loading = 'eager';
  imageStage.append(image);
  card.append(imageStage);
  const cardFooter = element('div', 'jersey-card-footer');
  const meta = element('div', 'jersey-meta');
  meta.append(element('span', 'jersey-overline', result.code + ' / CUSTOM JERSEY'));
  meta.append(element('strong', '', result.team));
  cardFooter.append(meta);
  const download = element('a', 'download-button', '↓  DOWNLOAD PNG');
  download.href = result.downloadUrl;
  download.download = result.downloadName;
  download.setAttribute('aria-label', `Download ${result.team} number ${result.number} as PNG`);
  cardFooter.append(download);
  card.append(cardFooter);
  content.append(card);
  if (result.player) {
    const checked = result.rosterAsOf ? new Date(result.rosterAsOf).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    content.append(element('p', 'roster-note', `nflverse ${result.season} roster · checked ${checked}${result.rosterStale ? ' · cached data' : ''}`));
  }
  content.append(element('p', 'followup', 'Want another? Type a different team and number.'));
  row.append(content);
  messages.append(row);
  bottom();
  image.addEventListener('load', bottom, { once: true });
}

async function submit(text) {
  const message = text.trim();
  if (!message) return;
  intro.hidden = true;
  addUser(message);
  promptInput.value = '';
  promptInput.disabled = true;
  sendButton.disabled = true;
  const status = addStatus('Making your jersey…');
  try {
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    const result = await response.json();
    status.remove();
    if (result.choices) addChoices(result);
    else if (!response.ok) addStatus(result.error || 'Something went wrong. Please try again.');
    else addResult(result);
  } catch {
    status.remove();
    addStatus('Could not connect to the jersey maker. Please try again.');
  } finally {
    promptInput.disabled = false;
    sendButton.disabled = false;
    promptInput.focus();
  }
}

form.addEventListener('submit', event => { event.preventDefault(); submit(promptInput.value); });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => submit(button.dataset.prompt)));
