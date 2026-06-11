// ===== DATA =====
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_ALIASES = {'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B'};

let songs = JSON.parse(localStorage.getItem('kordku_songs') || '[]');
let currentId = null;
let currentTab = 'edit';

// ===== HELPERS =====
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function saveSongs() {
  localStorage.setItem('kordku_songs', JSON.stringify(songs));
}

function getSong(id) { return songs.find(s => s.id === id); }

// ===== CHORD TRANSPOSE =====
function parseChord(chord) {
  const m = chord.match(/^([A-G][b#]?)(.*)/);
  if (!m) return null;
  let root = m[1];
  const rest = m[2];
  if (NOTE_ALIASES[root]) root = NOTE_ALIASES[root];
  const idx = NOTES.indexOf(root);
  if (idx === -1) return null;
  return { idx, rest };
}

function transposeChord(chord, steps) {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  const newIdx = (parsed.idx + steps + 12) % 12;
  return NOTES[newIdx] + parsed.rest;
}

function transposeChordLine(line, steps) {
  if (!line.trim()) return line;
  return line.replace(/([A-G][b#]?(?:maj|min|m|dim|aug|sus|add|[0-9]|\/[A-G][b#]?)*)/g, (match) => {
    const parsed = parseChord(match);
    return parsed ? transposeChord(match, steps) : match;
  });
}

// ===== RENDER SIDEBAR =====
function renderSidebar() {
  const list = document.getElementById('songList');
  if (songs.length === 0) {
    list.innerHTML = '<div style="padding:16px;font-size:0.8rem;color:var(--muted);text-align:center">Belum ada lagu</div>';
    return;
  }
  list.innerHTML = songs.map(s => `
    <div class="song-item ${s.id === currentId ? 'active' : ''}" onclick="openSong('${s.id}')">
      <div class="song-item-info">
        <div class="song-item-title">${s.title || 'Tanpa judul'}</div>
        <div class="song-item-artist">${s.artist || '—'}</div>
      </div>
      <button class="song-delete" onclick="deleteSong(event,'${s.id}')">✕</button>
    </div>
  `).join('');
}

// ===== OPEN / CREATE SONG =====
function openSong(id) {
  currentId = id;
  const song = getSong(id);
  document.getElementById('emptyState').style.display = 'none';
  const ea = document.getElementById('editorArea');
  ea.style.display = 'flex';
  ea.style.flexDirection = 'column';
  ea.style.flex = '1';
  ea.style.overflow = 'hidden';

  document.getElementById('songTitle').value = song.title || '';
  document.getElementById('songArtist').value = song.artist || '';

  document.getElementById('transposeDisplay').textContent = NOTES[song.transposeBase ?? 0];

  renderLines();
  renderSidebar();
  switchTab('edit');
}

function openNewSongModal() {
  document.getElementById('newTitle').value = '';
  document.getElementById('newArtist').value = '';
  document.getElementById('newSongModal').style.display = 'flex';
  setTimeout(() => document.getElementById('newTitle').focus(), 50);
}

function closeModal() {
  document.getElementById('newSongModal').style.display = 'none';
}

function createSong() {
  const title = document.getElementById('newTitle').value.trim() || 'Lagu Baru';
  const artist = document.getElementById('newArtist').value.trim();
  const song = {
    id: genId(),
    title, artist,
    transposeBase: 0,
    lines: [{ chord: '', lyric: '' }]
  };
  songs.unshift(song);
  saveSongs();
  closeModal();
  openSong(song.id);
}

function deleteSong(e, id) {
  e.stopPropagation();
  songs = songs.filter(s => s.id !== id);
  saveSongs();
  if (currentId === id) {
    currentId = null;
    document.getElementById('editorArea').style.display = 'none';
    document.getElementById('emptyState').style.display = 'flex';
  }
  renderSidebar();
}

// ===== SAVE =====
function saveCurrent() {
  if (!currentId) return;
  const song = getSong(currentId);
  song.title = document.getElementById('songTitle').value;
  song.artist = document.getElementById('songArtist').value;
  saveSongs();
  renderSidebar();
}

function saveLines() {
  if (!currentId) return;
  const song = getSong(currentId);
  const chordInputs = document.querySelectorAll('.chord-input');
  const lyricInputs = document.querySelectorAll('.lyric-input');
  song.lines = [];
  chordInputs.forEach((ci, i) => {
    song.lines.push({ chord: ci.value, lyric: lyricInputs[i]?.value || '' });
  });
  saveSongs();
}

// ===== LINES RENDER =====
function renderLines() {
  if (!currentId) return;
  const song = getSong(currentId);
  const container = document.getElementById('editMode');
  container.innerHTML = '';
  (song.lines || []).forEach((line, i) => {
    container.appendChild(makeLineEl(line, i));
  });
}

function makeLineEl(line, i) {
  const div = document.createElement('div');
  div.className = 'line-editor';
  div.dataset.idx = i;
  div.innerHTML = `
    <div class="line-num">${i+1}</div>
    <div class="line-fields">
      <input class="chord-input" placeholder="Am   G   F   C" value="${escHtml(line.chord)}" 
        oninput="saveLines()" onkeydown="handleChordKey(event,${i})">
      <input class="lyric-input" placeholder="ketik lirik di sini..." value="${escHtml(line.lyric)}"
        oninput="saveLines()" onkeydown="handleLyricKey(event,${i})">
    </div>
    <button class="del-line" onclick="deleteLine(${i})">✕</button>
  `;
  return div;
}

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function handleChordKey(e, i) {
  if (e.key === 'Enter' || e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const lyricInputs = document.querySelectorAll('.lyric-input');
    lyricInputs[i]?.focus();
  }
}

function handleLyricKey(e, i) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveLines();
    insertLineAfter(i);
  }
}

function addLine() {
  if (!currentId) return;
  const song = getSong(currentId);
  song.lines.push({ chord: '', lyric: '' });
  saveSongs();
  renderLines();
  setTimeout(() => {
    const inputs = document.querySelectorAll('.chord-input');
    inputs[inputs.length - 1]?.focus();
  }, 50);
}

function insertLineAfter(i) {
  if (!currentId) return;
  const song = getSong(currentId);
  song.lines.splice(i + 1, 0, { chord: '', lyric: '' });
  saveSongs();
  renderLines();
  setTimeout(() => {
    const inputs = document.querySelectorAll('.lyric-input');
    inputs[i + 1]?.focus();
  }, 50);
}

function deleteLine(i) {
  if (!currentId) return;
  const song = getSong(currentId);
  if (song.lines.length <= 1) return;
  song.lines.splice(i, 1);
  saveSongs();
  renderLines();
}

// ===== TRANSPOSE =====
function transpose(steps) {
  if (!currentId) return;
  const song = getSong(currentId);
  saveLines();
  song.transposeBase = ((song.transposeBase ?? 0) + steps + 12) % 12;
  song.lines = song.lines.map(line => ({
    chord: transposeChordLine(line.chord, steps),
    lyric: line.lyric
  }));
  saveSongs();
  document.getElementById('transposeDisplay').textContent = NOTES[song.transposeBase];
  renderLines();
  if (currentTab === 'preview') renderPreview();
}

// ===== TABS =====
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabEdit').classList.toggle('active', tab === 'edit');
  document.getElementById('tabPreview').classList.toggle('active', tab === 'preview');
  document.getElementById('editMode').style.display = tab === 'edit' ? 'flex' : 'none';
  document.getElementById('previewMode').style.display = tab === 'preview' ? 'block' : 'none';
  if (tab === 'preview') {
    saveLines();
    renderPreview();
  }
}

function renderPreview() {
  if (!currentId) return;
  const song = getSong(currentId);
  const container = document.getElementById('previewMode');
  container.innerHTML = '';
  const section = document.createElement('div');
  section.className = 'preview-section';
  (song.lines || []).forEach(line => {
    const div = document.createElement('div');
    if (!line.chord && !line.lyric) {
      div.className = 'preview-empty';
    } else {
      div.className = 'preview-line';
      if (line.chord) {
        const c = document.createElement('div');
        c.className = 'preview-chords';
        c.textContent = line.chord;
        div.appendChild(c);
      }
      const l = document.createElement('div');
      l.className = 'preview-lyric';
      l.textContent = line.lyric || '';
      div.appendChild(l);
    }
    section.appendChild(div);
  });
  container.appendChild(section);
}

// ===== EXPORT =====
function exportTxt() {
  if (!currentId) return;
  saveLines();
  const song = getSong(currentId);
  let txt = `${song.title || 'Lagu'}\n`;
  if (song.artist) txt += `${song.artist}\n`;
  txt += '\n';
  (song.lines || []).forEach(line => {
    if (line.chord) txt += line.chord + '\n';
    txt += (line.lyric || '') + '\n';
  });
  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${song.title || 'lagu'}.txt`;
  a.click();
}

// ===== INIT =====
renderSidebar();
if (songs.length > 0) openSong(songs[0].id);

document.getElementById('newSongModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});