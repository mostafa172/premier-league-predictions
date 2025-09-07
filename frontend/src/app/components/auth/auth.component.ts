/* filepath: frontend/src/app/components/auth/auth.component.ts */
import { Component, OnInit } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  Validators,
  ValidatorFn,
  AbstractControl,
} from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-auth",
  templateUrl: "./auth.component.html",
  styleUrls: ["./auth.component.scss"],
})
export class AuthComponent implements OnInit {
  isLoginMode = true;
  loginForm: FormGroup;
  registerForm: FormGroup;
  loading = false;
  error = "";
  successMessage = "";

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    // Login form (email + password)
    this.loginForm = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required]],
    });

    // Register form (username + email + password + confirmPassword)
    this.registerForm = this.fb.group(
      {
        username: ["", [Validators.required, Validators.minLength(3)]],
        email: ["", [Validators.required, Validators.email]],
        password: ["", [Validators.required, Validators.minLength(6)]],
        confirmPassword: ["", [Validators.required]],
      },
      { validators: this.passwordsMatch("password", "confirmPassword") }
    );
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(["/predictions"]);
    }
  }

  // Group-level validator to ensure password === confirmPassword
  private passwordsMatch(passwordKey: string, confirmKey: string): ValidatorFn {
    return (group: AbstractControl) => {
      const password = group.get(passwordKey)?.value;
      const confirm = group.get(confirmKey)?.value;

      if (password && confirm && password !== confirm) {
        group.get(confirmKey)?.setErrors({ mismatch: true });
      } else {
        // Only clear mismatch error (preserve other errors like 'required')
        const confirmCtrl = group.get(confirmKey);
        if (confirmCtrl?.hasError("mismatch")) {
          const { mismatch, ...others } = confirmCtrl.errors || {};
          confirmCtrl.setErrors(Object.keys(others).length ? others : null);
        }
      }
      return null;
    };
  }

  get passwordsDoNotMatch(): boolean {
    const ctrl = this.registerForm.get("confirmPassword");
    return !!(ctrl && ctrl.touched && ctrl.errors?.["mismatch"]);
  }

  get confirmTouchedAndInvalid(): boolean {
    const ctrl = this.registerForm.get("confirmPassword");
    return !!(ctrl && ctrl.touched && ctrl.invalid);
  }

  switchMode(): void {
    this.isLoginMode = !this.isLoginMode;
    this.error = "";
    // optional: reset the inactive form for clean UX
    if (this.isLoginMode) {
      this.registerForm.reset();
    } else {
      this.loginForm.reset();
    }
  }

  toggleMode(): void {
    this.switchMode();
  }

  onSubmit(): void {
    const form = this.isLoginMode ? this.loginForm : this.registerForm;

    if (form.valid) {
      this.loading = true;
      this.error = "";
      const formData = form.value;

      const auth$ = this.isLoginMode
        ? this.authService.login(formData.email, formData.password)
        : this.authService.register(
            formData.username,
            formData.email,
            formData.password
          );

      auth$.subscribe({
        next: (response: any) => {
          this.loading = false;
          if (response.success) {
            if (this.isLoginMode) {
              this.router.navigate(["/predictions"]);
            } else {
              // Registration successful → switch to login mode
              this.isLoginMode = true;
              this.error = "";

              // Pre-fill login form with the new credentials
              this.loginForm.patchValue({
                email: formData.email,
                password: formData.password,
              });

              this.successMessage =
                "Registration successful! Please log in below.";

              // Optionally clear after a few seconds
              setTimeout(() => {
                this.successMessage = "";
              }, 5000);
            }
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.error = err?.error?.message || "An error occurred";
        },
      });
    } else {
      Object.keys(form.controls).forEach((key) =>
        form.get(key)?.markAsTouched()
      );
    }
  }
}
