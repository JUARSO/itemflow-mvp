import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

type Tone = 'success' | 'danger' | 'warning' | 'primary';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly ctrl = inject(ToastController);

  async show(message: string, tone: Tone = 'success', duration = 2500) {
    const toast = await this.ctrl.create({
      message,
      duration,
      color: tone,
      position: 'bottom',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }
}
