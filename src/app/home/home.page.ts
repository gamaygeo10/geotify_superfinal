import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { JamendoService } from '../services/spotify.service';
import { Router, ActivatedRoute } from '@angular/router';
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
  genreSongs: any = {};
  genres: string[] = ['pop', 'rock', 'jazz', 'hiphop', 'classical'];
  localTracks: any[] = [];

  addMode = false;
  isReverseOrder = false; // controls display order

  constructor(
    private jamendo: JamendoService,
    private router: Router,
    private route: ActivatedRoute,
    private audioService: AudioService,
    private alertCtrl: AlertController,
    private localFilesService: LocalFilesService
  ) {}

  async ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.addMode = params['addMode'] === 'true';
    });

    this.loadRecentSongs();

    window.addEventListener('recentSongsUpdated', (event: any) => {
      this.recentSongs = event.detail.slice(0, 3);
    });

    this.audioService.onTrackChange.subscribe(() => {
      const currentTrack = this.audioService.getCurrentTrack();
      if (currentTrack) {
        this.saveRecentlyPlayed(currentTrack);
      }
    });

    this.loadTopSongs();
    this.loadGenreSongs();
    await this.loadLocalTracks();
  }

  async loadTopSongs() {
    this.jamendo.getTopSongs().subscribe((res: any) => {
      this.topSongs = res.results;
    });
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

  async onTrackSelected(track: any, event: Event) {
    event.stopPropagation();

    if (this.addMode) {
      // In addMode: ALWAYS add to playlist, do NOT play
      await this.addToPlaylist(track);
    } else {
      // Normal play behavior
      this.playTrack(track);
    }
  }

  playTrack(track: any) {
    if (this.playMode === 'streaming') {
      let sourceList: any[] = [];

      if (this.searchQuery.trim()) {
        sourceList = this.tracks;
      } else if (this.recentSongs.some(s => s.id === track.id)) {
        sourceList = this.recentSongs;
      } else if (this.topSongs.some(s => s.id === track.id)) {
        sourceList = this.topSongs;
      } else {
        sourceList = this.topSongs;
      }

      const index = sourceList.findIndex(t => t.id === track.id);

      if (index === -1) {
        this.audioService.setPlaylist([track], 0);
      } else {
        this.audioService.setPlaylist(sourceList, index);
      }

      this.router.navigate(['/now-playing']);
      this.saveRecentlyPlayed(track);
      this.searchQuery = '';
      this.tracks = [];
    } else {
      const index = this.localTracks.findIndex(t => t.name === track.name);
      if (index !== -1) {
        this.audioService.setPlaylist(this.localTracks, index);
      } else {
        this.audioService.playLocalTrack(track);
      }
      this.router.navigate(['/now-playing']);
      this.saveRecentlyPlayed(track);
      this.searchQuery = '';
      this.filteredLocalTracks = [];
    }
  }

  async addToPlaylist(track: any) {
    const playlistKey = 'userPlaylist';
    let playlist = JSON.parse(localStorage.getItem(playlistKey) || '[]');

    const exists = playlist.some(
      (song: any) =>
        (song.id && track.id && song.id === track.id) ||
        (song.name && track.name && song.name === track.name)
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

    window.dispatchEvent(new CustomEvent('userPlaylistUpdated', { detail: playlist }));

    const alert = await this.alertCtrl.create({
      header: 'Added to Playlist',
      message: `"${track.name}" was added to your playlist.`,
      buttons: ['OK'],
    });
    await alert.present();

    this.addMode = false;
    this.router.navigate(['/profile']);
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
    localStorage.setItem('localTracks', JSON.stringify(this.localTracks.map(({ filePath, ...rest }) => rest)));

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

  getTopSongsForDisplay(): any[] {
    return this.isReverseOrder ? [...this.topSongs].reverse() : this.topSongs;
  }

  getGenreSongsForDisplay(genre: string): any[] {
    const songs = this.genreSongs[genre] || [];
    return this.isReverseOrder ? [...songs].reverse() : songs;
  }

  navigateToStreaming() {
    this.playMode = 'streaming';
    this.searchQuery = '';
    this.tracks = [];
    this.filteredLocalTracks = [];
  }

  playTrackFromList(track: any, list: any[]) {
    if (this.addMode) {
      // In add mode, just add to playlist, don't play
      this.addToPlaylist(track);
      return;
    }

    if (this.playMode === 'streaming') {
      const index = list.findIndex(t => t.id === track.id);
      if (index === -1) {
        this.audioService.setPlaylist([track], 0);
      } else {
        this.audioService.setPlaylist(list, index);
      }
      this.router.navigate(['/now-playing']);
      this.saveRecentlyPlayed(track);
      this.searchQuery = '';
      this.tracks = [];
    } else {
      const index = this.localTracks.findIndex(t => t.name === track.name);
      if (index !== -1) {
        this.audioService.setPlaylist(this.localTracks, index);
      } else {
        this.audioService.playLocalTrack(track);
      }
      this.router.navigate(['/now-playing']);
      this.saveRecentlyPlayed(track);
      this.searchQuery = '';
      this.filteredLocalTracks = [];
    }
  }
}
