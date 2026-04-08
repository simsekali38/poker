import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { VoteCard } from '@app/core/models';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionHeaderComponent } from '@app/shared/ui/session-header.component';
import { copyTextToClipboard } from '@app/shared/utils/clipboard.utils';
import { PlanningRoomActiveStoryNoticeComponent } from '../components/presentational/planning-room-active-story-notice.component';
import { PlanningRoomErrorBannerComponent } from '../components/presentational/planning-room-error-banner.component';
import { PlanningRoomLoadingComponent } from '../components/presentational/planning-room-loading.component';
import { PlanningRoomMainColumnComponent } from '../components/presentational/planning-room-main-column.component';
import { PlanningRoomMissingComponent } from '../components/presentational/planning-room-missing.component';
import { PlanningRoomSidebarComponent } from '../components/presentational/planning-room-sidebar.component';
import { StoryEditDialogComponent } from '../components/presentational/story-edit-dialog.component';
import { PlanningSessionStore } from '../store/planning-session.store';

@Component({
  selector: 'app-planning-session-page',
  standalone: true,
  imports: [
    SessionHeaderComponent,
    PlanningRoomLoadingComponent,
    PlanningRoomMissingComponent,
    PlanningRoomErrorBannerComponent,
    PlanningRoomActiveStoryNoticeComponent,
    PlanningRoomSidebarComponent,
    PlanningRoomMainColumnComponent,
    StoryEditDialogComponent,
  ],
  templateUrl: './planning-session-page.component.html',
  styleUrl: './planning-session-page.component.scss',
  providers: [PlanningSessionStore],
})
export class PlanningSessionPageComponent implements OnInit {
  readonly store = inject(PlanningSessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storyEditor = viewChild(StoryEditDialogComponent);

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const connected = q.get('jira_connected');
    let site = q.get('jira_site');
    if (site) {
      try {
        site = decodeURIComponent(site);
      } catch {
        /* keep raw */
      }
    }
    if ((connected === '1' || connected === 'true') && site?.trim()) {
      this.store.applyJiraOAuthReturn(site.trim());
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  /** Screen-reader feedback after copying the invite link. */
  protected readonly copyStatus = signal('');

  protected copyInviteLink(): void {
    const sid = this.store.sessionId();
    if (!sid) {
      return;
    }
    const url = `${globalThis.location.origin}/session/join/${sid}`;
    void copyTextToClipboard(url).then((ok) => {
      this.copyStatus.set(
        ok ? 'Invite link copied to clipboard.' : `Could not copy automatically. Link: ${url}`,
      );
      globalThis.window?.setTimeout(() => this.copyStatus.set(''), ok ? 3500 : 8000);
    });
  }

  protected onCardPicked(card: string): void {
    this.store.pickVote(card as VoteCard);
  }

  protected onReveal(): void {
    this.store.reveal();
  }

  protected onReset(): void {
    this.store.resetRound();
  }

  protected onEditStory(): void {
    const vm = this.store.roomView();
    const editor = this.storyEditor();
    if (!vm?.story || !editor) {
      return;
    }
    editor.open({ title: vm.story.title, description: vm.story.description });
  }

  protected onStorySaved(payload: { title: string; description: string }): void {
    this.store.updateActiveStoryDetails(payload.title, payload.description);
  }

  protected onSwitchStory(storyId: string): void {
    this.store.switchActiveStory(storyId);
  }

  protected onCreateStory(payload: {
    title: string;
    description: string;
    makeActive: boolean;
  }): void {
    this.store.createStory(payload.title, payload.description, payload.makeActive);
  }
}
