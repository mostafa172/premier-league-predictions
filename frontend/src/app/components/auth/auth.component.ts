import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent {
  loginForm: FormGroup;
  registerForm: FormGroup;
  isLoginMode = true;
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  toggleMode(): void {
    this.isLoginMode = !this.isLoginMode;
  }
  
  onSubmit(): void {
    this.loading = true;
    this.error = '';
  
    if (this.isLoginMode) {
      const { email, password } = this.loginForm.value;
      this.authService.login(email, password).subscribe(
        () => {
          this.loading = false;
          this.router.navigate(['/']);
        },
        (error) => {
          this.loading = false;
          this.error = error;
        }
      );
    } else {
      const { username, email, password } = this.registerForm.value;
      this.authService.register(username, email, password).subscribe(
        () => {
          this.loading = false;
          this.router.navigate(['/']);
        },
        (error) => {
          this.loading = false;
          this.error = error;
        }
      );
    }
  }
}
