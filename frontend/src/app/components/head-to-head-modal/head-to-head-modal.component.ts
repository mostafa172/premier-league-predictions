import { Component, EventEmitter, Input, Output } from "@angular/core";
import { HeadToHead } from "src/app/models/head-to-head.model";
import { Team } from "src/app/models/team.model";

@Component({
  selector: "app-head-to-head-modal",
  templateUrl: "./head-to-head-modal.component.html",
  styleUrls: ["./head-to-head-modal.component.scss"],
})
export class HeadToHeadModalComponent {
  @Input() headToHead: HeadToHead | null = null;
  @Input() homeTeam?: Team;
  @Input() awayTeam?: Team;
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }

  /** Team codes keyed by id so a meeting can be labelled either way round. */
  private codeFor(teamId: number): string {
    if (this.homeTeam?.id === teamId) {
      return this.homeTeam.abbreviation ?? this.homeTeam.name ?? "";
    }
    if (this.awayTeam?.id === teamId) {
      return this.awayTeam.abbreviation ?? this.awayTeam.name ?? "";
    }
    return "";
  }

  homeCode(teamId: number): string {
    return this.codeFor(teamId);
  }

  /** True when this meeting was played at the current home team's ground. */
  isSameVenue(meetingHomeTeamId: number): boolean {
    return meetingHomeTeamId === this.headToHead?.homeTeamId;
  }
}
