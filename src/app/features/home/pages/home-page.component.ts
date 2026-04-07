import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  private readonly router = inject(Router);

  protected readonly sessionCode = signal('');

  protected goToJoin(): void {
    const id = this.sessionCode().trim();
    if (!id) {
      return;
    }
    void this.router.navigate(['/session/join', id]);
  }
}
