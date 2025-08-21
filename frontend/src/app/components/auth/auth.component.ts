import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  isLoginMode = true;
  loginForm: FormGroup;
  registerForm: FormGroup;
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    // Fixed: Use 'email' for login instead of 'username'
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]], // Changed from username to email
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/fixtures']);
    }
  }

  switchMode(): void {
    this.isLoginMode = !this.isLoginMode;
    this.error = '';
  }

  toggleMode(): void {
    this.switchMode();
  }

  onSubmit(): void {
    const form = this.isLoginMode ? this.loginForm : this.registerForm;
    
    if (form.valid) {
      this.loading = true;
      this.error = '';

      const formData = form.value;

      const authObservable = this.isLoginMode
        ? this.authService.login(formData.email, formData.password) // Fixed: use email for login
        : this.authService.register(formData.username, formData.email, formData.password);

      authObservable.subscribe({
        next: (response: any) => {
          this.loading = false;
          if (response.success) {
            this.router.navigate(['/fixtures']);
          }
        },
        error: (error: any) => {
          this.loading = false;
          this.error = error.error?.message || 'An error occurred';
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(form.controls).forEach(key => {
        form.get(key)?.markAsTouched();
      });
    }
  }
}