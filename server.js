const express = require('express');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const getMP3Duration = require('get-mp3-duration');
const app = express();
const PORT = 3000;

// List lagu
const songsFolder = path.join(__dirname, 'songs');
let songs = fs.readdirSync(songsFolder).filter(file => file.endsWith('.mp3'));
if (songs.length === 0) {
  console.error('❌ Tidak ada lagu di folder songs!');
  process.exit(1);
}

// Streaming buffer
let clients = [];
let currentStream = null;
let currentSongIndex = 0;

function playNextSong() {
  const songPath = path.join(songsFolder, songs[currentSongIndex]);
  console.log(`🎵 Sekarang memutar: ${songs[currentSongIndex]}`);

  const readStream = fs.createReadStream(songPath);
  currentStream = new PassThrough();
  readStream.pipe(currentStream, { end: false });

  // Cek durasi lagu menggunakan get-mp3-duration
  fs.readFile(songPath, (err, buffer) => {
    if (err) {
      console.error('❌ Gagal membaca file:', err);
      return;
    }

    const duration = getMP3Duration(buffer);
    console.log(`⏳ Durasi lagu: ${duration} ms`);

    // Kirim data ke semua clients
    currentStream.on('data', (chunk) => {
      clients.forEach((res) => res.write(chunk)); // Kirim chunk ke setiap client
    });

    // Ketika lagu selesai, lanjutkan ke lagu berikutnya
    readStream.on('end', () => {
      console.log('🔁 Lagu selesai, lanjut ke berikutnya...');
      currentSongIndex = (currentSongIndex + 1) % songs.length;
      playNextSong();
    });
  });

  readStream.on('error', (err) => {
    console.error('Error streaming lagu:', err);
    currentSongIndex = (currentSongIndex + 1) % songs.length;
    playNextSong();
  });
}

// Mulai streaming lagu pertama
playNextSong();

// Endpoint radio
app.get('/radio', (req, res) => {
  res.setHeader('Content-Type', 'audio/mpeg');
  const clientStream = new PassThrough(); // Membuat stream baru untuk setiap client
  clients.push(clientStream); // Menyimpan client stream
  clientStream.pipe(res); // Pipe stream ke client yang baru terhubung
  console.log(`🟢 Client terhubung. Total: ${clients.length}`);

  req.on('close', () => {
    clients = clients.filter((c) => c !== clientStream);
    console.log(`🔴 Client terputus. Total: ${clients.length}`);
  });
});

// Info page
app.get('/', (req, res) => {
  res.send('<h1>🎶 Welcome to Node.js Radio (LIVE)</h1><p>Streaming: <a href="/radio">/radio</a></p>');
});

app.listen(PORT, () => {
  console.log(`Radio server berjalan di http://localhost:${PORT}`);
});
