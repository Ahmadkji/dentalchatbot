# Production Auth Plan with Supabase

## Build Order (Follow Exactly)

### Step 1: Configure Supabase project auth settings
- Create Supabase project
- Enable email/password auth
- Configure email verification
- Set up redirect URLs
- Note down SUPABASE_URL and SUPABASE_ANON_KEY

### Step 2: Install and set up Supabase SSR
- Install @supabase/ssr and @supabase/supabase-js
- Remove next-auth dependency
- Set up environment variables

### Step 3: Set up cookie-based server clients
- Create browser Supabase client (src/lib/supabase/client.ts)
- Create server Supabase client (src/lib/supabase/server.ts)
- Create middleware client (src/lib/supabase/middleware.ts)

### Step 4: Add middleware session refresh
- Create/update middleware.ts
- Refresh session cookies before protected routes
- Skip static files and image assets

### Step 5: Build auth callback flow
- Create /auth/callback route
- Handle email verification callback
- Handle OAuth callback
- Handle password reset callback

### Step 6: Build signup/login/logout
- Create /login page with all states
- Create /signup page with all states
- Add logout functionality
- Handle email confirmation pending state

### Step 7: Build forgot/reset password
- Create /forgot-password page
- Create /reset-password page
- Generic success messages (never reveal if email exists)
- Handle expired/invalid reset sessions

### Step 8: Create profiles table
- Create profiles table in public schema
- Fields: id, email, full_name, avatar_url, timezone, onboarding_completed, created_at, updated_at
- Reference auth.users for data integrity

### Step 9: Enable RLS on profiles
- Enable RLS on profiles table
- Users can only read their own profile
- Users can only update their own profile
- Users can insert their own profile on signup

### Step 10: Add profile creation after signup
- Create trigger or handle in auth callback
- Auto-create profile row when user signs up
- Set default timezone

### Step 11: Protect dashboard server-side
- Check getUser() in all protected pages
- Redirect unauthenticated users to /login
- Redirect authenticated users away from /login
- Ensure no client-only auth checks

### Step 12: Add onboarding
- Create /onboarding page
- Collect: full name, business/clinic name, timezone, notification preference
- Mark onboarding_completed = true
- Redirect to dashboard after completion

### Step 13: Add RLS to all app tables
- Enable RLS on every user-owned table
- Add ownership policies (select, insert, update, delete)
- Ensure user_id is derived server-side, never from frontend

### Step 14: Add Google OAuth
- Configure Google Cloud OAuth app
- Add Google provider in Supabase
- Test callback flow in localhost and production

### Step 15: Add custom SMTP
- Configure Resend (or similar)
- Customize email templates
- Test email delivery

### Step 16: Add rate limiting
- Login: 5 attempts per email/IP per 10 minutes
- Signup: 3 attempts per IP per hour
- Forgot password: 3 attempts per email per hour
- Reset password: 5 attempts per hour

### Step 17: Add security/error states
- All login/signup/forgot/reset error states
- Network error handling
- Rate limit feedback
- Invalid session handling

### Step 18: Write functional tests
- User can sign up
- User receives verification email
- Verified user can log in
- User can log out
- User can reset password
- Google login works
- Protected dashboard redirects

### Step 19: Write RLS isolation tests
- User A cannot read User B data
- User A cannot update User B data
- User A cannot insert with User B user_id
- Unauthenticated access blocked

### Step 20: Deploy and test production redirects
- Configure production redirect URLs
- Test all auth flows in production
- Verify cookie behavior
- Test cross-user isolation

## MVP Scope

### BUILD:
- Email/password signup, Email verification, Login/logout
- Forgot/reset password, Google OAuth
- Profiles table with timezone field, Onboarding page
- Protected dashboard, Server-side auth checks
- RLS on every user table, Custom SMTP (Resend)
- Rate limiting, Auth tests, RLS isolation tests

### SKIP (for now):
- MFA, Teams, Advanced roles, Session management UI
- SSO, Magic links, Enterprise permissions

## Key Architecture Rules

1. Use @supabase/ssr with cookie-based sessions (NOT localStorage)
2. Browser client + Server client + Middleware refresh
3. getUser() for server-side trust, never client-side only
4. profiles table (not auth.users) with timezone awareness
5. RLS on EVERY user-owned table
6. NEVER trust user_id from frontend
7. Service-role key server-only
8. No authenticated page caching
9. Roles: v1 = user + admin only
10. Rate limits on all auth forms
11. Safe redirects (internal only, starting with "/")
12. Generic password reset messages
13. Audit logs for sensitive actions

## Auth Page Routes

```
/login
/signup
/forgot-password
/reset-password
/auth/callback
/onboarding
/dashboard
/settings/account
/settings/security
```

## Page States

### Login:
- Loading, Invalid credentials, Email not confirmed, Too many attempts, Network error

### Signup:
- Weak password, Email already registered, Confirmation email sent, Rate limited

### Forgot Password:
- Generic success, Invalid email format, Rate limited

### Reset Password:
- Invalid/expired session, Password too weak, Password changed successfully

## Security Checklist

- [ ] Supabase SSR package installed and used
- [ ] Cookie-based session setup
- [ ] Middleware refreshes session
- [ ] Protected dashboard checks user server-side
- [ ] Auth callback route handles verification/OAuth/reset
- [ ] Redirect URLs configured in Supabase dashboard
- [ ] Custom SMTP configured
- [ ] Email templates customized
- [ ] RLS enabled on every public table
- [ ] Every user-owned table has ownership policies
- [ ] Frontend never controls user_id
- [ ] Service-role key is server-only
- [ ] No authenticated page is publicly cached
- [ ] Rate limits added to auth forms
- [ ] Password reset does not reveal user existence
- [ ] Safe redirect validation added
- [ ] Google OAuth tested in localhost and production
- [ ] Logout clears session correctly
- [ ] Cross-user access tested
