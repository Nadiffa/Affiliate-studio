const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ELEVENLABS_API_KEY;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

function requireKey(res) {
  if (!API_KEY) {
    res.status(500).json({ error: 'ELEVENLABS_API_KEY belum dipasang di Environment Variables server.' });
    return false;
  }
  return true;
}

app.get('/api/voices', async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const r = await fetch('https://api.elevenlabs.io/v2/voices', {
      headers: { 'xi-api-key': API_KEY }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.detail?.message || data?.detail || 'Gagal mengambil daftar suara.' });
    res.json({ voices: (data.voices || []).map(v => ({ id: v.voice_id, name: v.name, labels: v.labels || {} })) });
  } catch (e) {
    res.status(502).json({ error: 'Tidak dapat terhubung ke ElevenLabs.' });
  }
});

app.post('/api/voice', async (req, res) => {
  if (!requireKey(res)) return;
  const { text, voiceId, speed = 1, style = 'Natural', expression = 60 } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Dialog wajib diisi.' });
  if (!voiceId) return res.status(400).json({ error: 'Pilih voice terlebih dahulu.' });

  const speedNum = Math.min(1.2, Math.max(0.8, Number(speed) || 1));
  const stability = Math.min(0.9, Math.max(0.25, 0.72 - (Number(expression) || 60) / 500));
  const similarity = 0.78;
  const styleExaggeration = Math.min(1, Math.max(0, (Number(expression) || 60) / 100));

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability,
          similarity_boost: similarity,
          style: styleExaggeration,
          use_speaker_boost: true,
          speed: speedNum
        }
      })
    });
    if (!r.ok) {
      const msg = await r.text();
      return res.status(r.status).json({ error: msg || 'ElevenLabs gagal membuat audio.' });
    }
    const audio = Buffer.from(await r.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Disposition', 'inline; filename="affiliate-voice.mp3"');
    res.send(audio);
  } catch (e) {
    res.status(502).json({ error: 'Gagal membuat audio dari ElevenLabs.' });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`Affiliate Studio running on port ${PORT}`));
