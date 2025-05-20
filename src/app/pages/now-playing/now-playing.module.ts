import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NowPlayingPageRoutingModule } from './now-playing-routing.module';

import { NowPlayingPage } from './now-playing.page';

import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NowPlayingPageRoutingModule,
    SharedModule
  ],
  declarations: [NowPlayingPage]
})
export class NowPlayingPageModule {}
