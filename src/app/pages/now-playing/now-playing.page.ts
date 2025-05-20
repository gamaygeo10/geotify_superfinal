import { Component, OnInit, OnDestroy } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { NavController, AlertController } from '@ionic/angular';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-now-playing',
  templateUrl: './now-playing.page.html',
  styleUrls: ['./now-playing.page.scss'],
  standalone: false,
})
export class NowPlayingPage implements OnInit, OnDestroy {
  showQueue = false;
  currentTime = 0;
  duration = 0;
  private timerSub?: Subscription;
  private playbackRestoredSub?: Subscription;

  constructor(
    public audioService: AudioService,
    private navCtrl: NavController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.currentTime = 0; // initialize slider at 0

    const audioEl = this.audioService.getAudioElement();
    if (audioEl) {
      audioEl.addEventListener('loadedmetadata', () => {
        this.duration = audioEl.duration || 0;
        this.currentTime = audioEl.currentTime || 0;
      });
    }

    this.playbackRestoredSub = this.audioService.playbackRestored$.subscribe(() => {
      setTimeout(() => {
        const audioEl = this.audioService.getAudioElement();
        if (audioEl) {
          this.currentTime = audioEl.currentTime || 0;
          this.duration = audioEl.duration || 0;
        }
      }, 200);
    });

    this.timerSub = interval(500).subscribe(() => {
      const audioEl = this.audioService.getAudioElement();
      if (audioEl) {
        this.currentTime = audioEl.currentTime || 0;
        this.duration = audioEl.duration || 0;
      }
    });
  }

  ngOnDestroy() {
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.playbackRestoredSub) this.playbackRestoredSub.unsubscribe();
  }

  onSeek(event: any) {
    const seekTime = event.detail.value;
    this.currentTime = seekTime;
    this.audioService.seekTo(seekTime);
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  togglePlayPause() {
    if (this.audioService.isPaused()) {
      this.audioService.play();
    } else {
      this.audioService.pause();
    }
  }

  next() {
    this.audioService.next();
  }

  previous() {
    this.audioService.previous();
  }

  toggleQueue() {
    this.showQueue = !this.showQueue;
  }

  goBack() {
    this.navCtrl.navigateBack('/home');
  }

  get track() {
    return this.audioService.getCurrentTrack();
  }

  get isPaused() {
    return this.audioService.isPaused();
  }

  get upcomingQueue() {
    return this.audioService.getUpcomingTracks();
  }

  async addToPlaylist() {
    if (!this.track) return;

    const playlistKey = 'userPlaylist';
    let playlist = JSON.parse(localStorage.getItem(playlistKey) || '[]');

    const exists = playlist.some(
      (song: any) => (song.id && this.track.id && song.id === this.track.id) || (song.name === this.track.name)
    );
    if (exists) {
      const alert = await this.alertCtrl.create({
        header: 'Already Added',
        message: `"${this.track.name}" is already in your playlist.`,
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    playlist.push(this.track);
    localStorage.setItem(playlistKey, JSON.stringify(playlist));

    const alert = await this.alertCtrl.create({
      header: 'Added to Playlist',
      message: `"${this.track.name}" was added to your playlist.`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  playFromQueue(track: any) {
    const fullQueue = [this.track, ...this.audioService.getUpcomingTracks()];
    const index = fullQueue.findIndex(t => t.id === track.id || t.name === track.name);
    if (index !== -1) {
      if (this.audioService.checkIsLocalTrack(track)) {
        this.audioService.playLocalTrack(track);
      } else {
        this.audioService.setPlaylist(fullQueue, index);
      }
      this.saveRecentlyPlayed(track);
    }
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
    window.dispatchEvent(new CustomEvent('recentSongsUpdated', { detail: recent }));
  }
}
