import { Injectable } from '@angular/core';
import { LocalFilesService } from './local-files.service';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private _onTrackChange = new Subject<void>();
  public onTrackChange = this._onTrackChange.asObservable();

  private playbackTimeSubject = new Subject<number>();
  public playbackTime$ = this.playbackTimeSubject.asObservable();

  private playbackRestoredSubject = new Subject<void>();
  public playbackRestored$ = this.playbackRestoredSubject.asObservable();

  private audio = new Audio();
  private playlist: any[] = [];
  private currentIndex = 0;
  private localAudio: HTMLAudioElement | null = null;
  public currentTrack: any = null;

  private STORAGE_KEY = 'nowPlayingState';

  constructor(private localFilesService: LocalFilesService) {
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('timeupdate', () => {
      this.playbackTimeSubject.next(this.audio.currentTime);
      this.saveNowPlayingState();
    });

    this.restorePlayback();
  }

  private saveNowPlayingState() {
    let localAudioCurrentTime = 0;
    if (this.localAudio) {
      const duration = this.localAudio.duration || 0;
      const currentTime = this.localAudio.currentTime;
      localAudioCurrentTime = (duration > 0 && currentTime >= duration - 1) ? 0 : currentTime;
    }

    const state = {
      playlist: this.playlist,
      currentIndex: this.currentIndex,
      currentTime: this.audio.currentTime,
      currentTrack: this.currentTrack,
      isLocal: this.currentIndex === -1,
      localAudioCurrentTime: localAudioCurrentTime,
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  private async restorePlayback() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (!saved) return;

    const state = JSON.parse(saved);
    this.playlist = state.playlist || [];
    this.currentIndex = state.currentIndex ?? 0;
    this.currentTrack = state.currentTrack ?? null;

    if (state.isLocal && this.currentTrack) {
      const file = await this.localFilesService.getFile(this.currentTrack.name);
      if (file) {
        if (this.localAudio) {
          this.localAudio.pause();
          this.localAudio.removeEventListener('ended', this.next.bind(this));
          this.localAudio.removeEventListener('timeupdate', this.saveNowPlayingState.bind(this));
        }

        this.localAudio = new Audio(URL.createObjectURL(file));

        await new Promise<void>((resolve) => {
          this.localAudio!.addEventListener('loadedmetadata', () => {
            if (state.localAudioCurrentTime >= this.localAudio!.duration) {
              this.localAudio!.currentTime = 0;
            } else {
              this.localAudio!.currentTime = state.localAudioCurrentTime || 0;
            }
            resolve();
          });
        });

        this.localAudio.addEventListener('timeupdate', () => {
          this.playbackTimeSubject.next(this.localAudio!.currentTime);
          this.saveNowPlayingState();
        });

        this.localAudio.addEventListener('ended', () => {
          this.localAudio!.currentTime = 0;
          this.next();
        });

        this.currentIndex = -1;

        // Notify UI that playback position has been restored
        this.playbackRestoredSubject.next();

        this._onTrackChange.next();
      }
    } else if (this.playlist.length > 0 && this.currentIndex >= 0) {
      this.audio.src = this.playlist[this.currentIndex].audio_url || this.playlist[this.currentIndex].audio || '';
      this.audio.load();
      this.audio.currentTime = state.currentTime || 0;
    }
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.currentIndex === -1 ? this.localAudio : this.audio;
  }

  getCurrentTime(): number {
    return this.currentIndex === -1 && this.localAudio ? this.localAudio.currentTime : this.audio.currentTime;
  }

  getDuration(): number {
    return this.currentIndex === -1 && this.localAudio ? this.localAudio.duration || 0 : this.audio.duration || 0;
  }

  seekTo(seconds: number) {
    if (this.currentIndex === -1 && this.localAudio) {
      this.localAudio.currentTime = seconds;
    } else {
      this.audio.currentTime = seconds;
    }
  }

  getCurrentTrack() {
    return this.currentIndex === -1 ? this.currentTrack : this.playlist[this.currentIndex];
  }

  setPlaylist(tracks: any[], startIndex = 0) {
    if (!tracks.length) return;
    this.playlist = tracks;
    this.currentIndex = startIndex;
    this.currentTrack = null;
    this.playCurrent();
    this.saveNowPlayingState();
    this._onTrackChange.next();
  }

  async playCurrent() {
    const track = this.playlist[this.currentIndex];
    if (!track) return;

    if (this.isLocalTrack(track)) {
      await this.playLocalTrack(track);
    } else {
      if (this.localAudio) {
        this.localAudio.pause();
        this.localAudio.removeEventListener('ended', this.next.bind(this));
        this.localAudio.removeEventListener('timeupdate', this.saveNowPlayingState.bind(this));
      }
      this.audio.src = track.audio_url || track.audio || '';
      this.audio.load();
      await this.audio.play();
    }
    this.saveNowPlayingState();
    this._onTrackChange.next();
  }

  async play(track?: any) {
    if (track) {
      const index = this.playlist.findIndex(t => this.isSameTrack(t, track));
      if (index !== -1) {
        this.currentIndex = index;
        this.currentTrack = null;
        await this.playCurrent();
      } else {
        this.setPlaylist([track], 0);
      }
    } else {
      if (this.currentIndex === -1 && this.localAudio) {
        await this.localAudio.play();
      } else {
        await this.audio.play();
      }
    }
    this.saveNowPlayingState();
  }

  pause() {
    if (this.currentIndex === -1 && this.localAudio) {
      this.localAudio.pause();
    } else {
      this.audio.pause();
    }
    this.saveNowPlayingState();
  }

  next() {
    if (this.currentIndex === -1) {
      if (!this.currentTrack) {
        this.stop();
        return;
      }
      const currentLocalIndex = this.playlist.findIndex(t => this.isSameTrack(t, this.currentTrack));
      if (currentLocalIndex !== -1 && currentLocalIndex < this.playlist.length - 1) {
        this.currentIndex = currentLocalIndex + 1;
        this.currentTrack = null;
        this.playCurrent();
      } else {
        this.currentIndex = 0;
        this.currentTrack = null;
        this.playCurrent();
      }
    } else if (this.currentIndex < this.playlist.length - 1) {
      this.currentIndex++;
      this.currentTrack = null;
      this.playCurrent();
    } else {
      this.currentIndex = 0;
      this.currentTrack = null;
      this.playCurrent();
    }
    this.saveNowPlayingState();
  }

  previous() {
  if (this.currentIndex === -1) {
    // Local track handling
    if (!this.currentTrack) {
      this.stop();
      return;
    }
    const currentLocalIndex = this.playlist.findIndex(t => this.isSameTrack(t, this.currentTrack));

    if (currentLocalIndex > 0) {
      this.currentIndex = currentLocalIndex - 1;
      this.currentTrack = null;
      this.playCurrent();
    } else {
      // At first local track: restart or loop to last local track
      this.currentIndex = this.playlist.length - 1;
      this.currentTrack = null;
      this.playCurrent();
    }
  } else {
    // Streaming or normal playlist handling
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentTrack = null;
      this.playCurrent();
    } else {
      // At first track: restart or loop to last
      this.currentIndex = this.playlist.length - 1;
      this.currentTrack = null;
      this.playCurrent();
    }
  }
  this.saveNowPlayingState();
}


  isPaused(): boolean {
    return this.currentIndex === -1 && this.localAudio ? this.localAudio.paused : this.audio.paused;
  }

  getUpcomingTracks() {
    if (this.currentIndex === -1) {
      if (!this.currentTrack) return [];
      const currentLocalIndex = this.playlist.findIndex(t => this.isSameTrack(t, this.currentTrack));
      if (currentLocalIndex === -1) return [];
      return this.playlist.slice(currentLocalIndex + 1);
    }
    return this.playlist.slice(this.currentIndex + 1);
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    if (this.localAudio) {
      this.localAudio.pause();
    }
    this.currentTrack = null;
    this.currentIndex = -1;
    this.audio.src = '';
    this._onTrackChange.next();
    this.saveNowPlayingState();
  }

  async playLocalTrack(track: any) {
    if (!track.name) return;
    const file = await this.localFilesService.getFile(track.name);
    if (!file) return;

    this.stop();

    if (this.localAudio) {
      this.localAudio.pause();
      this.localAudio.removeEventListener('ended', this.next.bind(this));
      this.localAudio.removeEventListener('timeupdate', this.saveNowPlayingState.bind(this));
    }

    this.localAudio = new Audio(URL.createObjectURL(file));
    this.localAudio.load();

    this.localAudio.addEventListener('ended', () => {
      this.localAudio!.currentTime = 0;
      this.next();
    });

    this.localAudio.addEventListener('timeupdate', () => {
      this.playbackTimeSubject.next(this.localAudio!.currentTime);
      this.saveNowPlayingState();
    });

    await this.localAudio.play();

    this.currentIndex = -1;
    this.currentTrack = {
      name: track.name || 'Unknown Title',
      artist_name: track.artist_name || 'Unknown Artist',
      album_image: track.album_image || 'assets/img/default-album.png',
      ...track,
    };

    this.saveNowPlayingState();
    this._onTrackChange.next();
  }

  private isLocalTrack(track: any): boolean {
    return !!track.name && !track.id;
  }

  private isSameTrack(t1: any, t2: any): boolean {
    if (t1.id && t2.id) {
      return t1.id === t2.id;
    }
    return t1.name === t2.name;
  }

  clearCurrentTrack() {
    this.currentTrack = null;
    this.currentIndex = -1;
    this.audio.src = '';
    this._onTrackChange.next();
    this.saveNowPlayingState();
  }

  public checkIsLocalTrack(track: any): boolean {
    return this.isLocalTrack(track);
  }

  getPlaybackTimeObservable(): Observable<number> {
    return this.playbackTime$;
  }
}
