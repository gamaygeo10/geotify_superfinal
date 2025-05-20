import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { JamendoService } from '../services/spotify.service';
import { Router } from '@angular/router';
import { AudioService } from '../services/audio.service';
import { AlertController } from '@ionic/angular';
import { LocalFilesService } from '../services/local-files.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  playMode: 'streaming' | 'local' = 'streaming';
  searchQuery = '';
  tracks: any[] = [];
  filteredLocalTracks: any[] = [];
  recentSongs: any[] = [];
  topSongs: any[] = [];
  shuffledTopSongs: any[] = [];
  genreSongs: any = {};
  genres: string[] = ['pop', 'rock', 'jazz', 'hiphop', 'classical'];
  localTracks: any[] = [];

  constructor(
    private jamendo: JamendoService,
    private router: Router,
    private audioService: AudioService,
    private alertCtrl: AlertController,
    private localFilesService: LocalFilesService
  ) {}

  async ngOnInit() {
    this.loadRecentSongs();

    window.addEventListener('recentSongsUpdated', (event: any) => {
      this.recentSongs = event.detail.slice(0, 3);
    });

    this.loadRecentSongs();
    this.loadTopSongs();
    this.loadGenreSongs();
    await this.loadLocalTracks();
  }

  async loadTopSongs() {
    this.jamendo.getTopSongs().subscribe((res: any) => {
      this.topSongs = res.results;
      this.shuffleTopSongs();
    });
  }

  shuffleTopSongs() {
    this.shuffledTopSongs = this.topSongs
      .map(song => ({ song, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ song }) => song);
  }

  async loadLocalTracks() {
    const savedTracks = JSON.parse(localStorage.getItem('localTracks') || '[]');
    const files = await this.localFilesService.getAllFiles();

    this.localTracks = savedTracks.map((meta: any) => {
      const file = files.find(f => f.name === meta.name);
      const filePath = file ? URL.createObjectURL(file) : '';
      return { ...meta, filePath };
    });
  }

  onPlayModeChange(event: any) {
    // Keep searchQuery intact, just update results for new mode
    this.tracks = [];
    this.filteredLocalTracks = [];

    if (this.searchQuery.trim().length > 0) {
      this.searchTracks();
    }

    if (this.playMode === 'local') {
      this.loadLocalTracks();
    }
  }

  searchTracks() {
    const query = this.searchQuery.trim().toLowerCase();

    if (query.length === 0) {
      this.tracks = [];
      this.filteredLocalTracks = [];
      return;
    }

    if (this.playMode === 'streaming') {
      this.jamendo.searchTracks(query).subscribe((res: any) => {
        this.tracks = res.results;
      });
      this.filteredLocalTracks = [];
    } else if (this.playMode === 'local') {
      this.filteredLocalTracks = this.localTracks.filter(track =>
        (track.name && track.name.toLowerCase().includes(query)) ||
        (track.artist_name && track.artist_name.toLowerCase().includes(query))
      );
      this.tracks = [];
    }
  }

  playTrack(track: any, sourceList: any[] = [track]) {
  if (this.playMode === 'streaming') {
    const index = sourceList.findIndex(t => t.id === track.id);
    this.audioService.setPlaylist(sourceList, index);
    this.router.navigate(['/now-playing']);
    this.saveRecentlyPlayed(track);
    // Clear search and tracks when playing a song from search
    this.searchQuery = '';
    this.tracks = [];
  } else {
    const index = this.localTracks.findIndex(t => t.name === track.name);
    if (index !== -1) {
      this.audioService.setPlaylist(this.localTracks, index);
      this.router.navigate(['/now-playing']);
    } else {
      this.audioService.playLocalTrack(track);
      this.router.navigate(['/now-playing']);
    }
    this.saveRecentlyPlayed(track);
    // Clear local search as well when playing local song
    this.searchQuery = '';
    this.filteredLocalTracks = [];
  }
}


  async addToPlaylist(track: any, event: Event) {
    event.stopPropagation();
    const playlistKey = 'userPlaylist';
    let playlist = JSON.parse(localStorage.getItem(playlistKey) || '[]');

    const exists = playlist.some(
      (song: any) => (song.id && track.id && song.id === track.id) || (song.name === track.name)
    );
    if (exists) {
      const alert = await this.alertCtrl.create({
        header: 'Already Added',
        message: `"${track.name}" is already in your playlist.`,
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    playlist.push(track);
    localStorage.setItem(playlistKey, JSON.stringify(playlist));

    const alert = await this.alertCtrl.create({
      header: 'Added to Playlist',
      message: `"${track.name}" was added to your playlist.`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  saveRecentlyPlayed(track: any) {
    let recent = JSON.parse(localStorage.getItem('recentSongs') || '[]');

    recent = recent.filter((item: any) => {
      if (item.id !== undefined && track.id !== undefined) {
        return item.id !== track.id;
      }
      return item.name !== track.name;
    });

    recent.unshift(track);
    if (recent.length > 3) recent.pop();

    localStorage.setItem('recentSongs', JSON.stringify(recent));
    this.recentSongs = recent.slice(0, 3);

    window.dispatchEvent(new CustomEvent('recentSongsUpdated', { detail: recent }));
  }

  loadRecentSongs() {
    const saved = localStorage.getItem('recentSongs');
    this.recentSongs = saved ? JSON.parse(saved).slice(0, 3) : [];
  }

  async onLocalFilesSelected(event: any) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newTracks = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (this.localTracks.some(t => t.name === file.name)) continue;

      await this.localFilesService.addFile(file);

      const url = URL.createObjectURL(file);
      newTracks.push({
        name: file.name,
        artist_name: 'Local Artist',
        file,
        filePath: url,
        album_image: 'assets/img/local-music.png',
      });
    }

    this.localTracks = [...this.localTracks, ...newTracks];
    localStorage.setItem('localTracks', JSON.stringify(this.localTracks.map(({filePath, ...rest}) => rest)));

    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  async confirmDelete(track: any, event: Event) {
    event.stopPropagation();

    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: `Delete "${track.name}" from local music?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: () => this.deleteLocalTrack(track),
        },
      ],
    });

    await alert.present();
  }

  async deleteLocalTrack(track: any) {
    this.localTracks = this.localTracks.filter(t => t.name !== track.name);
    await this.localFilesService.removeFile(track.name);
    localStorage.setItem('localTracks', JSON.stringify(this.localTracks));

    const current = this.audioService.getCurrentTrack();
    if (current && current.name === track.name) {
      this.audioService.stop();
    }
  }

  loadGenreSongs() {
    this.genres.forEach(genre => {
      this.jamendo.getSongsByGenre(genre).subscribe((res: any) => {
        this.genreSongs[genre] = res.results;
      });
    });
  }

  // Update the method to handle home icon click
  navigateToStreaming() {
    this.playMode = 'streaming';
    // Clear any search results when switching modes
    this.searchQuery = '';
    this.tracks = [];
    this.filteredLocalTracks = [];
  }
}


