import { Component, OnInit, OnDestroy } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit, OnDestroy {
  playlist: any[] = [];

  constructor(
    private audioService: AudioService,
    private router: Router,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.loadPlaylist();
    window.addEventListener('storage', this.syncPlaylist.bind(this));
    window.addEventListener('userPlaylistUpdated', this.onUserPlaylistUpdated);
  }

  ngOnDestroy() {
    window.removeEventListener('storage', this.syncPlaylist.bind(this));
    window.removeEventListener('userPlaylistUpdated', this.onUserPlaylistUpdated);
  }

  // Event handler for playlist updates
  onUserPlaylistUpdated = (event: any) => {
    this.playlist = event.detail || [];
  };

  loadPlaylist() {
    const saved = localStorage.getItem('userPlaylist');
    this.playlist = saved ? JSON.parse(saved) : [];
  }

  syncPlaylist(event: StorageEvent) {
    if (event.key === 'userPlaylist') {
      this.loadPlaylist();
    }
  }

  navigateToAddSong() {
    this.router.navigate(['/home'], { queryParams: { addMode: 'true' } });
  }

  playTrack(track: any, sourceList: any[] = [track]) {
    const index = sourceList.findIndex(t => {
      if (t.id !== undefined && track.id !== undefined) {
        return t.id === track.id;
      }
      return t.name === track.name;
    });

    if (index === -1) {
      this.audioService.setPlaylist([track], 0);
    } else {
      this.audioService.setPlaylist(sourceList, index);
    }

    this.router.navigate(['/now-playing']);

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

  async confirmRemove(track: any, event: Event) {
    event.stopPropagation();

    const alert = await this.alertCtrl.create({
      header: 'Remove Song',
      message: `Are you sure you want to remove "${track.name || 'this song'}" from your playlist?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: () => {
            this.removeFromPlaylist(track);
          },
        },
      ],
    });

    await alert.present();
  }

  removeFromPlaylist(track: any) {
    if (track.id !== undefined && track.id !== null) {
      this.playlist = this.playlist.filter(item => item.id !== track.id);
    } else if (track.name) {
      this.playlist = this.playlist.filter(item => item.name !== track.name);
    } else {
      console.warn('Track has no id or name to identify it.');
      return;
    }
    localStorage.setItem('userPlaylist', JSON.stringify(this.playlist));
  }
}
