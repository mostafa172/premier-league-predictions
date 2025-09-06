import { Component, OnInit, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { LeagueService } from "../../services/league.service";
import { League, CreateLeagueRequest } from "../../models/league.model";
import { Router } from "@angular/router";

@Component({
  selector: "app-leagues",
  templateUrl: "./leagues.component.html",
  styleUrls: ["./leagues.component.scss"],
})
export class LeaguesComponent implements OnInit, OnDestroy {
  userLeagues: League[] = [];
  loading = false;
  error = "";
  showCreateModal = false;
  showJoinModal = false;
  showSuccessModal = false;
  successMessage = "";
  createdLeagueCode = "";

  // Toast properties
  showToast = false;
  toastMessage = "";
  toastType = "success"; // 'success' or 'error'

  // Create league form
  createLeagueForm: CreateLeagueRequest = {
    name: "",
    description: "",
  };

  // Join league form
  joinCode = "";

  private subscriptions: Subscription[] = [];

  constructor(private leagueService: LeagueService, private router: Router) {}

  ngOnInit(): void {
    this.loadData();

    // Check for success message from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;

    if (state?.successMessage) {
      // Small delay to ensure component is rendered
      setTimeout(() => {
        this.showToastMessage(
          state.successMessage,
          state.messageType || "success"
        );
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  loadData(): void {
    this.loading = true;
    this.error = "";

    const userLeaguesSub = this.leagueService.getUserLeagues().subscribe({
      next: (response) => {
        if (response.success) {
          this.userLeagues = response.data;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error("Error loading user leagues:", error);
        this.error = "Error loading your leagues";
        this.loading = false;
      },
    });

    this.subscriptions.push(userLeaguesSub);
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.createLeagueForm = { name: "", description: "" };
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createLeagueForm = { name: "", description: "" };
  }

  openJoinModal(): void {
    this.showJoinModal = true;
    this.joinCode = "";
    this.error = ""; // Clear any previous errors
  }

  closeJoinModal(): void {
    this.showJoinModal = false;
    this.joinCode = "";
    this.error = ""; // Clear any previous errors
  }

  createLeague(): void {
    if (!this.createLeagueForm.name.trim()) {
      this.error = "League name is required";
      return;
    }

    this.loading = true;
    this.error = "";

    const sub = this.leagueService
      .createLeague({
        name: this.createLeagueForm.name.trim(),
        description: this.createLeagueForm.description?.trim() || undefined,
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.createdLeagueCode = response.data.joinCode;
            this.successMessage = `League "${response.data.name}" created successfully!`;
            this.showSuccessModal = true;
            this.closeCreateModal();
            this.loadData(); // Reload data to show the new league
          } else {
            this.error = response.message || "Failed to create league";
          }
          this.loading = false;
        },
        error: (error) => {
          console.error("Error creating league:", error);
          this.error = "Error creating league";
          this.loading = false;
        },
      });

    this.subscriptions.push(sub);
  }

  joinLeague(): void {
    if (!this.joinCode.trim()) {
      this.error = "Join code is required";
      return;
    }

    this.loading = true;
    this.error = "";

    const sub = this.leagueService
      .joinLeague(this.joinCode.trim().toUpperCase())
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.showToastMessage(
              `Successfully joined "${response.data.leagueName}"!`,
              "success"
            );
            this.closeJoinModal();
            this.loadData(); // Reload data to show the joined league
          } else {
            this.error = response.message || "Failed to join league";
          }
          this.loading = false;
        },
        error: (error) => {
          console.error("Error joining league:", error);
          this.error = "Error joining league";
          this.loading = false;
        },
      });

    this.subscriptions.push(sub);
  }

  copyJoinCode(joinCode: string): void {
    navigator.clipboard
      .writeText(joinCode)
      .then(() => {
        this.showToastMessage("League code copied to clipboard!", "success");
      })
      .catch((err) => {
        console.error("Failed to copy join code:", err);
        this.showToastMessage("Failed to copy league code", "error");
      });
  }

  refreshData(): void {
    this.loadData();
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.successMessage = "";
    this.createdLeagueCode = "";
  }

  copyCreatedLeagueCode(): void {
    if (this.createdLeagueCode) {
      navigator.clipboard
        .writeText(this.createdLeagueCode)
        .then(() => {
          this.showToastMessage("League code copied to clipboard!", "success");
        })
        .catch((err) => {
          console.error("Failed to copy league code:", err);
          this.showToastMessage("Failed to copy league code", "error");
        });
    }
  }

  showToastMessage(message: string, type: "success" | "error"): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;

    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      this.showToast = false;
    }, 4000);
  }
}
