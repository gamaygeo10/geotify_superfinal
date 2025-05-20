import { Component } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mini-player',
  templateUrl: './mini-player.component.html',
  styleUrls: ['./mini-player.component.scss'],
  standalone: false,
})
export class MiniPlayerComponent {
  visible = true;

  constructor(public audioService: AudioService, private router: Router) {
    this.audioService.onTrackChange.subscribe(() => {
      // Show mini player only if there is a current track
      this.visible = !!this.audioService.getCurrentTrack();
    });
  }

  get track() {
    return this.audioService.getCurrentTrack();
  }

  get isPaused() {
    return this.audioService.isPaused();
  }

  togglePlayPause(event: Event) {
    event.stopPropagation();
    if (this.isPaused) {
      this.audioService.play();
    } else {
      this.audioService.pause();
    }
  }

  playNext(event: Event) {
    event.stopPropagation();
    this.audioService.next();
  }

  playPrevious(event: Event) {
    event.stopPropagation();
    this.audioService.previous();
  }

  goToNowPlaying() {
    this.router.navigate(['/now-playing']);
  }

  closeMiniPlayer(event: Event) {
    event.stopPropagation();
    this.audioService.stop();
    this.audioService.clearCurrentTrack();
    this.visible = false;
  }
}
