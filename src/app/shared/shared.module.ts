import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MiniPlayerComponent } from '../components/mini-player/mini-player.component';

@NgModule({
  declarations: [MiniPlayerComponent],
  imports: [CommonModule, IonicModule],
  exports: [MiniPlayerComponent]
})
export class SharedModule {}
