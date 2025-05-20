import { Injectable } from '@angular/core';
import { LocalFilesService } from './local-files.service';
import { Subject, Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  // Add format support information
  private supportedFormats = {
    mp3: true,
    m4a: true,
    aac: true,
    wav: true,
    ogg: true,
    flac: true,
    opus: true
  };

  // Add a subject to track format support
  private formatSupportSubject = new BehaviorSubject<{[key: string]: boolean}>(this.supportedFormats);
  public formatSupport$ = this.formatSupportSubject.asObservable();

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

    // Check format support
    this.checkFormatSupport();
    
    this.restorePlayback();
  }

  // Method to check which audio formats are supported by the browser
  private checkFormatSupport() {
    const audio = document.createElement('audio');
    
    // Check MP3 support
    this.supportedFormats.mp3 = audio.canPlayType('audio/mpeg') !== '';
    
    // Check AAC support
    this.supportedFormats.m4a = audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '';
    this.supportedFormats.aac = audio.canPlayType('audio/aac') !== '';
    
    // Check WAV support
    this.supportedFormats.wav = audio.canPlayType('audio/wav') !== '';
    
    // Check OGG support
    this.supportedFormats.ogg = audio.canPlayType('audio/ogg; codecs="vorbis"') !== '';
    
    // Check FLAC support
    this.supportedFormats.flac = audio.canPlayType('audio/flac') !== '';
    
    // Check Opus support
    this.supportedFormats.opus = audio.canPlayType('audio/opus') !== '';
    
    // Update the subject with the supported formats
    this.formatSupportSubject.next(this.supportedFormats);
  }

  // Method to get file extension from filename
  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  // Method to check if a file format is supported
  public isFormatSupported(filename: string): boolean {
    const extension = this.getFileExtension(filename);
    return this.supportedFormats[extension as keyof typeof this.supportedFormats] || false;
  }

  // Improved saveNowPlayingState method
  private saveNowPlayingState() {
    let localAudioCurrentTime = 0;
    if (this.localAudio) {
      const duration = this.localAudio.duration || 0;
      const currentTime = this.localAudio.currentTime;
      // Store the current time regardless of how close to the end it is
      localAudioCurrentTime = isNaN(currentTime) ? 0 : currentTime;
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

  // Improved restorePlayback method
  private async restorePlayback() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (!saved) return;

    try {
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

          // Wait for metadata to load before setting currentTime
          await new Promise<void>((resolve) => {
            const onMetadataLoaded = () => {
              // Set the saved position, ensuring it's within valid range
              const savedTime = state.localAudioCurrentTime || 0;
              if (savedTime > 0 && savedTime < (this.localAudio?.duration || 0)) {
                this.localAudio!.currentTime = savedTime;
              }
              this.localAudio?.removeEventListener('loadedmetadata', onMetadataLoaded);
              resolve();
            };
            
            this.localAudio!.addEventListener('loadedmetadata', onMetadataLoaded);
            
            // Fallback in case loadedmetadata doesn't fire
            setTimeout(() => {
              if (this.localAudio) {
                try {
                  const savedTime = state.localAudioCurrentTime || 0;
                  if (savedTime > 0 && this.localAudio.duration && savedTime < this.localAudio.duration) {
                    this.localAudio.currentTime = savedTime;
                  }
                } catch (e) {
                  console.error('Error setting local audio time:', e);
                }
              }
              resolve();
            }, 1000);
          });

          // Add event listeners
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
    } catch (e) {
      console.error('Error restoring playback:', e);
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

  // Improved seekTo method
  seekTo(seconds: number) {
    try {
      if (seconds < 0) seconds = 0;
      
      if (this.currentIndex === -1 && this.localAudio) {
        const maxTime = this.localAudio.duration || 100;
        this.localAudio.currentTime = Math.min(seconds, maxTime);
        // Force a save after seeking
        this.saveNowPlayingState();
      } else {
        const maxTime = this.audio.duration || 100;
        this.audio.currentTime = Math.min(seconds, maxTime);
        // Force a save after seeking
        this.saveNowPlayingState();
      }
    } catch (e) {
      console.error('Error seeking:', e);
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

  // Improved playLocalTrack method
  async playLocalTrack(track: any) {
    if (!track.name) return;
    
    // Check if format is supported
    const extension = this.getFileExtension(track.name);
    if (!this.isFormatSupported(track.name)) {
      console.warn(`Format ${extension} may not be supported in this browser`);
      // Continue anyway, the browser will try its best
    }
    
    const file = await this.localFilesService.getFile(track.name);
    if (!file) return;

    this.stop();

    if (this.localAudio) {
      this.localAudio.pause();
      this.localAudio.removeEventListener('ended', this.next.bind(this));
      this.localAudio.removeEventListener('timeupdate', this.saveNowPlayingState.bind(this));
    }

    // Create a blob URL for the audio file
    const blobUrl = URL.createObjectURL(file);
    this.localAudio = new Audio(blobUrl);
    
    // Set MIME type if possible (helps with some formats)
    if (file.type) {
      //this.localAudio.type = file.type;
    }
    
    this.localAudio.load();

    // Try to restore position if it's the same track
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.isLocal && state.currentTrack && state.currentTrack.name === track.name) {
          // Wait for metadata to load before setting time
          await new Promise<void>((resolve) => {
            this.localAudio!.addEventListener('loadedmetadata', () => {
              if (state.localAudioCurrentTime > 0 && 
                  state.localAudioCurrentTime < (this.localAudio?.duration || 0)) {
                this.localAudio!.currentTime = state.localAudioCurrentTime;
              }
              resolve();
            });
            
            // Fallback
            setTimeout(resolve, 1000);
          });
        }
      } catch (e) {
        console.error('Error restoring local track position:', e);
      }
    }

    this.localAudio.addEventListener('ended', () => {
      this.localAudio!.currentTime = 0;
      this.next();
    });

    this.localAudio.addEventListener('timeupdate', () => {
      this.playbackTimeSubject.next(this.localAudio!.currentTime);
      this.saveNowPlayingState();
    });

    // Add error handling
    this.localAudio.addEventListener('error', (e) => {
      console.error('Audio playback error:', this.localAudio?.error);
      // Try to recover by moving to next track
      setTimeout(() => this.next(), 2000);
    });

    try {
      await this.localAudio.play();
    } catch (e) {
      console.error('Error playing local track:', e);
      // Don't give up, let the user try to play manually
    }

    this.currentIndex = -1;
    this.currentTrack = {
      name: track.name || 'Unknown Title',
      artist_name: track.artist_name || 'Unknown Artist',
      album_image: track.album_image || 'assets/img/default-album.png',
      format: extension,
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

  // Add method to get supported formats
  getSupportedFormats(): {[key: string]: boolean} {
    return {...this.supportedFormats};
  }
}


